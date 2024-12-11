import express from "express";
import type { Request, Response, NextFunction } from "express";
import type { ServeStaticOptions } from 'serve-static';
import rateLimit from 'express-rate-limit';
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";
import { createServer } from "http";
import session from "express-session";
import type { Session as ExpressSession, SessionData } from "express-session";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";
import { log, debug, info, warn, error } from "./lib/log";
import type { LogMessage, LogLevel } from "./lib/log";
import { createSessionConfig } from './config/session';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app
const app = express();

// Define extended error types for better type safety
interface ExtendedError extends Error {
  status?: number;
  statusCode?: number;
  context?: {
    statusCode?: number;
    errorCode?: string;
  };
}

interface TypedRequest extends Request {
  session: ExpressSession & Partial<SessionData> & {
    user?: {
      id: string | number;
      [key: string]: any;
    };
  };
  sessionID?: string;
  requestId?: string;
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
      warn({
        message: 'CORS blocked origin',
        origin,
        allowedOrigins: allowedOrigins.map(o => o.toString())
      });
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
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1000, // Increased limit
  message: { error: 'Too many requests, please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for essential routes and development
    return req.path.startsWith('/api/auth/') || 
           req.path.startsWith('/api/user/') ||
           env.NODE_ENV === 'development';
  },
  handler: (req: Request, res: Response) => {
    warn({
      message: 'Rate limit exceeded',
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    res.status(429).json({ 
      error: 'Too many requests',
      message: 'Please try again in a few minutes'
    });
  }
});

// Configure trust proxy settings separately
app.set('trust proxy', (ip: string) => {
  return ip === '127.0.0.1' || 
         ip.startsWith('10.') || 
         ip.startsWith('172.16.') || 
         ip.startsWith('192.168.');
});

import { securityHeaders, sanitizeInput, sessionSecurity, cleanupSessions } from './middleware/security';

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
    
    info(`Server initializing in ${env.NODE_ENV} mode`);

    // Initialize session first
    const sessionConfig = await createSessionConfig();
    if (!sessionConfig) {
      throw new Error('Failed to create session configuration');
    }
    app.use(session(sessionConfig));
    
    // Add session cleanup middleware
    app.use(cleanupSessions);

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
    // Ensure static directories exist and are accessible
    const publicPath = path.resolve(__dirname, '..', 'dist', 'public');
    const assetsPath = path.join(publicPath, 'assets');
    
    try {
      // Create directories if they don't exist
      [publicPath, assetsPath].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
          info(`Created directory: ${dir}`);
        }
      });
      
      // Verify directory access
      fs.accessSync(publicPath, fs.constants.R_OK);
      fs.accessSync(assetsPath, fs.constants.R_OK);
      
      info({
        message: 'Static directories verified and accessible',
        metadata: {
          publicPath,
          assetsPath,
          mode: env.NODE_ENV
        }
      });
    } catch (err) {
      const errorMessage: LogMessage = {
        level: 'error' as LogLevel,
        message: 'Failed to setup static directories',
        error_message: err instanceof Error ? err.message : String(err),
        metadata: { 
          paths: { publicPath, assetsPath },
          operation: 'static_directory_setup',
          status: 500
        }
      };
      error(errorMessage);
      throw err;
    }

    // Configure static file serving with better error handling
    const serveStaticWithLogging = (staticPath: string, options: ServeStaticOptions) => {
      const staticHandler = express.static(staticPath, {
        ...options,
        setHeaders: (res, path) => {
          // Set correct MIME types for different file extensions
          if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
          } else if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
          } else if (path.endsWith('.svg')) {
            res.setHeader('Content-Type', 'image/svg+xml');
          }
        }
      });

      return (req: Request, res: Response, next: NextFunction) => {
        staticHandler(req, res, (err) => {
          if (err) {
            const logMessage: LogMessage = {
              level: 'error',
              message: 'Static file error',
              error_message: err instanceof Error ? err.message : String(err),
              metadata: {
                path: req.path,
                operation: 'static_file_serve',
                status: 500
              }
            };
            error(logMessage);
            next(err);
          } else {
            next();
          }
        });
      };
    };

    // Serve assets with long cache duration
    app.use('/assets', serveStaticWithLogging(path.join(publicPath, 'assets'), {
      maxAge: env.NODE_ENV === 'production' ? '1y' : 0,
      etag: true,
      lastModified: true,
      immutable: true,
      index: false,
      fallthrough: true
    }));

    // Serve other static files with shorter cache
    app.use(serveStaticWithLogging(publicPath, {
      maxAge: env.NODE_ENV === 'production' ? '1d' : 0,
      etag: true,
      lastModified: true,
      index: false
    }));

    // Final handler for static files
    app.use((err: Error, req: TypedRequest, res: Response, next: NextFunction) => {
      if (err.message?.includes('ENOENT') || err.message?.includes('not found')) {
        error({
          message: 'Static file not found',
          error_message: err.message,
          metadata: {
            path: req.path,
            status: 404,
            operation: 'static_file_serve'
          }
        });
        
        if (req.path.startsWith('/assets/')) {
          res.status(404).json({ message: 'Asset not found', path: req.path });
        } else {
          // For non-asset routes, let the client-side router handle it
          res.sendFile(path.join(publicPath, 'index.html'), (sendErr) => {
            if (sendErr) {
              error({
                message: 'Error sending index.html',
                error_message: sendErr.message,
                metadata: {
                  path: req.path,
                  status: 500,
                  operation: 'serve_index_html'
                }
              });
              res.status(500).json({ message: 'Error serving page' });
            }
          });
        }
      } else {
        next(err);
      }
    });

    info('Middleware initialized successfully');
  } catch (err) {
    error({
      message: 'Failed to initialize middleware',
      stack: err instanceof Error ? err.stack : undefined
    });
    throw err;
  }
}

