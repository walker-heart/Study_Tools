import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes/index";
import uploadRouter from "./routes/upload";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import pkg from 'pg';
const { Pool } = pkg;

// Create a proper pool for session handling
const sessionPool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
import { env } from "./lib/env";
import { storageService } from './services/storage';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
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
  exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials'],
  maxAge: 86400 // Cache preflight requests for 24 hours
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
// Serve the main public directory
app.use(express.static(publicPath, {
  ...staticOptions,
  index: false, // Let our router handle the index route
  fallthrough: true // Continue to next middleware if file not found
}));

// Serve uploaded files from storage directory
app.use('/storage', express.static(join(__dirname, '..', 'storage'), {
  ...staticOptions,
  fallthrough: true
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
    pool: sessionPool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // Cleanup every 15 minutes
    errorLog: (err) => {
      console.error('Session store error:', err);
    }
  }),
  name: 'sid',
  secret: env.JWT_SECRET!,
  resave: true,
  saveUninitialized: true,
  rolling: true, // Refresh session with each request
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    path: '/'
  }
}));

// Add session debug logging
app.use((req, _res, next) => {
  console.log('Session Debug:', {
    id: req.session.id,
    user: req.session.user,
    authenticated: req.session.authenticated,
    cookie: req.session.cookie
  });
  next();
});

// Add session debug middleware in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    if (req.session) {
      console.log('Session data:', {
        id: req.session.id,
        user: req.session.user,
        authenticated: req.session.authenticated
      });
    }
    next();
  });
}

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
    // Initialize critical services
    const initializeServices = async () => {
      try {
        // Create database connection
        log('Initializing database connection...');
        const { testDatabaseConnection } = await import('./db');
        await testDatabaseConnection();
        log('Database connection established successfully');

        // Test Object Storage service
        try {
          const testPath = 'test/storage-check.txt';
          const testContent = Buffer.from('Storage test');
          
          // Test upload
          const { storage } = await import('./lib/storage');
          const uploadResult = await storage.upload(testPath, testContent);
          if (!uploadResult.success) {
            throw new Error(`Upload failed: ${uploadResult.error}`);
          }
          log('Storage test upload successful');

          // Test download
          const downloadResult = await storage.download(testPath);
          if (!downloadResult.success) {
            throw new Error(`Download failed: ${downloadResult.error}`);
          }
          log('Storage test download successful');

          // Test delete
          const deleteResult = await storage.delete(testPath);
          if (!deleteResult.success) {
            throw new Error(`Delete failed: ${deleteResult.error}`);
          }
          log('Storage test delete successful');

          log('Object Storage service verified successfully');
        } catch (testError) {
          log(`Warning: Object Storage test failed: ${testError instanceof Error ? testError.message : String(testError)}`);
          // Don't throw here, allow server to start with degraded functionality
        }
      } catch (error) {
        log(`Warning: Failed to initialize services: ${error instanceof Error ? error.message : String(error)}`);
        // Don't throw here, allow server to start with degraded functionality
      }
    };

    await initializeServices();

    // Check for required environment variables
    if (!process.env.JWT_SECRET) {
      log('Error: JWT_SECRET is not set. Authentication will not work properly.');
      process.exit(1);
    }

    // Register routes before error handling
    registerRoutes(app);
    app.use('/api/upload', uploadRouter);
    
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
    
    // Start server with proper error handling
    const startServer = () => new Promise((resolve, reject) => {
      server.listen({
        port: PORT,
        host: '0.0.0.0'
      }, () => {
        log(`Server running in ${app.get("env")} mode on port ${PORT}`);
        log(`APP_URL: ${env.APP_URL}`);
        resolve(true);
      }).on('error', (err) => {
        reject(new Error(`Failed to start server: ${err.message}`));
      });
    });

    await startServer();
  } catch (error) {
    log(`Fatal error: ${error}`);
    process.exit(1);
  }
})();