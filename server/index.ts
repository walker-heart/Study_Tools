import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pkg from 'pg';
const { Pool } = pkg;
import { db } from "./db";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const pgSession = connectPgSimple(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [express] ${message}`);
}

const app = express();
// Configure CORS middleware
const allowedOrigins = [
  'https://wtoolsw.com',
  'https://wtoolsw.repl.co',
  'http://localhost:3000',
  'http://localhost:5000',
  /^https:\/\/.*\.repl\.co$/,
  /^https:\/\/.*\.spock\.replit\.dev$/
];

function isOriginAllowed(origin: string | undefined) {
  if (!origin) return true;
  return allowedOrigins.some(allowedOrigin => 
    allowedOrigin instanceof RegExp 
      ? allowedOrigin.test(origin)
      : allowedOrigin === origin
  );
}

const corsOptions: cors.CorsOptions = {
  origin: function(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    
    if (isOriginAllowed(origin)) {
      callback(null, origin);
    } else {
      console.error(`Origin ${origin} not allowed by CORS`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Origin'],
  exposedHeaders: ['Set-Cookie', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials', 'Content-Length'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours in seconds
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle OPTIONS preflight requests
app.options('*', cors(corsOptions));

// Add security headers and CORS handling
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Additional CORS headers for specific cases
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  
  next();
});

// Serve static files from the Vite build output
const publicPath = path.join(__dirname, '..', 'dist', 'public');
log(`Serving static files from: ${publicPath}`);

// Configure static file serving with proper CORS and caching
const staticOptions = {
  maxAge: '1h',
  etag: true,
  lastModified: true,
  setHeaders: (res: Response, path: string) => {
    // Set aggressive caching for assets
    const cacheControl = path.includes('/assets/') 
      ? 'public, max-age=31536000' // 1 year for assets
      : 'public, max-age=3600';    // 1 hour for other static files

    res.setHeader('Cache-Control', cacheControl);
    
    const origin = res.req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Range, Authorization, Cache-Control');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Vary', 'Origin');
    }
  }
};

// Serve the main public directory
app.use(express.static(publicPath, {
  ...staticOptions,
  index: false, // Let our router handle the index route
  fallthrough: true // Continue to next middleware if file not found
}));

// Explicitly serve assets directory with additional caching
app.use('/assets', express.static(path.join(publicPath, 'assets'), {
  ...staticOptions,
  immutable: true, // Never validate the cache for versioned assets
  fallthrough: true
}));

// Configure request size limits and parsers first
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Handle static file errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'ENOENT') {
    log(`Static file not found: ${req.url}`);
    next();
  } else {
    log(`Static file error: ${err.message}`);
    next(err);
  }
});

// Log static file paths for debugging
log(`Serving static files from: ${publicPath}`);
// Configure PostgreSQL pool for session store
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

interface PostgresError extends Error {
  code?: string;
}

// Test database connection with detailed error logging
pool.query('SELECT NOW()', (err: PostgresError | null) => {
  if (err) {
    console.error('Database connection error details:', {
      error: err.message,
      code: err.code,
      stack: err.stack,
      connectionString: env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@') // Mask password
    });
    log('Failed to connect to database. Check connection string and credentials.');
    process.exit(1); // Exit if we can't connect to database
  } else {
    log('Database connection successful');
  }
});

// Configure session middleware with enhanced debugging
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy
}

console.log('Configuring session store with database connection');
const pgStore = connectPgSimple(session);
const sessionConfig: session.SessionOptions = {
  store: new pgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // 15 minutes
    errorLog: (error: Error) => {
      console.error('Session store error:', error);
      log(`Session store error: ${error.message}`);
    }
  }),
  name: 'sid',
  secret: env.JWT_SECRET!,
  resave: false,
  saveUninitialized: false,
  proxy: env.NODE_ENV === 'production',
  rolling: true,
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  } as session.CookieOptions & {
    sameSite: 'none' | 'lax'
  }
};

// Add process-level error handling
process.on('uncaughtException', (error: Error) => {
  log(`Uncaught Exception: ${error.message}`);
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason: unknown) => {
  log(`Unhandled Rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
  console.error('Unhandled Rejection:', reason);
});

// Log session configuration for debugging
console.log('Session configuration:', {
  store: 'PostgreSQL',
  cookieSecure: sessionConfig.cookie?.secure,
  cookieSameSite: sessionConfig.cookie?.sameSite,
  environment: env.NODE_ENV,
  trustProxy: app.get('trust proxy')
});

