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
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  maxAge: 86400 // 24 hours in seconds
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle OPTIONS preflight requests
app.options('*', cors(corsOptions));

// Add security headers
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Configure request size limits and parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add error handling middleware for JSON parsing
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError) {
    log('JSON Parse Error: ' + err.message);
    return res.status(400).json({ message: 'Invalid JSON' });
  }
  next(err);
});

// Configure static file serving from client/public
const clientPublicPath = path.join(__dirname, '..', 'client', 'public');
log(`Serving static files from: ${clientPublicPath}`);

// Serve files from client/public with explicit error handling
app.use(express.static(clientPublicPath, {
  index: false,
  fallthrough: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
}));

// In production, also serve from dist/public
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist', 'public');
  log(`Also serving static files from: ${distPath}`);
  app.use(express.static(distPath, {
    index: false,
    fallthrough: true,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }));
}

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

// Configure PostgreSQL pool for session store
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('Database connection error:', err);
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
    errorLog: console.error.bind(console, 'Session store error:')
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
    domain: undefined // Let browser set the cookie domain
  } as session.CookieOptions & {
    sameSite: 'none' | 'lax'
  }
};

// Log session configuration for debugging
console.log('Session configuration:', {
  store: 'PostgreSQL',
  cookieSecure: sessionConfig.cookie?.secure,
  cookieSameSite: sessionConfig.cookie?.sameSite,
  environment: env.NODE_ENV,
  trustProxy: app.get('trust proxy')
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
