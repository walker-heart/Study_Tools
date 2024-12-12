import express from "express";
import type { Request, Response, NextFunction } from "express";
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
import fs from 'fs';

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

async function initializeServer() {
  const app = express();
  
  // Configure CORS middleware with enhanced security
  const corsOptions: cors.CorsOptions = {
    origin: env.NODE_ENV === 'production' ? env.APP_URL : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Type', 'Content-Length'],
    maxAge: 86400,
    optionsSuccessStatus: 204
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // Enhanced security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Configure request size limits and parsers with proper error handling
  app.use(express.json({ 
    limit: '10mb',
    verify: (req: Request, res: Response, buf: Buffer) => {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        res.status(400).json({ error: 'Invalid JSON' });
        throw new Error('Invalid JSON');
      }
    }
  }));
  
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Configure PostgreSQL pool with enhanced error handling and connection management
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    application_name: 'vocabulary_app',
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  });

  // Handle pool errors
  pool.on('error', (err: Error) => {
    log(`Unexpected error on idle client: ${err.message}`);
  });

  // Database connection test with exponential backoff
  const maxRetries = 5;
  const initialRetryDelay = 1000;

  async function connectWithRetry() {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await pool.query('SELECT NOW()');
        log('Database connection successful');
        return;
      } catch (error) {
        const err = error as Error;
        const retryDelay = initialRetryDelay * Math.pow(2, i);
        log(`Database connection attempt ${i + 1}/${maxRetries} failed: ${err.message}`);
        
        if (i === maxRetries - 1) {
          throw new Error('Failed to connect to database after multiple attempts');
        }
        
        log(`Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  await connectWithRetry();

  // Configure session middleware
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  const sessionConfig: session.SessionOptions = {
    store: new pgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 30, // 30 minutes in seconds
      errorLog: (error: Error) => {
        log(`Session store error: ${error.message}`);
        // Notify monitoring system if available
        console.error('Session store error:', error);
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
      domain: undefined // Let browser set the cookie domain
    } as session.CookieOptions & {
      sameSite: 'none' | 'lax'
    }
  };

  app.use(session(sessionConfig));

  // Add session error handling
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err.name === 'UnauthorizedError') {
      res.status(401).json({ message: 'Invalid token' });
    } else {
      next(err);
    }
  });

  // Add request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (req.path.startsWith("/api")) {
        const logData = {
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        };
        
        log(`API Request: ${JSON.stringify(logData)}`);
      }
    });

    next();
  });

  try {
    // Register routes
    registerRoutes(app);
    
    const server = createServer(app);

    // Development-specific configuration
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
      
      app.get('*', (_req, res) => {
        const indexPath = path.join(__dirname, '..', 'dist', 'public', 'index.html');
        if (!fs.existsSync(indexPath)) {
          return res.status(404).send('Application not built properly');
        }
        res.sendFile(indexPath);
      });
    }

    // Enhanced error handler
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
      
      log(`Error: ${err.message}`);
      res.status(status).json({ message });
    });

    // Find available port
    const findAvailablePort = async (startPort: number): Promise<number> => {
      const isPortAvailable = (port: number): Promise<boolean> => {
        return new Promise(resolve => {
          server.once('error', () => resolve(false));
          server.once('listening', () => {
            server.close(() => resolve(true));
          });
          server.listen(port, '0.0.0.0');
        });
      };

      let port = startPort;
      while (!(await isPortAvailable(port))) {
        port++;
      }
      return port;
    };

    const desiredPort = parseInt(process.env.PORT || '5000', 10);
    const port = await findAvailablePort(desiredPort);

    server.listen(port, '0.0.0.0', () => {
      log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
      log(`APP_URL: ${env.APP_URL}`);
    });

  } catch (error) {
    log(`Fatal error during server startup: ${error}`);
    process.exit(1);
  }
}

initializeServer().catch(error => {
  log(`Failed to initialize server: ${error}`);
  process.exit(1);
});