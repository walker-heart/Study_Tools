import express from "express";
import type { Request, Response, NextFunction } from "express";
import rateLimit from 'express-rate-limit';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import session from "express-session";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";
import { log } from "./lib/log";
import { createSessionConfig } from './config/session';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app
const app = express();

// Define extended error type for better type safety
interface ExtendedError extends Error {
  status?: number;
  statusCode?: number;
}

// Configure CORS options
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      env.APP_URL,
      'http://localhost:3000',
      'http://localhost:5000',
      // Allow all subdomains of repl.co and replit.dev
      /\.repl\.co$/,
      /\.replit\.dev$/
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Allow all origins in development
    if (env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }

    // Check against allowed origins in production
    const isAllowed = allowedOrigins.some(allowed => 
      typeof allowed === 'string' 
        ? allowed === origin 
        : allowed.test(origin)
    );

    if (isAllowed) {
      callback(null, true);
    } else {
      log({
        message: 'CORS blocked origin',
        origin,
        allowedOrigins: allowedOrigins.map(o => o.toString())
      }, 'warn');
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Origin'],
  exposedHeaders: ['Content-Type', 'Content-Length', 'Set-Cookie'],
  maxAge: 86400,
  optionsSuccessStatus: 204,
  preflightContinue: false
};

// Configure basic rate limiting for DoS protection
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // Allow more requests
  message: { error: 'Too many requests, please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for auth routes and in development
    return req.path.startsWith('/api/auth/') || env.NODE_ENV === 'development';
  },
  handler: (req: Request, res: Response) => {
    log({
      message: 'Rate limit exceeded',
      path: req.path,
      method: req.method,
      ip: req.ip
    }, 'warn');
    res.status(429).json({ 
      error: 'Too many requests',
      message: 'Please try again shortly'
    });
  },
  // Configure trust proxy more securely
  trustProxy: (ip) => {
    // Only trust Replit's infrastructure and local development
    return ip === '127.0.0.1' || 
           ip.startsWith('10.') || 
           ip.startsWith('172.16.') || 
           ip.startsWith('192.168.');
  }
});

import { securityHeaders, sanitizeInput, sessionSecurity } from './middleware/security';

// Initialize middleware
async function initializeMiddleware() {
  try {
    // Environment-specific settings
    if (env.NODE_ENV === 'production') {
      // Configure trust proxy for Replit's environment
      app.set('trust proxy', (ip: string) => {
        return ip === '127.0.0.1' || 
               ip.startsWith('10.') || 
               ip.startsWith('172.16.') || 
               ip.startsWith('192.168.');
      });
    } else {
      app.set('json spaces', 2);
    }
    app.set('x-powered-by', false);
    
    log(`Server initializing in ${env.NODE_ENV} mode`, 'info');

    // Initialize session first
    const sessionConfig = await createSessionConfig();
    if (!sessionConfig) {
      throw new Error('Failed to create session configuration');
    }
    app.use(session(sessionConfig));

    // Apply basic security headers
    app.use(securityHeaders);
    
    // Apply CORS
    app.use(cors(corsOptions));
    
    // Apply general rate limiting for DoS protection
    app.use(limiter);
    
    // Apply parameter sanitization
    app.use(sanitizeInput);
    
    // Apply session security
    app.use(sessionSecurity);

    // Body parsing middleware with size limits and validation
    app.use(express.json({ 
      limit: '10mb',
      verify: (req: Request, res: Response, buf: Buffer) => {
        if (req.headers['content-type']?.includes('application/json')) {
          try {
            JSON.parse(buf.toString());
          } catch (e) {
            res.status(400).json({ message: 'Invalid JSON' });
            throw new Error('Invalid JSON');
          }
        }
        return true;
      }
    }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static file serving with proper caching
    const publicPath = path.resolve(__dirname, '..', 'dist', 'public');
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true });
    }

    app.use(express.static(publicPath, {
      maxAge: env.NODE_ENV === 'production' ? '1y' : 0,
      etag: true,
      lastModified: true
    }));

    log('Middleware initialized successfully', 'info');
  } catch (error) {
    log({
      message: 'Failed to initialize middleware',
      stack: error instanceof Error ? error.stack : undefined
    }, 'error');
    throw error;
  }
}

