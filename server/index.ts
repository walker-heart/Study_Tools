import express, { Request, Response, NextFunction, static as expressStatic } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import session from 'express-session';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mime from 'mime-types';
import { debug, error, info, warn } from './lib/logging';
import { env } from './config/env';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { setupVite } from './vite';
import { registerRoutes } from './routes';
import { createSessionConfig } from './config/session';
import { securityHeaders } from './middleware/security';
import { corsOptions } from './config/cors';
import { limiter } from './middleware/rateLimit';
import { sanitizeInput } from './middleware/sanitize';
import { sessionSecurity } from './middleware/session';
import { cleanupSessions } from './middleware/cleanup';
import { Server } from 'http';

// Define TypedRequest interface
interface TypedRequest extends Request {
  session: session.Session & {
    lastRotated?: Date;
  };
}

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.resolve(__dirname, '../dist/public');
const assetsPath = path.join(publicPath, 'assets');

// Ensure directories exist
[publicPath, assetsPath].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize middleware
async function initializeMiddleware() {
  try {
    if (env.NODE_ENV === 'production') {
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

    // Initialize session
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
    
    // Apply rate limiting
    app.use(limiter);
    
    // Apply parameter sanitization
    app.use(sanitizeInput);
    
    // Apply session security
    app.use(sessionSecurity);

    // Body parsing middleware
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

    // Ensure static directories exist
    [publicPath, assetsPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        info(`Created static directory: ${dir}`);
      }
    });

    // Configure static file serving
    if (env.NODE_ENV === 'production') {
      // Middleware to explicitly set content types
      app.use((req, res, next) => {
        const ext = path.extname(req.path).toLowerCase();
        if (ext === '.js') {
          res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        } else if (ext === '.css') {
          res.setHeader('Content-Type', 'text/css; charset=UTF-8');
        }
        next();
      });

      // Static file serving options
      const staticOptions = {
        index: false,
        etag: true,
        lastModified: true,
        setHeaders: (res: Response, filepath: string) => {
          // Determine content type using mime-types
          const mimeType = mime.lookup(filepath);
          if (mimeType) {
            const charset = mime.charset(mimeType);
            const contentType = charset 
              ? `${mimeType}; charset=${charset}`
              : mimeType;
            res.setHeader('Content-Type', contentType);
          }
          
          // Security headers
          res.setHeader('X-Content-Type-Options', 'nosniff');
          
          // Cache control based on file type and location
          const ext = path.extname(filepath).toLowerCase();
          if (ext === '.html') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (filepath.includes('/assets/')) {
            // Cache assets for 1 year
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            // Cache other static files for 1 day
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }

          // Log static file serving in development
          if (env.NODE_ENV !== 'production') {
            debug({
              message: 'Serving static file',
              path: filepath,
              contentType: res.getHeader('Content-Type'),
              cacheControl: res.getHeader('Cache-Control')
            });
          }
        }
      };

      // Serve static files with specific routes first
      app.use('/assets/js', expressStatic(path.join(publicPath, 'assets/js'), staticOptions));
      app.use('/assets/css', expressStatic(path.join(publicPath, 'assets/css'), staticOptions));
      app.use('/assets', expressStatic(path.join(publicPath, 'assets'), staticOptions));
      app.use(expressStatic(publicPath, staticOptions));

      // Add static file error logging middleware
      app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        if (err && req.path.startsWith('/assets/')) {
          error({
            message: 'Static file serving error',
            path: req.path,
            error_message: err.message,
            headers: req.headers,
            response_headers: res.getHeaders()
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
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      metadata: {
        operation: 'server_startup',
        NODE_ENV: env.NODE_ENV,
        port: PORT,
        app_url: env.APP_URL,
        public_path: publicPath,
        assets_path: assetsPath
      }
    });

    // Log directory status
    try {
      const publicExists = fs.existsSync(publicPath);
      const assetsExists = fs.existsSync(assetsPath);
      info({
        message: 'Directory status check',
        public_dir_exists: publicExists,
        assets_dir_exists: assetsExists,
        public_path: publicPath,
        assets_path: assetsPath
      });
    } catch (dirErr) {
      error({
        message: 'Error checking directories',
        error: dirErr instanceof Error ? dirErr.message : String(dirErr)
      });
    }

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