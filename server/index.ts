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

    // Initialize middleware (including session) after database is confirmed working
    await initializeMiddleware();

    // Setup error handlers before registering routes
    setupErrorHandlers();

    // Register routes after all middleware is initialized
    registerRoutes(app);

    // Set up HTTP server
    const server = createServer(app);

    // Register error handlers before starting the server
    server.on('error', (error: Error & { code?: string }) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${PORT} is already in use. Please free up the port or use a different one.`, 'error');
        process.exit(1);
      }
      log(`Server error: ${error.message}`, 'error');
      process.exit(1);
    });

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

    // Start the server with proper error handling
    server.listen(PORT, '0.0.0.0', () => {
      log(`Server running in ${env.NODE_ENV || 'development'} mode on port ${PORT}`, 'info');
      log(`APP_URL: ${env.APP_URL}`, 'info');
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

    return server;
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

// Import session configuration
import { createSessionConfig } from './config/session';

// Set trust proxy in production
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Initialize all middleware with proper error handling
async function initializeMiddleware() {
  try {
    // Test database connection first
    await db.execute(sql`SELECT NOW()`);
    log('Initial database connection successful', 'info');
    
    // Initialize session with async configuration
    const sessionConfig = await createSessionConfig();
    
    // Add session middleware
    app.use(session(sessionConfig));
    
    // Add basic middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Add security middleware
    app.use(cors(corsOptions));
    app.use(limiter);
    app.use(securityMiddleware);
    
    // Configure trust proxy for production
    if (env.NODE_ENV === 'production') {
      app.set('trust proxy', 1);
    }
    
    log('All middleware initialized successfully', 'info');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log({
      message: `Failed to initialize middleware: ${errorMessage}`,
      stack: error instanceof Error ? error.stack : undefined
    }, 'error');
    throw error;
  }
}

// Setup error handlers with proper error typing and logging
function setupErrorHandlers() {
  // Handle 404 errors
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: 'Not Found' });
  });

  // Session error handler
  app.use((err: Error, _req: Request, _res: Response, next: NextFunction) => {
    if (err.name === 'SessionError') {
      log({
        message: 'Session error occurred',
        stack: err.stack
      }, 'error');
    }
    next(err);
  });

  // Database error handler
  app.use((err: Error, _req: Request, _res: Response, next: NextFunction) => {
    if (err.name === 'DatabaseError' || err.message.includes('database')) {
      log({
        message: 'Database error occurred',
        stack: err.stack
      }, 'error');
    }
    next(err);
  });

  // Final error handler
  app.use((err: ExtendedError, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    // Enhanced error logging
    log({
      message: `Error processing request: ${message}`,
      path: req.path,
      method: req.method,
      status,
      stack: err.stack
    }, 'error');

    // Send safe error response
    const response = {
      message,
      status,
      ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    };

    res.status(status).json(response);
  });
}

// Session error handler
app.use((err: Error, _req: Request, _res: Response, next: NextFunction) => {
  if (err.name === 'SessionError') {
    log(`Session error occurred: ${err.message}`, 'error');
    log(err.stack || 'No stack trace available', 'error');
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

// Define extended error type for better type safety
interface ExtendedError extends Error {
  status?: number;
  statusCode?: number;
}

// Start the server with enhanced error handling
async function main() {
  try {
    // Test database connection first with retries
    let retries = 5;
    let isConnected = false;
    while (retries > 0 && !isConnected) {
      try {
        await db.execute(sql`SELECT NOW()`);
        log('Database connection successful', 'info');
        isConnected = true;
      } catch (dbError) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to connect to database after 5 attempts: ${dbError}`);
        }
        log(`Database connection attempt failed, retrying... (${retries} attempts remaining)`, 'warn');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Initialize session config after database is confirmed
    const sessionConfig = await createSessionConfig();
    if (!sessionConfig) {
      throw new Error('Failed to create session configuration');
    }

    // Apply session middleware
    app.use(session(sessionConfig));
    log('Session middleware initialized', 'info');

    // Setup basic middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cors(corsOptions));
    app.use(limiter);
    app.use(securityMiddleware);

    // Setup error handlers
    setupErrorHandlers();
    log('Error handlers configured', 'info');

    // Register routes
    registerRoutes(app);
    log('Routes registered', 'info');

    // Start HTTP server
    const server = createServer(app);
    
    // Register server error handler
    server.on('error', (error: Error & { code?: string }) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${process.env.PORT || 5000} is already in use`, 'error');
        process.exit(1);
      }
      log(`Server error: ${error.message}`, 'error');
      process.exit(1);
    });

    // Configure environment-specific settings
    if (env.NODE_ENV === "development") {
      await setupVite(app, server);
      log('Vite middleware setup successful', 'info');
    } else {
      serveStatic(app);
      log('Static file serving setup successful', 'info');
    }

    // Start listening
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      log(`Server running in ${env.NODE_ENV} mode on port ${PORT}`, 'info');
      log(`APP_URL: ${env.APP_URL}`, 'info');
    });

    // Setup process handlers
    process.on('SIGTERM', () => {
      log('SIGTERM received. Starting graceful shutdown...', 'info');
      server.close(() => {
        log('Server closed', 'info');
        process.exit(0);
      });
    });

    process.on('uncaughtException', (error: Error) => {
      log({
        message: 'Uncaught Exception detected',
        stack: error.stack
      }, 'error');
      server.close(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason: unknown) => {
      log({
        message: 'Unhandled Promise Rejection detected',
        stack: reason instanceof Error ? reason.stack : String(reason)
      }, 'error');
      server.close(() => process.exit(1));
    });

    return server;
  } catch (error) {
    log({
      message: 'Fatal error during server startup',
      stack: error instanceof Error ? error.stack : String(error)
    }, 'error');
    process.exit(1);
  }
}

// Start the application
main().catch((error: Error) => {
  log({
    message: 'Fatal error in main process',
    stack: error.stack
  }, 'error');
  process.exit(1);
});