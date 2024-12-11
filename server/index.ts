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
import { fileURLToPath } from 'url';
import fs from "fs";
import pkg from 'pg';
const { Pool } = pkg;
import { db } from "./db";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";
import { log } from "./lib/log";

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app with enhanced security
const app = express();

// Enhanced server startup function with better error handling
async function startServer() {
  const PORT = parseInt(process.env.PORT || '5000', 10);

  try {
    // Validate environment variables
    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }

    // Initialize database connection with retry mechanism
    let retries = 5;
    while (retries > 0) {
      try {
        await db.execute(sql`SELECT 1`);
        log('Database connection successful', 'info');
        break;
      } catch (dbError) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to connect to database after 5 attempts: ${dbError}`);
        }
        log(`Database connection attempt failed, retrying... (${retries} attempts remaining)`, 'warn');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      }
    }

    const server = createServer(app);

    // Configure environment-specific settings
    if (env.NODE_ENV === "development") {
      try {
        await setupVite(app, server);
        log('Vite middleware setup successful', 'info');
      } catch (viteError) {
        log(`Vite middleware setup failed: ${viteError}`, 'error');
        throw viteError;
      }
    } else {
      serveStatic(app);
      log('Static file serving setup successful', 'info');
    }

    // Enhanced error handling for server startup
    await new Promise<void>((resolve, reject) => {
      server.listen(PORT, '0.0.0.0', () => {
        log(`Server running in ${env.NODE_ENV || 'development'} mode on port ${PORT}`, 'info');
        log(`APP_URL: ${env.APP_URL}`, 'info');
        resolve();
      });

      server.on('error', (error: Error & { code?: string }) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${PORT} is already in use. Please free up the port or use a different one.`));
        } else {
          reject(new Error(`Server startup failed: ${error.message}`));
        }
      });
    });

    // Global error handling for uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      log(`Uncaught Exception: ${error.message}`, 'error');
      log(error.stack || 'No stack trace available', 'error');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      log(`Unhandled Promise Rejection: ${reason}`, 'error');
      process.exit(1);
    });

  } catch (error) {
    log(`Fatal error during server startup: ${error}`, 'error');
    process.exit(1);
  }
}

// Security middleware configurations
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

// Configure security middleware
const securityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Set comprehensive security headers
  const securityHeaders = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
  
  Object.entries(securityHeaders).forEach(([header, value]) => {
    res.setHeader(header, value);
  });
  next();
};

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply security middleware
app.use(cors(corsOptions));
app.use(limiter);
app.use(securityMiddleware);

// Request parsing middleware with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure PostgreSQL pool for session store
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Session configuration
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const pgStore = connectPgSimple(session);
// Configure session store with enhanced security and error handling
const sessionConfig = {
  store: new pgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // 15 minutes
    errorLog: (error: Error) => {
      log(error, 'error');
      // Notify about session store errors but don't crash
      console.error('Session store error:', error);
    }
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
    domain: undefined
  }
} satisfies session.SessionOptions;

// Cast cookie options with proper type
const cookieOptions = sessionConfig.cookie as session.CookieOptions & {
  sameSite: 'none' | 'lax';
};

// Validate session configuration
if (!env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for session security');
}

if (env.NODE_ENV === 'production' && !cookieOptions.secure) {
  log('Warning: Session cookies should be secure in production', 'warn');
}

// Initialize session with comprehensive error handling
try {
  app.use(session(sessionConfig));
  log('Session middleware initialized successfully', 'info');
} catch (error) {
  log(`Failed to initialize session middleware: ${error}`, 'error');
  if (error instanceof Error) {
    log(error.stack || 'No stack trace available', 'error');
  }
  // Fail fast if session initialization fails as it's critical for app security
  process.exit(1);
}

// Add session error handler with detailed logging
app.use((err: Error, _req: Request, _res: Response, next: NextFunction) => {
  if (err.name === 'SessionError') {
    log(`Session error occurred: ${err.message}`, 'error');
    if (err.stack) {
      log(`Session error stack trace: ${err.stack}`, 'error');
    }
  }
  next(err);
});

// Enhanced static file serving configuration with proper MIME types and caching
const publicPath = path.resolve(__dirname, '..', env.NODE_ENV === 'development' ? 'client' : 'dist/public');
const staticFileOptions: Parameters<typeof express.static>[1] = {
  setHeaders: (res: express.Response, filePath: string) => {
    const ext = path.extname(filePath).toLowerCase();
    // Enhanced MIME type mapping
    const mimeTypes: Record<string, string> = {
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    };

    // Set appropriate content type
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
    
    // Environment-specific cache control
    if (env.NODE_ENV === 'development') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // Use different cache strategies based on file type
      const maxAge = ext === '.html' ? '1h' : '1y';
      res.setHeader('Cache-Control', `public, max-age=${maxAge === '1h' ? 3600 : 31536000}`);
    }

    // Additional security headers for static content
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
  fallthrough: true,
  index: false,
  dotfiles: 'ignore',
  extensions: ['html', 'css', 'js'],
  etag: true,
  lastModified: true,
  maxAge: env.NODE_ENV === 'development' ? 0 : '1y'
};

// Ensure public directory exists
if (!fs.existsSync(publicPath)) {
  log('Creating directory: ' + publicPath, 'info');
  fs.mkdirSync(publicPath, { recursive: true });
}

app.use(express.static(publicPath, staticFileOptions));

// Register API routes
registerRoutes(app);

// Client-side routing handler
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Global error handler
app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  log(message, 'error');
  res.status(status).json({ message });
});

// Start the server
startServer();