import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";
import { createServer } from "http";
import session, { Session, SessionData } from "express-session";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { db } from "./db";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";
import { log, info, warn, error } from "./lib/log";
import { createSessionConfig } from './config/session';
import { securityHeaders, sanitizeInput, sessionSecurity, cleanupSessions } from './middleware/security';
import rateLimit from 'express-rate-limit';
import fs from "fs";
import type { ServeStaticOptions } from 'serve-static';
import type { ServerResponse } from 'http';
import type { IncomingMessage } from 'http';
import { Stats } from 'fs';

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


async function findAvailablePort(startPort: number): Promise<number> {
  const maxPort = startPort + 10; // Try up to 10 ports
  let lastError: Error | undefined;
  
  for (let port = startPort; port <= maxPort; port++) {
    try {
      const server = createServer();
      await new Promise<void>((resolve, reject) => {
        // Set a timeout to avoid hanging
        const timeout = setTimeout(() => {
          server.close();
          reject(new Error(`Timeout while checking port ${port}`));
        }, 3000);

        server.once('error', (err: NodeJS.ErrnoException) => {
          clearTimeout(timeout);
          if (err.code === 'EADDRINUSE') {
            server.close();
            resolve(); // Port is in use, try next one
          } else {
            server.close();
            reject(err);
          }
        });

        server.once('listening', () => {
          clearTimeout(timeout);
          server.close(() => resolve());
        });

        // Explicitly set keepAlive to false and timeout to 1000ms
        server.on('connection', socket => {
          socket.setKeepAlive(false);
          socket.setTimeout(1000);
        });

        try {
          server.listen(port, '0.0.0.0');
        } catch (err) {
          clearTimeout(timeout);
          server.close();
          reject(err);
        }
      });
      
      // If we get here, the port is available
      return port;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      warn({
        message: `Port ${port} check failed`,
        error: lastError.message
      });
      continue;
    }
  }
  
  throw new Error(`No available ports found between ${startPort} and ${maxPort}. Last error: ${lastError?.message}`);
}

async function startServer(initialPort: number): Promise<void> {
  let server: ReturnType<typeof createServer> | null = null;
  
  try {
    // Test database connection
    await db.execute(sql`SELECT NOW()`);
    info('Database connection successful');

    // Initialize session configuration first
    const sessionConfig = await createSessionConfig();
    if (!sessionConfig) {
      throw new Error('Failed to create session configuration');
    }
    app.use(session(sessionConfig));
    
    // Add session cleanup middleware
    app.use(cleanupSessions);

    // Find available port
    const port = await findAvailablePort(initialPort);
    info(`Found available port: ${port}`);
    
    // Create HTTP server instance
    server = createServer(app);

    // Configure CORS
    app.use(cors({
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
    }));

    // Basic security headers
    app.use(securityHeaders);

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

    // Apply general rate limiting for DoS protection
    app.use(limiter);

    // Input sanitization
    app.use(sanitizeInput);
    
    // Session security
    app.use(sessionSecurity);

    // Static file serving with proper caching
    const publicPath = path.resolve(__dirname, '..', 'dist', 'public');
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true });
    }

    // Configure static file serving
    if (env.NODE_ENV === 'production') {
      const staticOptions: ServeStaticOptions = {
        etag: true,
        lastModified: true,
        setHeaders: (res: ServerResponse<IncomingMessage>, filepath: string, stat: Stats) => {
          const ext = path.extname(filepath).toLowerCase();
          
          // Set proper content types
          if (ext === '.js' || ext === '.mjs') {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
          } else if (ext === '.css') {
            res.setHeader('Content-Type', 'text/css; charset=UTF-8');
          }
          
          // Set caching headers
          res.setHeader('X-Content-Type-Options', 'nosniff');
          if (ext === '.html') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else {
            // Cache assets for 1 year
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }

          // Set ETag and Last-Modified headers
          if (stat) {
            res.setHeader('Last-Modified', stat.mtime.toUTCString());
          }
        }
      };

      // Ensure the public directory exists
      if (!fs.existsSync(publicPath)) {
        fs.mkdirSync(publicPath, { recursive: true });
      }

      // Serve static files
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

    // Register routes
    registerRoutes(app);

    // Start server with proper error handling and cleanup
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        reject(new Error('Server was not properly initialized'));
        return;
      }

      const cleanup = () => {
        if (server) {
          server.removeAllListeners();
          if (server.listening) {
            server.close();
          }
        }
      };

      // Handle server startup errors
      server.once('error', (err: NodeJS.ErrnoException) => {
        cleanup();
        if (err.code === 'EADDRINUSE') {
          error({
            message: 'Port is already in use',
            error: err.message,
            port: port
          });
        } else {
          error({
            message: 'Server startup error',
            error: err.message,
            code: err.code
          });
        }
        reject(err);
      });

      // Handle successful startup
      server.once('listening', () => {
        const address = server.address();
        const actualPort = typeof address === 'object' && address ? address.port : port;
        info(`Server running on port ${actualPort}`);
        resolve();
      });

      // Bind to all interfaces with a clean error handler
      try {
        server.listen(port, '0.0.0.0');
      } catch (err) {
        cleanup();
        reject(err);
      }
    });

    // Handle graceful shutdown
    const signals = ['SIGTERM', 'SIGINT'] as const;
    signals.forEach((signal) => {
      process.once(signal, () => {
        info(`${signal} received, shutting down gracefully`);
        if (server.listening) {
          server.close(() => {
            info('Server closed');
            process.exit(0);
          });
        } else {
          process.exit(0);
        }
      });
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    error({
      message: 'Server startup failed',
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined
    });
    
    // Ensure we cleanup any partially initialized resources
    if (server && server.listening) {
      server.close();
    }
    
    throw err;
  }
}

// Start the server with retries
const PORT = parseInt(process.env.PORT || '5001', 10);
const MAX_RETRIES = 3;
let retryCount = 0;

async function attemptServerStart() {
  while (retryCount < MAX_RETRIES) {
    try {
      await startServer(PORT + retryCount);
      // If successful, break out of the retry loop
      break;
    } catch (err) {
      retryCount++;
      error({
        message: `Server start attempt ${retryCount} failed`,
        error: err instanceof Error ? err.message : 'Unknown error',
        nextPort: PORT + retryCount
      });

      if (retryCount === MAX_RETRIES) {
        error({
          message: 'Server failed to start after maximum retries',
          totalAttempts: MAX_RETRIES
        });
        process.exit(1);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
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

setupErrorHandlers();

try {
  attemptServerStart();
} catch (err) {
  error({
    message: 'Fatal error starting server',
    error: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined
  });
  process.exit(1);
}