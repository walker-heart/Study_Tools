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
// Configure CORS middleware with simpler setup for development
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://www.wtoolsw.com',
      'https://wtoolsw.com',
      'https://wtoolsw.repl.co'
    ];
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) {
      callback(null, true);
      return;
    }
    // Allow all origins in development
    if (env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }
    // Check against allowed origins
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      log(`CORS blocked origin: ${origin}`);
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
    'Origin'
  ],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // 24 hours in seconds
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle OPTIONS preflight requests
app.options('*', cors(corsOptions));

// Log all requests for debugging
app.use((req, res, next) => {
  log(`${req.method} ${req.url}`);
  if (env.NODE_ENV === 'development') {
    log('Headers: ' + JSON.stringify(req.headers));
  }
  next();
});

// Add security headers
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Configure static file serving
const publicPath = path.join(__dirname, '..', 'dist', 'public');
const clientPublicPath = path.join(__dirname, '..', 'client', 'public');

log(`Serving static files from build: ${publicPath}`);
log(`Serving static files from client: ${clientPublicPath}`);

// Serve manifest and favicon files first
app.use(express.static(clientPublicPath, {
  index: false,
  etag: true,
  lastModified: true,
  maxAge: '1d',
  dotfiles: 'ignore',
  fallthrough: true
}));

// Then serve the build output
app.use(express.static(publicPath, {
  index: false,
  etag: true,
  lastModified: true,
  maxAge: '1d',
  dotfiles: 'ignore',
  fallthrough: true
}));

// Configure request size limits and parsers after static files
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file error handler with improved error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err) {
    log(`Static file error for ${req.url}: ${err.message}`);
    if (err.code === 'ENOENT') {
      // For missing files, continue to next handler
      next();
    } else {
      // For other errors, send error response
      res.status(500).json({ 
        error: 'Static file error',
        message: env.NODE_ENV === 'development' ? err.message : 'Internal server error'
      });
    }
  } else {
    next();
  }
});

// Configure request size limits and parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Configure PostgreSQL pool for session store
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Configure proxy settings based on environment
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // trust first proxy
}

// Session configuration with improved error handling
const sessionConfig: session.SessionOptions = {
  store: new (connectPgSimple(session))({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // 15 minutes
    errorLog: (err: Error) => {
      log(`Session store error: ${err.message}`);
      if (env.NODE_ENV === 'development') {
        log(err.stack || 'No stack trace available');
      }
    }
  }),
  name: 'sid',
  secret: env.JWT_SECRET!,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  rolling: true,
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
    ...(env.NODE_ENV === 'production' && {
      domain: '.wtoolsw.com'
    })
  }
};

// Single, comprehensive session configuration log
log('Session configuration: ' + JSON.stringify({
  environment: env.NODE_ENV,
  store: 'PostgreSQL',
  cookieSecure: sessionConfig.cookie?.secure,
  cookieSameSite: sessionConfig.cookie?.sameSite,
  cookieDomain: sessionConfig.cookie?.domain,
  trustProxy: app.get('trust proxy')
}, null, 2));

// Test database connection before applying session middleware
pool.query('SELECT NOW()', (err) => {
  if (err) {
    log(`Database connection error: ${err.message}`);
    throw err; // Fail fast if database connection fails
  }
  log('Database connection successful');
  
  // Apply session middleware after successful database connection
  app.use(session(sessionConfig));
});

app.use(session(sessionConfig));

// Add session error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ message: 'Invalid token' });
  } else {
    next(err);
  }
});

// Add static file error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'ENOENT') {
    log(`Static file not found: ${req.url}`);
    next();
  } else {
    next(err);
  }
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
    // Check required environment variables
    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      log(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
      throw new Error('Missing required environment variables');
    }

    // Verify database connection first
    try {
      await db.execute(sql`SELECT 1`);
      log('Database connection successful');
    } catch (error) {
      log('Error connecting to database: ' + error);
      throw error;
    }

    // Register routes after successful database connection
    registerRoutes(app);
    
    const server = createServer(app);

    // Configure environment-specific settings
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
      app.get('*', (_req, res) => {
        res.sendFile(path.join(__dirname, '..', 'dist', 'public', 'index.html'));
      });
    }

    // Generic error handler
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      const status = (err.status || err.statusCode || 500);
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    // Start the server
    const PORT = parseInt(process.env.PORT || '5000', 10);
    server.listen(PORT, '0.0.0.0', () => {
      log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      log(`APP_URL: ${env.APP_URL}`);
    });
  } catch (error) {
    log(`Fatal error during server startup: ${error}`);
    process.exit(1);
  }
})();
