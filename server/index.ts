import express from "express";
import type { Request, Response, NextFunction } from "express";
import rateLimit from 'express-rate-limit';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import path from "path";
import fs from "fs";
import pkg from 'pg';
const { Pool } = pkg;
import { db } from "./db";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";
import { log } from "./lib/log";

const app = express();

// Configure CORS middleware with strict origin checking
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      env.APP_URL,
      'http://localhost:3000',
      'http://localhost:5000'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Type', 'Content-Length'],
  maxAge: 86400,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Enhanced security headers middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Strict Transport Security
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';");
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Enhanced security headers middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Strict Transport Security
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';");
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Configure request size limits and parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure PostgreSQL pool for session store
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    log('Database connection successful');
  }
});

// Configure session middleware with enhanced security
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy
}

const pgStore = connectPgSimple(session);
const sessionConfig: session.SessionOptions = {
  store: new pgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // 15 minutes
    errorLog: console.error.bind(console, 'Session store error:')
  }),
  name: 'sid',
  secret: env.JWT_SECRET!,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  rolling: true,
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
    domain: undefined // Let browser set the cookie domain
  } as session.CookieOptions & {
    sameSite: 'none' | 'lax'
  }
};

// Log session configuration for debugging
console.log('Session configuration:', {
  store: 'PostgreSQL',
  cookieSecure: sessionConfig.cookie?.secure,
  cookieSameSite: sessionConfig.cookie?.sameSite,
  environment: env.NODE_ENV,
  trustProxy: app.get('trust proxy')
});

app.use(session(sessionConfig));

// Add session error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ message: 'Invalid token' });
  } else {
    next(err);
  }
});

// Serve static files with proper MIME types and error handling
const publicPath = path.resolve(__dirname, '..', process.env.NODE_ENV === 'development' ? 'client' : 'dist/public');

// Configure static file serving
const staticFileOptions: Parameters<typeof express.static>[1] = {
  setHeaders: (res: express.Response, filePath: string) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.css') {
      res.setHeader('Content-Type', 'text/css');
    } else if (ext === '.js') {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (ext === '.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
    // Set development-specific cache headers
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  },
  fallthrough: true,
  index: false,
  dotfiles: 'ignore',
  extensions: ['html', 'css', 'js'],
  etag: true,
  lastModified: true,
  maxAge: process.env.NODE_ENV === 'development' ? 0 : '1y'
};

// Ensure the public directory exists
if (!fs.existsSync(publicPath)) {
  console.log(`Creating directory: ${publicPath}`);
  fs.mkdirSync(publicPath, { recursive: true });
}

// Serve static files
app.use(express.static(publicPath, staticFileOptions));

// Handle CSS files in development
if (process.env.NODE_ENV === 'development') {
  app.get('*.css', (req, res, next) => {
    res.type('text/css');
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    next();
  });
  
  // Handle CSS module imports
  app.get('*.module.css', (req, res, next) => {
    res.type('text/css');
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    next();
  });
}

// Register API routes
registerRoutes(app);

// Handle client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Generic error handler
app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err.status || err.statusCode || 500);
  const message = err.message || "Internal Server Error";
  log(`Error: ${message}`);
  res.status(status).json({ message });
});

// Start the server
const PORT = parseInt(process.env.PORT || '5000', 10);

(async () => {
  log('Starting server initialization...');
  try {
    // Check required environment variables
    log('Checking environment variables...');
    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      log(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
      throw new Error('Missing required environment variables');
    }

    // Verify database connection first
    try {
      log('Attempting to connect to database...');
      await db.execute(sql`SELECT 1`);
      log('Database connection successful');
    } catch (error) {
      log('Error connecting to database: ' + (error instanceof Error ? error.message : String(error)));
      throw new Error('Failed to connect to database. Check DATABASE_URL and database status.');
    }
    // Check required environment variables
    log('Checking environment variables...');
    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      log(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
      throw new Error('Missing required environment variables');
    }

    // Verify database connection first
    try {
      log('Attempting to connect to database...');
      await db.execute(sql`SELECT 1`);
      log('Database connection successful');
    } catch (error) {
      log('Error connecting to database: ' + (error instanceof Error ? error.message : String(error)));
      throw new Error('Failed to connect to database. Check DATABASE_URL and database status.');
    }

    const server = createServer(app);

    // Configure environment-specific settings
    if (process.env.NODE_ENV === "development") {
      console.log('Setting up Vite middleware for development...');
      try {
        await setupVite(app, server);
        console.log('Vite middleware setup successful');
      } catch (error) {
        console.error('Failed to setup Vite middleware:', error);
        throw error;
      }
    } else {
      console.log('Setting up static file serving for production...');
      try {
        serveStatic(app);
        console.log('Static file serving setup successful');
      } catch (error) {
        console.error('Failed to setup static file serving:', error);
        throw error;
      }
    }

    // Start the server
    server.listen(PORT, '0.0.0.0', () => {
      log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      log(`APP_URL: ${env.APP_URL}`);
    }).on('error', (error: Error) => {
      log(`Error starting server: ${error.message}`);
      if ((error as any).code === 'EADDRINUSE') {
        log('Port 5000 is already in use. Please free up the port or use a different one.');
      }
      process.exit(1);
    });
  } catch (error) {
    log(`Fatal error during server startup: ${error}`);
    process.exit(1);
  }
})();