// Setup error handlers
function setupErrorHandlers() {
  // API route not found handler
  app.use('/api/*', (req: Request, res: Response) => {
    log({
      message: 'API endpoint not found',
      path: req.path,
      method: req.method
    }, 'warn');
    res.status(404).json({ message: 'API endpoint not found' });
  });

  // Session error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err.name === 'SessionError') {
      log({
        message: 'Session error occurred',
        path: req.path,
        method: req.method,
        stack: err.stack
      }, 'error');
      return res.status(401).json({ 
        message: 'Session error occurred',
        error: 'Please try signing in again'
      });
    }
    next(err);
  });

  // Database error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err.name === 'DatabaseError' || err.message.includes('database')) {
      log({
        message: 'Database error occurred',
        path: req.path,
        method: req.method,
        stack: err.stack
      }, 'error');
      return res.status(503).json({ 
        message: 'Database error occurred',
        error: 'Please try again later'
      });
    }
    next(err);
  });

  // Final error handler
  app.use((err: ExtendedError, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    log({
      message: `Error processing request: ${message}`,
      path: req.path,
      method: req.method,
      status,
      stack: err.stack
    }, 'error');

    const response = {
      message: env.NODE_ENV === 'production' ? 'An unexpected error occurred' : message,
      status,
      ...(env.NODE_ENV === 'development' ? { 
        stack: err.stack,
        details: err.message 
      } : {})
    };

    res.status(status).json(response);
  });

  // Handle client-side routing for non-API routes
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      next();
    } else {
      res.sendFile('index.html', { 
        root: path.join(__dirname, '..', 'dist', 'public')
      });
    }
  });
}

// Main application entry point
async function main() {
  const PORT = parseInt(process.env.PORT || '5000', 10);
  let server: ReturnType<typeof createServer> | undefined;

  try {
    // Test database connection
    await db.execute(sql`SELECT NOW()`);
    log('Database connection successful', 'info');

    // Initialize middleware
    await initializeMiddleware();
    log('Middleware initialized successfully', 'info');

    // Register routes
    registerRoutes(app);
    log('Routes registered', 'info');

    // Setup error handlers
    setupErrorHandlers();
    log('Error handlers configured', 'info');

    // Create HTTP server
    server = createServer(app);
    log('HTTP server created', 'info');

    // Start server
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        reject(new Error('Server initialization failed'));
        return;
      }

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          // Try the next available port
          log(`Port ${PORT} is in use, trying ${PORT + 1}`, 'warn');
          server.listen(PORT + 1, '0.0.0.0');
        } else {
          log(`Server error: ${error.message}`, 'error');
          reject(error);
        }
      });

      server.on('listening', () => {
        log(`Server running in ${env.NODE_ENV} mode on port ${PORT}`, 'info');
        log(`APP_URL: ${env.APP_URL}`, 'info');
        resolve();
      });

      server.listen(PORT, '0.0.0.0');
    });

  } catch (error) {
    log({
      message: 'Fatal error in server startup',
      stack: error instanceof Error ? error.stack : String(error)
    }, 'error');

    if (server?.listening) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    
    process.exit(1);
  }

  // Handle process signals
  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down', 'info');
    server?.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    log('SIGINT received, shutting down', 'info');
    server?.close(() => process.exit(0));
  });
}

// Start server
try {
  await main();
} catch (error) {
  log({
    message: 'Fatal error starting server',
    stack: error instanceof Error ? error.stack : String(error)
  }, 'error');
  process.exit(1);
}
