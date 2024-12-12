import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import cors from "cors";
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pkg from 'pg';
import { sql } from "drizzle-orm";
import { registerRoutes } from "./routes";
import { db } from "./db";
import { env } from "./lib/env";
import { log } from "./lib/logger";

const { Pool } = pkg;

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      email: string;
      isAdmin?: boolean;
    };
    authenticated?: boolean;
  }
}

const app = express();

// Configure CORS middleware with enhanced security
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [env.APP_URL];
    if (env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:5000', 'http://localhost:3000');
    }
    
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
app.options('*', cors(corsOptions));

// Configure security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", process.env.APP_URL || '*'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Serve static files with proper MIME types and error handling
const publicPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  process.env.NODE_ENV === 'development' ? 'client' : 'dist/public'
);

console.log('Environment:', process.env.NODE_ENV);
console.log('Static files path:', publicPath);

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

// Ensure the directory exists
if (!fs.existsSync(publicPath)) {
  console.log(`Creating directory: ${publicPath}`);
  fs.mkdirSync(publicPath, { recursive: true });
}

// Serve static files
app.use(express.static(publicPath, staticFileOptions));

// Configure request size limits and parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure PostgreSQL pool for session store
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection with retries
async function testDatabaseConnection(retries = 5, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT NOW()');
      log('Database connection successful');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Database connection attempt ${i + 1}/${retries} failed: ${errorMessage}`);
      if (i < retries - 1) {
        log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw new Error(`Failed to connect to database after ${retries} attempts`);
      }
    }
  }
  return false;
}

// Initialize database connection
testDatabaseConnection().catch(err => {
  console.error('Fatal database connection error:', err);
  process.exit(1);
});

// Configure session middleware with enhanced debugging
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy
}

console.log('Configuring session store with database connection');
const pgStore = connectPgSimple(session);
const sessionConfig: session.SessionOptions = {
  store: new pgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 30, // 30 minutes
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

// Add static file error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'ENOENT') {
    log(`Static file not found: ${req.url}`);
    next();
  } else {
    next(err);
  }
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

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
      log('Database connection string (redacted): ' + env.DATABASE_URL.replace(/\/\/.*@/, '//***:***@'));
      throw new Error('Failed to connect to database. Check DATABASE_URL and database status.');
    }

    // Register routes after successful database connection
    registerRoutes(app);
    
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
        
        // Serve index.html for all routes in production
        app.get('*', (_req, res) => {
          const indexPath = path.join(__dirname, '..', 'dist', 'public', 'index.html');
          if (!fs.existsSync(indexPath)) {
            console.error(`Index file not found at ${indexPath}`);
            return res.status(404).send('Application not built properly');
          }
          res.set('Content-Type', 'text/html');
          res.sendFile(indexPath, {
            headers: {
              'Cache-Control': 'no-cache',
            }
          });
        });
        console.log('Static file serving setup successful');
      } catch (error) {
        console.error('Failed to setup static file serving:', error);
        throw error;
      }
    }

    // Generic error handler
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      const status = (err.status || err.statusCode || 500);
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    // Start the server
    const PORT = parseInt(process.env.PORT || '5000', 10);
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