app.use(session(sessionConfig));

interface ApplicationError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  originalError?: Error;
}

// Global error handling middleware
app.use((err: ApplicationError, req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const errorId = Math.random().toString(36).substring(7);
  
  log(`[${errorId}] Error handling request to ${req.path}: ${err.message}`);
  console.error(`[${errorId}] Request error:`, {
    timestamp,
    path: req.path,
    error: err.message,
    stack: err.stack,
    code: err.code,
    method: req.method,
    query: req.query,
    headers: req.headers,
    originalError: err.originalError
  });

  // Handle specific error types
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      message: 'Invalid token',
      errorId 
    });
  }

  if (err.code === 'ENOENT') {
    log(`[${errorId}] Static file not found: ${req.url}`);
    return next();
  }

  // Handle known error types with specific status codes
  const knownErrors: Record<string, number> = {
    'ValidationError': 400,
    'AuthenticationError': 401,
    'ForbiddenError': 403,
    'NotFoundError': 404,
    'ConflictError': 409,
    'RateLimitError': 429
  };

  const status = err.status || err.statusCode || knownErrors[err.name] || 500;
  const message = err.message || 'Internal Server Error';
  
  // Don't expose internal error details in production
  const response = {
    message,
    status,
    errorId,
    ...(env.NODE_ENV !== 'production' && { 
      stack: err.stack,
      code: err.code 
    })
  };

  res.status(status).json(response);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Validate required environment variables first
    const requiredEnvVars = {
      'DATABASE_URL': process.env.DATABASE_URL,
      'JWT_SECRET': process.env.JWT_SECRET,
      'NODE_ENV': process.env.NODE_ENV,
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      log(`Error: Missing required environment variables: ${missingVars.join(', ')}`);
      process.exit(1);
    }

    log('Environment variables validated successfully');

    // Verify database connection with enhanced error handling
    try {
      await db.execute(sql`SELECT 1`);
      log('Database connection test successful');
    } catch (error) {
      const err = error as Error;
      log('Database connection test failed:');
      console.error('Database Error Details:', {
        message: err.message,
        stack: err.stack,
        time: new Date().toISOString()
      });
      process.exit(1);
    }

    // Set up error handling middleware first
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      const status = (err.status || err.statusCode || 500);
      const message = err.message || "Internal Server Error";
      
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    // Register routes after error handling is set up
    registerRoutes(app);
    
    const server = createServer(app);

    // Configure environment-specific settings
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
      app.get('*', (_req, res) => {
        res.sendFile(path.join(__dirname, '..', 'dist', 'public', 'index.html'));
      });
    }

    // Start the server with enhanced logging
    const PORT = parseInt(process.env.PORT || '3000', 10);
    const VITE_PORT = parseInt(process.env.VITE_PORT || '5000', 10);
    
    log(`Environment: ${app.get("env")}`);
    log(`Attempting to start server on port ${PORT}...`);
    
    // Configure port based on environment
    const serverPort = app.get("env") === "development" ? PORT : VITE_PORT;
    
    // Add event listeners before starting the server
    server.on('error', (error: Error & { code?: string }) => {
      if (error.code === 'EADDRINUSE') {
        log(`Critical Error: Port ${serverPort} is already in use`);
        // Try alternative port in development
        if (app.get("env") === "development" && serverPort === PORT) {
          log(`Attempting to use alternative port ${VITE_PORT}...`);
          server.listen({
            port: VITE_PORT,
            host: '0.0.0.0'
          });
          return;
        }
      } else {
        log(`Critical Error starting server: ${error.message}`);
        console.error('Server start error details:', {
          error: error.message,
          stack: error.stack,
          code: error.code,
          time: new Date().toISOString()
        });
      }
      process.exit(1);
    });

    server.on('listening', () => {
      const addr = server.address();
      const actualPort = typeof addr === 'string' ? addr : addr?.port;
      log(`Server successfully bound to port ${actualPort}`);
      log(`Server running in ${app.get("env")} mode`);
      log(`APP_URL: ${env.APP_URL}`);
      log('Server startup sequence completed');
    });

    // Attempt to start the server
    try {
      server.listen({
        port: serverPort,
        host: '0.0.0.0'
      });
    } catch (error) {
      log(`Fatal error during server.listen(): ${error}`);
      console.error('Server listen error:', error);
      process.exit(1);
    }
  } catch (error) {
    log(`Fatal error during server startup: ${error}`);
    process.exit(1);
  }
})();
