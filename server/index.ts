import express from "express";
import type { Request, Response, NextFunction } from "express";
import type { ServeStaticOptions } from 'serve-static';
import type { ServerResponse, IncomingMessage } from 'http';
import type { Response as ExpressResponse } from 'express-serve-static-core';
import type { Session, SessionData } from "express-session";
import rateLimit from 'express-rate-limit';
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";
import { createServer } from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";
import { log, debug, info, warn, error } from "./lib/log";
import { 
  trackError, 
  initRequestTracking, 
  AuthenticationError,
  DatabaseError,
  ValidationError,
  AppError,
  type LogMessage,
  type ErrorHandler,
  type TypedRequest,
  type TypedErrorHandler
} from './lib/errorTracking';
import { requireAuth, optionalAuth } from './config/session';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app
const app = express();

// Define extended error types for better type safety
// Static file serving interfaces
interface StaticFileHeaders extends Record<string, string | undefined> {
  'Content-Type'?: string;
  'Cache-Control'?: string;
  'X-Content-Type-Options'?: string;
  'Pragma'?: string;
  'Expires'?: string;
  'ETag'?: string;
  'Last-Modified'?: string;
}

interface StaticFileOptions extends Omit<ServeStaticOptions, 'setHeaders'> {
  index: boolean;
  etag: boolean;
  lastModified: boolean;
  setHeaders: (res: ServerResponse<IncomingMessage>, filepath: string, stat: any) => void;
  maxAge?: number | string;
  immutable?: boolean;
}

interface StaticFileMetadata {
  request_headers: Record<string, string | string[] | undefined>;
  response_headers: StaticFileHeaders;
  path?: string;
  size?: number;
  mimeType?: string;
  encoding?: string;
  lastModified?: Date;
}

interface ExtendedError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  context?: {
    statusCode?: number;
    errorCode?: string;
    metadata?: StaticFileMetadata;
    requestId?: string;
    path?: string;
    method?: string;
    timestamp?: Date;
  };
}

interface StaticFileError extends ExtendedError {
  path?: string;
  error_message?: string;
  metadata?: StaticFileMetadata;
  syscall?: string;
  errno?: number;
  code?: 'ENOENT' | string;
}

