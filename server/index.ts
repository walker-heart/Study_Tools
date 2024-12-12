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

// Define static serving paths
const rootDir = process.cwd();
const publicPath = path.join(rootDir, 'dist', 'public');
const assetsPath = path.join(publicPath, 'assets');

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

    // Ensure static directories exist before serving
    [publicPath, assetsPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        info(`Created static directory: ${dir}`);
      }
    });
    
    // Log static serving configuration
    info({
      message: 'Configuring static file serving',
      metadata: {
        rootDir,
        publicPath,
        assetsPath,
        mode: env.NODE_ENV
      }
    });

    // Configure static file serving with better error handling
    const serveStaticWithLogging = (staticPath: string, options: ServeStaticOptions) => {
      // Ensure the static directory exists
      try {
        if (!fs.existsSync(staticPath)) {
          fs.mkdirSync(staticPath, { recursive: true });
          info(`Created static directory: ${staticPath}`);
        }
        fs.accessSync(staticPath, fs.constants.R_OK);
        debug(`Static directory verified: ${staticPath}`);
      } catch (err) {
        error({
          message: 'Static directory setup failed',
          error_message: err instanceof Error ? err.message : String(err),
          metadata: {
            path: staticPath,
            operation: 'static_directory_setup',
            status: 500
          }
        });
        // Don't throw, just log the error and continue
        warn(`Static directory ${staticPath} not accessible, will attempt to serve files anyway`);
      }

      const staticHandler = express.static(staticPath, {
        ...options,
        fallthrough: true, // Allow falling through to next middleware if file not found
        setHeaders: (res: Response, filePath: string) => {
          const ext = path.extname(filePath).toLowerCase();
          // Set appropriate content type
          switch (ext) {
            case '.js':
              res.setHeader('Content-Type', 'application/javascript');
              break;
            case '.css':
              res.setHeader('Content-Type', 'text/css');
              break;
            case '.html':
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              break;
            case '.json':
              res.setHeader('Content-Type', 'application/json');
              break;
            // Add other content types as needed
          }

          // Set caching headers
          if (env.NODE_ENV === 'production') {
            if (ext === '.html') {
              // Don't cache HTML files
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
            } else {
              // Cache static assets for 1 year
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
          } else {
            // Disable caching in development
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }

          // Security headers
          res.setHeader('X-Content-Type-Options', 'nosniff');
        }
      });

      return (req: Request, res: Response, next: NextFunction) => {
        if (env.NODE_ENV === 'development') {
          debug(`Static file request: ${req.path}`);
        }
        
        staticHandler(req, res, (err) => {
          if (err) {
            error({
              message: 'Static file serving error',
              error_message: err instanceof Error ? err.message : String(err),
              metadata: {
                path: req.path,
                operation: 'static_file_serve',
                status: 500,
                staticPath,
                fullPath: path.join(staticPath, req.path)
              }
            });
          }
          // Always call next() to allow falling through to other handlers
          next(err);
        });
      };
    };

    // Ensure static directories exist
    [publicPath, path.join(publicPath, 'assets')].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        info(`Created static directory: ${dir}`);
      }
    });

    // Serve static assets with appropriate cache headers
    const staticOptions = {
      etag: true,
      lastModified: true,
      fallthrough: true,
      ...(env.NODE_ENV === 'production' ? {
        maxAge: '30d',
        immutable: true
      } : {
        maxAge: 0
      })
    };

    // Configure static file serving
    if (env.NODE_ENV === 'production') {
      // Helper function to serve static files with proper MIME types and caching
      const serveStaticWithMime = (staticPath: string, urlPath: string) => {
        debug(`Setting up static serving for ${urlPath} from ${staticPath}`);
        
        // Verify directory exists
        if (!fs.existsSync(staticPath)) {
          fs.mkdirSync(staticPath, { recursive: true });
          info(`Created static directory: ${staticPath}`);
        }

        return express.static(staticPath, {
          index: false,
          etag: true,
          lastModified: true,
          dotfiles: 'ignore',
          fallthrough: true,
          setHeaders: (res, filepath) => {
            const ext = path.extname(filepath).toLowerCase();
            
            // Set content type based on file extension
            switch (ext) {
              case '.js':
                res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
                break;
              case '.css':
                res.setHeader('Content-Type', 'text/css; charset=UTF-8');
                break;
              case '.html':
                res.setHeader('Content-Type', 'text/html; charset=UTF-8');
                break;
              case '.json':
                res.setHeader('Content-Type', 'application/json; charset=UTF-8');
                break;
              case '.png':
                res.setHeader('Content-Type', 'image/png');
                break;
              case '.jpg':
              case '.jpeg':
                res.setHeader('Content-Type', 'image/jpeg');
                break;
              case '.svg':
                res.setHeader('Content-Type', 'image/svg+xml');
                break;
              case '.woff2':
                res.setHeader('Content-Type', 'font/woff2');
                break;
              case '.woff':
                res.setHeader('Content-Type', 'font/woff');
                break;
              case '.ttf':
                res.setHeader('Content-Type', 'font/ttf');
                break;
            }

            // Set caching headers
            if (ext === '.html') {
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
            } else if (urlPath.startsWith('/assets/')) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
              res.setHeader('Cache-Control', 'public, max-age=86400');
            }

            // Security headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
          }
        });
      };

      // Serve static files with detailed error logging
      app.use((req, res, next) => {
        const staticHandler = serveStaticWithMime(publicPath, req.path);
        staticHandler(req, res, (err) => {
          if (err) {
            error({
              message: 'Static file serving error',
              error_message: err instanceof Error ? err.message : String(err),
              metadata: {
                path: req.path,
                fullPath: path.join(publicPath, req.path),
                method: req.method,
                headers: req.headers,
                operation: 'static_file_serve'
              }
            });
          }
          next(err);
        });
      });

      // Serve assets from specific directories with their own handlers
      const assetPaths = {
        '/assets/js': path.join(publicPath, 'assets', 'js'),
        '/assets/css': path.join(publicPath, 'assets', 'css'),
        '/assets': path.join(publicPath, 'assets')
      };

      Object.entries(assetPaths).forEach(([urlPath, fsPath]) => {
        app.use(urlPath, (req, res, next) => {
          const staticHandler = serveStaticWithMime(fsPath, urlPath);
          staticHandler(req, res, (err) => {
            if (err) {
              error({
                message: `Asset serving error for ${urlPath}`,
                error_message: err instanceof Error ? err.message : String(err),
                metadata: {
                  path: req.path,
                  fullPath: path.join(fsPath, req.path),
                  urlPath,
                  operation: 'asset_serve'
                }
              });
            }
            next(err);
          });
        });
      });
    } else {
      // In development, let Vite handle the static files
      app.use('/assets', serveStaticWithLogging(assetsPath, {
        ...staticOptions,
        index: false
      }));
      
      app.use(serveStaticWithLogging(publicPath, {
        ...staticOptions,
        index: false
      }));
    }

    // Final handler for static files
    app.use((err: Error, req: TypedRequest, res: Response, next: NextFunction) => {
      if (err.message?.includes('ENOENT') || err.message?.includes('not found')) {
        const isAssetRequest = req.path.startsWith('/assets/');
        
        error({
          message: isAssetRequest ? 'Static asset not found' : 'Static file not found',
          error_message: err.message,
          metadata: {
            path: req.path,
            status: 404,
            operation: 'static_file_serve',
            isAssetRequest,
            publicPath,
            fullPath: path.join(publicPath, req.path)
          }
        });
        
        if (isAssetRequest) {
          res.status(404).json({ 
            message: 'Asset not found',
            path: req.path,
            error: env.NODE_ENV === 'development' ? err.message : undefined
          });
        } else {
          // For non-asset routes, serve index.html for client-side routing
          const indexPath = path.join(publicPath, 'index.html');
          
          // Check if index.html exists first
          fs.access(indexPath, fs.constants.R_OK, (accessErr) => {
            if (accessErr) {
              error({
                message: 'index.html not found or not readable',
                error_message: accessErr.message,
                metadata: {
                  path: indexPath,
                  operation: 'serve_index_html',
                  status: 500
                }
              });
              res.status(500).json({ message: 'Error serving page' });
              return;
            }
            
            res.sendFile(indexPath, (sendErr) => {
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
    
    const response: {
      message: string;
      status: number;
      requestId?: string;
      stack?: string;
      errorCode?: string;
    } = {
      message: env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message,
      status
    };

    if (context.requestId) {
      response.requestId = context.requestId;
    }

    if (env.NODE_ENV === 'development') {
      response.stack = err.stack;
      response.errorCode = 'context' in err && err.context?.errorCode 
        ? err.context.errorCode 
        : 'UNKNOWN_ERROR';
    }

    res.status(status).json(response);
  });

  // Handle client-side routing for non-API routes
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // Skip API routes and static asset requests
    if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
      return next();
    }

    const indexPath = path.join(publicPath, 'index.html');
    
    // Verify index.html exists and is readable
    try {
      fs.accessSync(indexPath, fs.constants.R_OK);
      
      // Send index.html with appropriate headers
      res.sendFile(indexPath, {
        maxAge: '0',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }, (err) => {
        if (err) {
          error({
            message: 'Error sending index.html',
            error_message: err.message,
            metadata: {
              path: req.path,
              operation: 'serve_index_html',
              indexPath
            }
          });
          if (!res.headersSent) {
            res.status(500).send('Server error: Failed to serve application');
          }
        }
      });
    } catch (err) {
      error({
        message: 'index.html not found or not readable',
        error_message: err instanceof Error ? err.message : String(err),
        metadata: {
          path: indexPath,
          operation: 'serve_index_html'
        }
      });
      if (!res.headersSent) {
        res.status(500).send('Server error: Application files not found');
      }
    }
  });
}

// Main application entry point
async function main() {
  const PORT = parseInt(process.env.PORT || '5000', 10);
  let server: ReturnType<typeof createServer> | undefined;

  try {
    // Test database connection with retry mechanism
    const MAX_RETRIES = 5;
    let retries = MAX_RETRIES;
    let backoff = 1000; // Start with 1 second

    while (retries > 0) {
      try {
        await db.execute(sql`SELECT NOW()`);
        info('Database connection successful');
        break;
      } catch (err) {
        retries--;
        const isLastAttempt = retries === 0;
        
        if (isLastAttempt) {
          error({
            message: 'Failed to connect to database after multiple attempts',
            error_message: err instanceof Error ? err.message : String(err),
            metadata: {
              operation: 'database_connection',
              attempts: MAX_RETRIES,
              status: 500
            }
          });
          throw new Error('Failed to connect to database after multiple attempts');
        }

        warn({
          message: `Database connection failed, retrying in ${backoff/1000} seconds...`,
          error_message: err instanceof Error ? err.message : String(err),
          metadata: {
            operation: 'database_connection',
            attempt: MAX_RETRIES - retries,
            next_retry: `${backoff/1000} seconds`
          }
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
