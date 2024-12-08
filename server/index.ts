import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes/index";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
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
// Configure CORS middleware with more permissive settings for development
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials']
};

app.use(cors(corsOptions));

// Add CORS headers for all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Add pre-flight OPTIONS handling
app.options('*', cors());

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
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Range');
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

// Basic request handlers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Configure session middleware with proper error handling
app.use(session({
  store: new pgSession({
    pool: db,
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
    errorLog: console.error // Log session store errors
  }),
  name: 'sid', // Session ID cookie name
  secret: env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    path: '/'
  }
}));

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
    // Verify database connection
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

    // Register routes before error handling
    registerRoutes(app);
    
    const server = createServer(app);

    // Error handling middleware
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      const status = (err.status || err.statusCode || 500);
      const message = err.message || "Internal Server Error";
      
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    // Configure server based on environment
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      // Ensure static files are served in production
      serveStatic(app);
      
      // Add catch-all route to serve index.html for client-side routing
      app.get('*', (_req, res) => {
        res.sendFile(path.join(__dirname, '..', 'dist', 'public', 'index.html'));
      });
    }

    // Get port from environment or default to 5000
    const PORT = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port: PORT,
      host: '0.0.0.0'
    }, () => {
      log(`Server running in ${app.get("env")} mode on port ${PORT}`);
      log(`APP_URL: ${env.APP_URL}`);
    });
  } catch (error) {
    log(`Fatal error: ${error}`);
    process.exit(1);
  }
})();