interface StaticErrorLog extends Omit<LogMessage, "level"> {
  path?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

// Configure CORS options
const corsOptions: cors.CorsOptions = {
  origin: env.NODE_ENV === 'production'
    ? env.ALLOWED_ORIGINS || ['https://your-main-domain.com']
    : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Origin'],
  exposedHeaders: ['Content-Type', 'Content-Length', 'Set-Cookie', 'ETag', 'Cache-Control'],
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

import { securityHeaders, sanitizeInput, sessionSecurity } from './middleware/security';

// Initialize middleware
async function initializeMiddleware() {
  try {
    console.log('Starting middleware initialization...');
    
    // Environment-specific settings
    if (env.NODE_ENV === 'production') {
      console.log('Configuring production settings...');
      app.set('trust proxy', 1);
    } else {
      console.log('Configuring development settings...');
      app.set('json spaces', 2);
    }
    app.set('x-powered-by', false);
    
    console.log(`Server initializing in ${env.NODE_ENV} mode`);

    // Basic middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cors(corsOptions));


    // Initialize Firebase authentication middleware
    console.log('Setting up Firebase authentication middleware...');
    app.use(optionalAuth);
    console.log('Firebase authentication middleware configured successfully');


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

    // Configure static file serving
    if (env.NODE_ENV === 'production') {
      // Middleware to explicitly set content types
      app.use((req, res, next) => {
        const ext = path.extname(req.path).toLowerCase();
        if (ext === '.js' || ext === '.mjs') {
          res.type('application/javascript');
        } else if (ext === '.css') {
          res.type('text/css');
        } else if (ext === '.json') {
          res.type('application/json');
        }
        next();
      });

      // Static file serving options
      const staticOptions: StaticFileOptions = {
        index: false,
        etag: true,
        lastModified: true,
        setHeaders: (res: ServerResponse<IncomingMessage>, filepath: string) => {
          try {
            // Set secure headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            
            const ext = path.extname(filepath).toLowerCase();
            const cacheControl = (() => {
              if (ext === '.html') {
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                return 'no-cache, no-store, must-revalidate';
              }
              
              if (['.js', '.mjs', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg'].includes(ext)) {
                return 'public, max-age=31536000, immutable';
              }
              
              return 'public, max-age=86400';
            })();

            res.setHeader('Cache-Control', cacheControl);

            // Set content type for script and style files
            if (ext === '.js' || ext === '.mjs') {
              res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
            } else if (ext === '.css') {
              res.setHeader('Content-Type', 'text/css; charset=UTF-8');
            }
          } catch (err) {
            console.error('Error setting headers:', err);
          }
        }
      };

      // Serve static files with specific routes first
      app.use('/assets/js', express.static(path.join(publicPath, 'assets/js'), staticOptions));
      
      app.use('/assets/css', express.static(path.join(publicPath, 'assets/css'), staticOptions));

      app.use('/assets', express.static(path.join(publicPath, 'assets'), staticOptions));
      app.use(express.static(publicPath, staticOptions));

      // Add static file error handling middleware
      app.use((err: Error | StaticFileError, req: Request, res: Response, next: NextFunction) => {
        if (err && (req.path.startsWith('/assets/') || req.path.includes('.'))) {
          const errorDetails: StaticErrorLog = {
            message: 'Static file serving error',
            path: req.path,
            error_message: err.message,
            metadata: {
              request_headers: Object.fromEntries(Object.entries(req.headers)),
              response_headers: Object.fromEntries(Object.entries(res.getHeaders())),
              mime_type: req.get('Content-Type'),
              method: req.method
            }
          };
          
          error(errorDetails);
          
          if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
            return res.status(404).json({ 
              message: 'File not found',
              path: req.path,
              requestId: req.headers['x-request-id']
            });
          }
          
          return res.status(500).json({ 
            message: 'Error serving static file',
            requestId: req.headers['x-request-id']
          });
        }
        next(err);
      });
    } else {
      // In development, use Vite's built-in static serving
      const server = createServer(app);
      await setupVite(app, server);
    }

    info('Middleware initialized successfully');
  } catch (err) {
    error({
      message: 'Failed to initialize middleware',
      stack: err instanceof Error ? err.stack : undefined
    });
    throw err;
  }
}

// Setup error handlers
function setupErrorHandlers() {
  // Add request tracking
  app.use(initRequestTracking());

  // API route not found handler
  app.use('/api/*', (req: Request, res: Response) => {
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
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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
  app.use((err: Error | AppError, req: Request, res: Response, _next: NextFunction) => {
    const context = trackError(err, req, res);
    const statusCode = isAppError(err) && err.context.statusCode ? err.context.statusCode : 500;
    const response = {
      message: env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message,
      status: statusCode,
      requestId: context.requestId,
      ...(env.NODE_ENV === 'development' ? { 
        stack: err.stack,
        errorCode: isAppError(err) ? err.context.errorCode : 'UNKNOWN_ERROR'
      } : {})
    };

    res.status(statusCode).json(response);
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

function isAppError(error: Error | AppError): error is AppError {
  return 'context' in error && 
         typeof (error as AppError).context?.statusCode === 'number' &&
         typeof (error as AppError).context?.errorCode === 'string';
}

// Main application entry point
async function main() {
  const PORT = parseInt(process.env.PORT || '5000', 10);
  const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  let server: ReturnType<typeof createServer> | undefined;

  try {
    // Log environment and configuration
    info({
      message: 'Starting server initialization',
      metadata: {
        environment: env.NODE_ENV,
        port: PORT,
        database_url_exists: !!env.DATABASE_URL,
        app_url: env.APP_URL
      }
    });

    // Test database connection with retry mechanism
    let retries = 5;
    let backoff = 1000; // Start with 1 second

    info('Attempting database connection...');
    info({
      message: 'Database configuration',
      metadata: {
        database_url_exists: !!env.DATABASE_URL,
        database_url_masked: env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@'),
        node_env: env.NODE_ENV
      }
    });

    while (retries > 0) {
      try {
        const result = await db.execute(sql`
          SELECT 
            current_database() as db_name,
            current_schema as schema_name,
            version() as version,
            NOW() as timestamp
        `);
        
        const dbResult = result.rows[0];
        info({
          message: 'Database connection successful',
          metadata: {
            database: dbResult?.db_name,
            schema: dbResult?.schema_name,
            version: typeof dbResult?.version === 'string' ? dbResult.version.split(' ')[0] : undefined,
            timestamp: dbResult?.timestamp,
            attempt: 6 - retries
          }
        });
        break;
      } catch (err) {
        retries--;
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorDetails = {
          name: err instanceof Error ? err.name : 'UnknownError',
          code: (err as any)?.code,
          errno: (err as any)?.errno,
          syscall: (err as any)?.syscall
        };
        
        warn({
          message: `Database connection attempt failed`,
          metadata: {
            attempt: 6 - retries,
            remaining_attempts: retries,
            error: errorMessage,
            details: errorDetails,
            backoff_seconds: backoff/1000
          }
        });
        
        if (retries === 0) {
          error({
            message: 'All database connection attempts failed',
            metadata: {
              final_error: errorMessage,
              error_details: errorDetails
            }
          });
          throw new Error(`Failed to connect to database after multiple attempts: ${errorMessage}`);
        }
        
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

    // Start server with fixed port
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        reject(new Error('Server initialization failed'));
        return;
      }

      // Always use port 5000 in production for consistency
      const serverPort = 5000;
      
      info(`Attempting to start server on port ${serverPort}`);
      
      server.on('error', (err: NodeJS.ErrnoException) => {
        error({
          message: 'Server startup error',
          metadata: {
            error: err.message,
            code: err.code,
            port: serverPort
          }
        });
        reject(err);
      });

      server.listen(serverPort, HOST, () => {
        const address = server!.address();
        const actualPort = typeof address === 'object' && address ? address.port : serverPort;
        
        info(`Server running in ${env.NODE_ENV} mode on port ${actualPort}`);
        info(`APP_URL: ${env.APP_URL}`);
        info(`Server is now listening on http://0.0.0.0:${actualPort}`);
        info('Server started successfully');
        resolve();
      });
    });

  } catch (err) {
    const errorLog: LogMessage = {
      message: 'Fatal error in server startup',
      metadata: {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString()
      }
    };
    error(errorLog);

    if (server?.listening) {
      info('Closing server due to startup error');
      await new Promise<void>((resolve) => {
        server!.close(() => {
          info('Server closed');
          resolve();
        });
      });
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
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, just log
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit, just log
});

try {
  console.log('Starting server initialization...');
  await main();
  console.log('Server started successfully');
} catch (err) {
  console.error('Fatal error starting server:', err);
  error({
    message: 'Fatal error starting server',
    metadata: {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString()
    }
  });
  
  // Give time for logs to flush
  await new Promise(resolve => setTimeout(resolve, 1000));
  process.exit(1);
}