import { 
  trackError, 
  initRequestTracking, 
  AuthenticationError,
  DatabaseError,
  ValidationError,
  AppError 
} from './lib/errorTracking';

// Setup error handlers
function setupErrorHandlers() {
  // Add request tracking
  app.use(initRequestTracking());

  // API route not found handler
  app.use('/api/*', (req: TypedRequest, res: Response) => {
    const context = trackError(
      new AppError('API endpoint not found', {
        errorCode: 'NOT_FOUND',
        statusCode: 404
      }), 
      req
    );
    
    res.status(404).json({ 
      message: 'API endpoint not found',
      requestId: context.requestId
    });
  });

  // Authentication error handler
  app.use((err: Error, req: TypedRequest, res: Response, next: NextFunction) => {
    if (err instanceof AuthenticationError || err.name === 'SessionError') {
      const context = trackError(err, req);
      return res.status(401).json({ 
        message: 'Authentication failed',
        error: 'Please sign in again',
        requestId: context.requestId
      });
    }
    next(err);
  });

  // Validation error handler
  app.use((err: Error, req: TypedRequest, res: Response, next: NextFunction) => {
    if (err instanceof ValidationError) {
      const context = trackError(err, req);
      return res.status(400).json({
        message: 'Validation failed',
        error: err.message,
        requestId: context.requestId
      });
    }
    next(err);
  });

  // Database error handler
  app.use((err: Error, req: TypedRequest, res: Response, next: NextFunction) => {
    if (err instanceof DatabaseError || err.message.includes('database')) {
      const context = trackError(err, req);
      return res.status(503).json({ 
        message: 'Service temporarily unavailable',
        error: 'Please try again later',
        requestId: context.requestId
      });
    }
    next(err);
  });

  // Final error handler
  app.use((err: Error | AppError, req: TypedRequest, res: Response, _next: NextFunction) => {
    const context = trackError(err, req, res);
    const status = 'context' in err && err.context?.statusCode ? err.context.statusCode : 500;
    
    const response = {
      message: env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message,
      status,
      requestId: context.requestId,
      ...(env.NODE_ENV === 'development' ? { 
        stack: err.stack,
        errorCode: 'context' in err ? err.context.errorCode : 'UNKNOWN_ERROR'
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
    // Test database connection with retry mechanism
    let retries = 5;
    let backoff = 1000; // Start with 1 second

    while (retries > 0) {
      try {
        await db.execute(sql`SELECT NOW()`);
        info('Database connection successful');
        break;
      } catch (err) {
        retries--;
        if (retries === 0) {
          throw new Error('Failed to connect to database after multiple attempts');
        }
        warn({
          message: `Database connection failed, retrying in ${backoff/1000} seconds...`,
          error_message: err instanceof Error ? err.message : String(err)
        });
        
        await new Promise(resolve => setTimeout(resolve, backoff));
        backoff *= 2; // Exponential backoff
      }
    }

    // Initialize middleware
    await initializeMiddleware();
    info('Middleware initialized successfully');

    // Register routes
    registerRoutes(app);
    info('Routes registered');

    // Setup error handlers
    setupErrorHandlers();
    info('Error handlers configured');

    // Create HTTP server
    server = createServer(app);
    info('HTTP server created');

    // Start server
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        reject(new Error('Server initialization failed'));
        return;
      }

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // Try the next available port
          warn(`Port ${PORT} is in use, trying ${PORT + 1}`);
          if (server) {
            server.listen(PORT + 1, '0.0.0.0');
          } else {
            reject(new Error('Server is not initialized'));
          }
        } else {
          error(`Server error: ${err.message}`);
          reject(err);
        }
      });

      server.on('listening', () => {
        info(`Server running in ${env.NODE_ENV} mode on port ${PORT}`);
        info(`APP_URL: ${env.APP_URL}`);
        resolve();
      });

      server.listen(PORT, '0.0.0.0');
    });

  } catch (err) {
    error({
      message: 'Fatal error in server startup',
      stack: err instanceof Error ? err.stack : String(err)
    });

    if (server?.listening) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    
    process.exit(1);
  }

  // Handle process signals
  process.on('SIGTERM', () => {
    info('SIGTERM received, shutting down');
    server?.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    info('SIGINT received, shutting down');
    server?.close(() => process.exit(0));
  });
}

// Start server
try {
  await main();
} catch (err) {
  error({
    message: 'Fatal error starting server',
    stack: err instanceof Error ? err.stack : String(err)
  });
  process.exit(1);
}
