import express from "express";
import type { Request, Response, NextFunction } from "express";
import type { ServeStaticOptions } from 'serve-static';
import rateLimit from 'express-rate-limit';
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";
import { createServer } from "http";
import session from "express-session";
import type { Session, SessionData } from "express-session";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";
import { log, debug, info, warn, error } from "./lib/log";
import { createSessionConfig } from './config/session';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app
const app = express();

// Define extended error types for better type safety
// Static file serving types
interface StaticFileHeaders extends Record<string, string | undefined> {
  'Content-Type'?: string;
  'Cache-Control'?: string;
  'X-Content-Type-Options'?: string;
  'Pragma'?: string;
  'Expires'?: string;
  'ETag'?: string;
  'Last-Modified'?: string;
}

interface StaticFileOptions {
  index?: boolean | string;
  etag?: boolean;
  lastModified?: boolean;
  setHeaders?: (res: Response, path: string, stat: Stats) => void;
  maxAge?: number | string;
  immutable?: boolean;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  extensions?: string[];
  fallthrough?: boolean;
  redirect?: boolean;
}

// Import Stats type from fs
import { Stats } from 'fs';

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
  code?: string;
}

type ErrorHandler = (
  err: ExtendedError | StaticFileError,
  req: TypedRequest,
  res: Response,
  next: NextFunction
) => void;

interface LogMessage {
  message: string;
  error?: string;
  error_message?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
  path?: string;
  [key: string]: unknown;
}

interface StaticErrorLog extends LogMessage {
  error_type?: string;
  status_code?: number;
}

interface TypedRequest extends Omit<Request, 'session' | 'sessionID'> {
  session: Session & Partial<SessionData> & {
    user?: {
      id: string | number;
      [key: string]: any;
    };
  };
  sessionID: string;
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

    // Apply CORS with credentials first
    app.use(cors(corsOptions));

    // Apply basic security headers
    app.use(securityHeaders);

    // Body parsing middleware before other middleware
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

    // Apply general rate limiting for DoS protection
    app.use(limiter);
    
    // Apply parameter sanitization
    app.use(sanitizeInput);
    
    // Apply session security
    app.use(sessionSecurity);

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
        setHeaders: (res: Response, filepath: string) => {
          const ext = path.extname(filepath).toLowerCase();
          const headers: StaticFileHeaders = {
            'X-Content-Type-Options': 'nosniff'
          };
          
          // Cache control
          if (ext === '.html') {
            headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            headers['Pragma'] = 'no-cache';
            headers['Expires'] = '0';
          } else if (filepath.includes('/assets/')) {
            // Set correct MIME types for assets
            if (ext === '.js' || ext === '.mjs') {
              headers['Content-Type'] = 'application/javascript; charset=UTF-8';
            } else if (ext === '.css') {
              headers['Content-Type'] = 'text/css; charset=UTF-8';
            }
            headers['Cache-Control'] = 'public, max-age=31536000, immutable';
          } else {
            headers['Cache-Control'] = 'public, max-age=86400';
          }
          
          // Apply all headers
          Object.entries(headers).forEach(([key, value]) => {
            if (value) res.setHeader(key, value);
          });
        }
      };

      // Serve static files with specific routes first
      app.use('/assets/js', express.static(path.join(publicPath, 'assets/js'), staticOptions));
      
      app.use('/assets/css', express.static(path.join(publicPath, 'assets/css'), staticOptions));

      app.use('/assets', express.static(path.join(publicPath, 'assets'), staticOptions));
      app.use(express.static(publicPath, staticOptions));

      // Add static file error logging middleware
      app.use((err: Error | StaticFileError, req: Request, res: Response, next: NextFunction) => {
        if (err && req.path.startsWith('/assets/')) {
          error({
            message: 'Static file serving error',
            path: req.path,
            error_message: err.message,
            metadata: {
              request_headers: Object.fromEntries(Object.entries(req.headers)),
              response_headers: Object.fromEntries(Object.entries(res.getHeaders()))
            }
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
      res.sendFile(path.join(__dirname, '..', 'dist', 'public', 'index.html'));
    }
  });
}

// Main application entry point
async function main() {
  // Get port from environment or use default
  const basePort = parseInt(process.env.PORT || '5000', 10);
  const maxPort = basePort + 10; // Try up to 10 ports
  let currentPort = basePort;
  let server: ReturnType<typeof createServer> | undefined;

  // Function to check if a port is in use
  const isPortInUse = async (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const testServer = createServer();
      testServer.once('error', () => {
        resolve(true);
      });
      testServer.once('listening', () => {
        testServer.close();
        resolve(false);
      });
      testServer.listen(port, '0.0.0.0');
    });
  };

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

    try {
      info('Starting server initialization...');
      
      // Create HTTP server first
      server = createServer(app);
      info('HTTP server created');

      // Initialize middleware
      info('Initializing middleware...');
      await initializeMiddleware();
      info('Middleware initialized successfully');

      // Register routes
      info('Registering routes...');
      registerRoutes(app);
      info('Routes registered successfully');

      // Setup error handlers
      info('Configuring error handlers...');
      setupErrorHandlers();
      info('Error handlers configured successfully');

    } catch (initError) {
      error({
        message: 'Server initialization failed',
        error_message: initError instanceof Error ? initError.message : String(initError),
        stack: initError instanceof Error ? initError.stack : undefined
      });
      
      // Cleanup server if it exists
      if (server?.listening) {
        try {
          await new Promise<void>((resolve) => server!.close(() => resolve()));
          info('Server closed successfully after error');
        } catch (closeError) {
          error({
            message: 'Failed to close server after initialization error',
            error_message: closeError instanceof Error ? closeError.message : String(closeError)
          });
        }
      }
      throw initError;
    }


    // Function to try starting the server on a specific port
    const tryPort = (port: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!server) {
          reject(new Error('Server initialization failed'));
          return;
        }

        const onError = (err: NodeJS.ErrnoException) => {
          server?.removeListener('error', onError);
          server?.removeListener('listening', onListening);
          
          if (err.code === 'EADDRINUSE') {
            if (port < maxPort) {
              warn(`Port ${port} is in use, trying ${port + 1}`);
              resolve(tryPort(port + 1));
            } else {
              reject(new Error(`Unable to find an available port (tried ${currentPort}-${maxPort})`));
            }
          } else {
            error(`Server error: ${err.message}`);
            reject(err);
          }
        };

        const onListening = () => {
          server?.removeListener('error', onError);
          server?.removeListener('listening', onListening);
          currentPort = port;
          info(`Server running in ${env.NODE_ENV} mode on port ${port}`);
          info(`APP_URL: ${env.APP_URL}`);
          resolve();
        };

        server.once('error', onError);
        server.once('listening', onListening);
        
        try {
          server.listen(port, '0.0.0.0');
        } catch (e) {
          reject(e);
        }
      });
    };

    // Cleanup any existing server instance
    if (server?.listening) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }

    // Start server with port retry mechanism
    await tryPort(currentPort);

  } catch (err) {
    error({
      message: 'Fatal error in server startup',
      stack: err instanceof Error ? err.stack : String(err)
    });

    // Ensure server is properly closed on error
    if (server?.listening) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    
    process.exit(1);
  }

  // Handle cleanup on process termination
  const cleanup = async () => {
    if (server?.listening) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    process.exit(0);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

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