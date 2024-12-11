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

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure security middleware
const securityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Set security headers
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

// Initialize middleware
async function initializeMiddleware() {
  try {
    // Production-specific settings
    if (env.NODE_ENV === 'production') {
      app.set('trust proxy', 1);
      app.set('x-powered-by', false);
    }

    // Apply security middleware first
    app.use(securityMiddleware);
    app.use(cors(corsOptions));
    app.use(limiter);

    // Initialize session
    const sessionConfig = await createSessionConfig();
    if (!sessionConfig) {
      throw new Error('Failed to create session configuration');
    }
    app.use(session(sessionConfig));

    // Body parsing middleware with size limits
    app.use(express.json({ 
      limit: '10mb',
      verify: (req: Request, res: Response, buf: Buffer) => {
        try {
          JSON.parse(buf.toString());
        } catch (e) {
          res.status(400).json({ message: 'Invalid JSON' });
          throw new Error('Invalid JSON');
        }
      }
    }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static file serving
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

// Main server startup function
async function startServer() {
  const PORT = parseInt(process.env.PORT || '5000', 10);

  try {
    // Test database connection
    await db.execute(sql`SELECT NOW()`);
    log('Database connection successful', 'info');

    // Initialize middleware
    await initializeMiddleware();

    // Setup error handlers
    setupErrorHandlers();

    // Register routes
    registerRoutes(app);

    // Create HTTP server
    const server = createServer(app);

    // Start the server
    await new Promise<void>((resolve, reject) => {
      server.listen(PORT, '0.0.0.0', () => {
        log(`Server running in ${env.NODE_ENV} mode on port ${PORT}`, 'info');
        log(`APP_URL: ${env.APP_URL}`, 'info');
        resolve();
      }).on('error', (err: Error & { code?: string }) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${PORT} is already in use`));
        } else {
          reject(err);
        }
      });
    });

    return server;
  } catch (error) {
    log({
      message: 'Fatal error during server startup',
      stack: error instanceof Error ? error.stack : String(error)
    }, 'error');
    throw error;
  }
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
          log(`Port ${PORT} is already in use`, 'error');
          reject(new Error(`Port ${PORT} is already in use`));
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

    // Handle process signals
    process.on('SIGTERM', () => {
      log('SIGTERM received, shutting down', 'info');
      server?.close(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      log('SIGINT received, shutting down', 'info');
      server?.close(() => process.exit(0));
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
}

// Start server with top-level error handling
try {
  await main();
} catch (error) {
  log({
    message: 'Fatal error starting server',
    stack: error instanceof Error ? error.stack : String(error)
  }, 'error');
  process.exit(1);
}
