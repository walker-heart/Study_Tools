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
import session from "express-session";
import passport from "passport";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";
import { log, debug, info, warn, error } from "./lib/log";
import { createSessionConfig } from './config/session';
import googleAuthRouter from './auth/google';
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
  origin: (origin: string | undefined, callback: (err: Error | null, origin?: boolean | string | RegExp | (string | RegExp)[]) => void) => {
    const allowedOrigins = [
      'https://www.wtoolsw.com',
      'https://wtoolsw.com',
      'http://localhost:3000',
      'http://0.0.0.0:3000',
      'https://accounts.google.com',
      /^https?:\/\/accounts\.google\.com$/,
      /^https?:\/\/.*\.wtoolsw\.com$/,
      /^https?:\/\/.*\.google\.com$/
    ];
    
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin || origin === 'null') {
      callback(null, true);
      return;
    }

    // Always allow in development mode
    if (env.NODE_ENV !== 'production') {
      callback(null, true);
      return;
    }

    // Allow static asset requests
    if (/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/.test(origin)) {
      callback(null, true);
      return;
    }

    // Check if the origin is in our allowed list
    const isAllowed = allowedOrigins.some(allowed => 
      typeof allowed === 'string' 
        ? allowed === origin 
        : allowed.test(origin)
    );

    if (isAllowed) {
      callback(null, true);
    } else {
      // Log the blocked origin but don't expose details in production
      warn({
        message: 'CORS blocked origin',
        metadata: {
          origin,
          allowedOrigins: env.NODE_ENV === 'development' as string
            ? allowedOrigins.map(o => o.toString())
            : undefined
        }
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Cache-Control', 
    'Origin',
    'X-CSRF-Token'
  ],
  exposedHeaders: [
    'Content-Type', 
    'Content-Length', 
    'Set-Cookie', 
    'ETag', 
    'Cache-Control',
    'X-CSRF-Token'
  ],
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
    // Basic express settings
    app.set('x-powered-by', false);
    app.set('trust proxy', 1);
    
    if (env.NODE_ENV !== 'production') {
      app.set('json spaces', 2);
      info('Server running in development mode with pretty JSON output');
    } else {
      info('Server running in production mode');
    }
    
    info(`Server initializing in ${env.NODE_ENV} mode`);

    try {
      info('Initializing middleware...');
      
      // Initialize essential middleware first
      app.use(express.json({ limit: '10mb' }));
      app.use(express.urlencoded({ extended: true, limit: '10mb' }));
      info('Basic middleware initialized');

      // Security middleware
      app.use(cors(corsOptions));
      app.use(securityHeaders);
      info('Security middleware initialized');

      // Session configuration
      const sessionConfig = await createSessionConfig();
      if (!sessionConfig) {
        throw new Error('Failed to create session configuration');
      }
      app.use(session(sessionConfig));
      app.use(cleanupSessions);
      app.use(sessionSecurity);
      
      // Initialize Passport and restore authentication state from session
      app.use(passport.initialize());
      app.use(passport.session());
      info('Session and Passport middleware initialized');
      
      // Mount Google authentication routes
      app.use('/api/auth/google', googleAuthRouter);

      // Rate limiting
      app.use(limiter);
      info('Rate limiting middleware initialized');

      // Input sanitization
      app.use(sanitizeInput);
      info('Input sanitization middleware initialized');

      info('All middleware initialized successfully');
    } catch (err) {
      error({
        message: 'Middleware initialization failed',
        metadata: {
          error: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined
        }
      });
      throw err;
    }

    // Static file serving setup
    const publicPath = path.resolve(__dirname, '..', 'dist', 'public');
    
    if (env.NODE_ENV === 'production') {
      // Ensure public directory exists
      if (!fs.existsSync(publicPath)) {
        info('Creating public directory');
        fs.mkdirSync(publicPath, { recursive: true });
      }
      
      // Configure static file serving for production
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

      // Serve static files with specific routes and proper error handling
      const serveStaticWithErrorHandling = (route: string, dir: string) => {
        app.use(route, express.static(dir, staticOptions));
        
        // Add specific error handler for this route
        app.use(route, (err: Error | StaticFileError, req: Request, res: Response, next: NextFunction) => {
          if (!err) {
            next();
            return;
          }

          const errorDetails: StaticErrorLog = {
            message: 'Static file serving error',
            path: req.path,
            error_message: err.message,
            metadata: {
              request_headers: Object.fromEntries(Object.entries(req.headers)),
              response_headers: Object.fromEntries(Object.entries(res.getHeaders())),
              mime_type: req.get('Content-Type'),
              method: req.method,
              route
            }
          };
          
          error(errorDetails);
          
          if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
            // Try to serve index.html for client-side routing
            if (!req.path.includes('.')) {
              res.sendFile(path.join(publicPath, 'index.html'));
              return;
            }
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
        });
      };

      // Set up static file serving for different asset types
      serveStaticWithErrorHandling('/assets/js', path.join(publicPath, 'assets', 'js'));
      serveStaticWithErrorHandling('/assets/css', path.join(publicPath, 'assets', 'css'));
      serveStaticWithErrorHandling('/assets', path.join(publicPath, 'assets'));
      serveStaticWithErrorHandling('/', publicPath);
    } else {
      // Development mode setup
      info('Setting up development environment with Vite');
      try {
        const server = createServer(app);
        await setupVite(app, server);
        info('Vite middleware initialized successfully');
      } catch (err) {
        error({
          message: 'Failed to initialize Vite middleware',
          metadata: {
            error: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined
          }
        });
        throw err;
      }
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
  // Find an available port starting from the specified port
  async function getAvailablePort(startPort: number): Promise<number> {
    const net = await import('net');
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      
      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          server.close();
          resolve(getAvailablePort(startPort + 1));
        } else {
          reject(err);
        }
      });

      server.listen(startPort, '0.0.0.0', () => {
        const address = server.address();
        server.close(() => {
          if (address && typeof address === 'object') {
            resolve(address.port);
          } else {
            resolve(startPort);
          }
        });
      });
    });
  }

  const initialPort = parseInt(process.env.PORT || '3000', 10);
  let server: ReturnType<typeof createServer>;
  
  // Get an available port and create the server
  const PORT = await getAvailablePort(initialPort);
  info(`Attempting to start server on port ${PORT}`);
  
  // Create the server instance
  server = createServer(app);
  
  try {
    // Test database connection
    await db.execute(sql`SELECT NOW()`);
    info('Database connection successful');

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
    
    // Start the server with enhanced error handling and logging
    await new Promise<void>((resolve, reject) => {
      const handleError = (err: NodeJS.ErrnoException) => {
        error({
          message: 'Server startup error',
          metadata: {
            error: err.message,
            code: err.code,
            port: PORT,
            stack: err.stack
          }
        });
        reject(err);
      };

      info({
        message: 'Attempting to start server',
        metadata: {
          port: PORT,
          environment: env.NODE_ENV,
          nodeVersion: process.version
        }
      });

      server.on('error', handleError);
      
      server.listen(PORT, '0.0.0.0', () => {
        const address = server.address();
        if (!address || typeof address !== 'object') {
          handleError(new Error('Failed to get server address'));
          return;
        }
        
        info({
          message: 'Server started successfully',
          metadata: {
            port: address.port,
            address: address.address,
            url: `http://0.0.0.0:${address.port}`
          }
        });
        
        resolve();
      });
    });

  } catch (err) {
    const errorLog: Omit<LogMessage, "level"> = {
      message: 'Fatal error in server startup',
      metadata: {
        errorMessage: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString()
      }
    };
    error(errorLog);

    // Safely handle server cleanup
    if (server) {
      info('Closing server due to startup error');
      try {
        await new Promise<void>((resolve) => {
          if (server.listening) {
            server.close((err) => {
              if (err) {
                error({
                  message: 'Error closing server',
                  metadata: { error: err.message }
                });
              }
              info('Server closed');
              resolve();
            });
          } else {
            resolve();
          }
        });
      } catch (closeError) {
        error({
          message: 'Error during server cleanup',
          metadata: {
            error: closeError instanceof Error ? closeError.message : String(closeError)
          }
        });
      }
    }

    throw err;
  }
}

// Start server with retries
async function startWithRetries(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      info(`Starting server attempt ${attempt}/${maxRetries}`);
      await main();
      return;
    } catch (err) {
      error({
        message: `Server start attempt ${attempt} failed`,
        metadata: {
          errorMessage: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          timestamp: new Date().toISOString()
        }
      });
      
      if (attempt === maxRetries) {
        process.exit(1);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Start the server
startWithRetries();