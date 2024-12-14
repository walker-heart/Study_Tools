import express from "express";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";
import { createServer } from "http";
import session from "express-session";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { db } from "./db";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";
import { log } from "./lib/log";
import { createSessionConfig } from './config/session';
import { securityHeaders, sanitizeInput, sessionSecurity, cleanupSessions } from './middleware/security';
import rateLimit from 'express-rate-limit';
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy - required for rate limiting behind Replit's proxy
app.set('trust proxy', 1);

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false
});

async function startServer(port: number) {
  try {
    // Test database connection
    await db.execute(sql`SELECT NOW()`);
    console.log('Database connection successful');

    // Setup middleware
    const sessionConfig = await createSessionConfig();
    if (!sessionConfig) {
      throw new Error('Failed to create session configuration');
    }
    
    app.use(session(sessionConfig));
    app.use(cleanupSessions);
    
    // Configure CORS with specific options
    app.use(cors({
      origin: true, // Allow all origins in development
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Origin'],
      exposedHeaders: ['Set-Cookie']
    }));

    // Security and parsing middleware
    app.use(securityHeaders);
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(limiter);
    app.use(sanitizeInput);
    app.use(sessionSecurity);

    // Setup static files
    const publicPath = path.join(__dirname, '..', 'dist');
    const publicAssetsPath = path.join(publicPath, 'assets');
    
    // Ensure directories exist
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true });
    }
    if (!fs.existsSync(publicAssetsPath)) {
      fs.mkdirSync(publicAssetsPath, { recursive: true });
    }

    if (env.NODE_ENV === 'production') {
      // Log static file directories for debugging
      console.log('Static file paths:', {
        publicPath,
        publicAssetsPath,
        exists: {
          publicPath: fs.existsSync(publicPath),
          publicAssetsPath: fs.existsSync(publicAssetsPath)
        }
      });

      // Serve static assets with proper MIME types and caching
      app.use('/assets', (req, res, next) => {
        express.static(publicAssetsPath, {
          maxAge: '1y',
          etag: true,
          index: false,
          setHeaders: (res, path) => {
            // Set proper MIME types
            if (path.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript');
            } else if (path.endsWith('.css')) {
              res.setHeader('Content-Type', 'text/css');
            }
            // Set caching headers
            res.setHeader('Cache-Control', 'public, max-age=31536000');
          }
        })(req, res, (err) => {
          if (err) {
            console.error('Static asset serving error:', {
              path: req.path,
              error: err.message,
              stack: err.stack
            });
            next(err);
          } else {
            next();
          }
        });
      });
      
      // Serve other static files from dist
      app.use(express.static(publicPath, {
        index: false,
        etag: true,
        lastModified: true
      }));

      // Handle static file errors
      app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (err.code === 'ENOENT') {
          res.status(404).json({ error: 'File not found' });
        } else {
          console.error('Static file error:', err);
          res.status(500).json({ error: 'Error serving static file' });
        }
      });
    } else {
      const viteServer = createServer();
      await setupVite(app, viteServer);
    }

    // Register routes
    registerRoutes(app);

    // Add error handling middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
      });
    });

    // Start HTTP server with proper error handling
    const server = createServer(app);
    
    await new Promise<void>((resolve, reject) => {
      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${port} is already in use`);
          reject(error);
        } else {
          console.error('Server error:', error);
          reject(error);
        }
      });

      server.listen(port, '0.0.0.0', () => {
        console.log(`Server started on port ${port}`);
        resolve();
      });
    });

    // Handle shutdown gracefully
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
}

const PORT = parseInt(process.env.PORT || '5000', 10);
startServer(PORT).catch(err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please free up the port or use a different one.`);
  } else {
    console.error('Failed to start server:', err);
  }
  process.exit(1);
});
