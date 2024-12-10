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

// Configure request size limits and parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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

// Configure session middleware
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy
}

const pgStore = connectPgSimple(session);
const sessionConfig: session.SessionOptions = {
  store: new pgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15 // 15 minutes
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
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
    domain: undefined // Let browser set the cookie domain
  } as session.CookieOptions & {
    sameSite: 'none' | 'lax'
  }
};

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
    // Verify database connection first
    try {
      await db.execute(sql`SELECT 1`);
      log('Database connection successful');
    } catch (error) {
      log('Error connecting to database: ' + error);
      process.exit(1);
    }

    // Check for required environment variables
    if (!process.env.JWT_SECRET) {
      log('Error: JWT_SECRET is not set. Authentication will not work properly.');
      process.exit(1);
    }

    if (!process.env.DATABASE_URL) {
      log('Error: DATABASE_URL is not set. Database connections will fail.');
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

    // Start the server
    const PORT = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port: PORT,
      host: '0.0.0.0'
    }, () => {
      log(`Server running in ${app.get("env")} mode on port ${PORT}`);
      log(`APP_URL: ${env.APP_URL}`);
    });
  } catch (error) {
    log(`Fatal error during server startup: ${error}`);
    process.exit(1);
  }
})();
