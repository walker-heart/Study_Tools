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

const PgSession = connectPgSimple(session);

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
const corsOptions: cors.CorsOptions = {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Origin'],
  exposedHeaders: ['Set-Cookie', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials', 'Content-Length'],
  preflightContinue: false,
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours in seconds
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Add error logging middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Add security headers
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
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
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Range');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
      res.setHeader('Vary', 'Origin');
    }
  }
};

// Configure request size limits and parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure PostgreSQL pool for session store
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Configure session middleware
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

console.log('Configuring session store with database connection');
const sessionConfig: session.SessionOptions = {
  store: new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15,
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
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  }
};

app.use(session(sessionConfig));


(async () => {
  try {
    // Verify database connection
    try {
      await db.execute(sql`SELECT 1`);
      log('Database connection successful');
    } catch (error) {
      log('Error connecting to database: ' + error);
      process.exit(1);
    }

    // Register routes
    registerRoutes(app);
    
    const server = createServer(app);

    // Configure environment-specific settings
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start the server
    const PORT = parseInt(process.env.PORT || '5000', 10);
    server.listen(PORT, '0.0.0.0', () => {
      log(`Server running in ${app.get("env")} mode on port ${PORT}`);
      log(`APP_URL: ${env.APP_URL}`);
    });
  } catch (error) {
    log(`Fatal error during server startup: ${error}`);
    process.exit(1);
  }
})();