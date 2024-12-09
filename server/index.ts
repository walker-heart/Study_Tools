import { fileURLToPath } from "url";
import { dirname, join } from "path";
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
import { env } from "./lib/env";
import { existsSync, mkdirSync } from 'fs';
import { storageService } from './services/storage';

const { Pool } = pkg;

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up storage directory
const storageDir = join(dirname(__dirname), 'storage');
if (!existsSync(storageDir)) {
  mkdirSync(storageDir, { recursive: true });
}

// Create PostgreSQL pool
const sessionPool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const pgSession = connectPgSimple(session);

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

// Configure CORS
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials'],
  maxAge: 86400
};

app.use(cors(corsOptions));

// CORS headers
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

app.options('*', cors());

// Session configuration
app.use(session({
  store: new pgSession({
    pool: sessionPool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15,
    errorLog: (err) => {
      console.error('Session store error:', err);
    }
  }),
  name: 'sid',
  secret: env.JWT_SECRET!,
  resave: true,
  saveUninitialized: true,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    path: '/'
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files
app.use('/storage', express.static(storageDir, {
  maxAge: '1h',
  etag: true,
  lastModified: true,
  setHeaders: (res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Debug logging
app.use((req, _res, next) => {
  console.log('Session Debug:', {
    id: req.session.id,
    user: req.session.user,
    authenticated: req.session.authenticated,
    cookie: req.session.cookie
  });
  next();
});

// Request logging
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
    // Initialize services
    const initializeServices = async () => {
      try {
        log('Initializing database connection...');
        const { testDatabaseConnection } = await import('./db');
        await testDatabaseConnection();
        log('Database connection established successfully');

        // Test storage service
        try {
          const testPath = 'test/storage-check.txt';
          const testContent = Buffer.from('Storage test');
          
          await storageService.saveFlashcardSet(0, testPath, testContent);
          log('Storage test upload successful');

          await storageService.getFlashcardSet(0, testPath);
          log('Storage test download successful');

          await storageService.deleteFlashcardSet(0, testPath);
          log('Storage test delete successful');

          log('Object Storage service verified successfully');
        } catch (testError) {
          log(`Warning: Object Storage test failed: ${testError instanceof Error ? testError.message : String(testError)}`);
        }
      } catch (error) {
        log(`Warning: Failed to initialize services: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    await initializeServices();

    if (!process.env.JWT_SECRET) {
      log('Error: JWT_SECRET is not set. Authentication will not work properly.');
      process.exit(1);
    }

    registerRoutes(app);
    app.use('/api/upload', uploadRouter);
    
    const server = createServer(app);

    // Error handling
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      const status = (err.status || err.statusCode || 500);
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    // Environment specific configuration
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
      app.get('*', (_req, res) => {
        res.sendFile(join(__dirname, '..', 'dist', 'public', 'index.html'));
      });
    }

    const PORT = parseInt(process.env.PORT || '5000', 10);
    
    // Start server
    log('Attempting to start server...');
    try {
      await new Promise((resolve, reject) => {
        const serverInstance = server.listen({
          port: PORT,
          host: '0.0.0.0'
        }, () => {
          log(`Server running in ${app.get("env")} mode on port ${PORT}`);
          log(`APP_URL: ${env.APP_URL}`);
          resolve(true);
        });

        serverInstance.on('error', (err) => {
          log(`Server startup error: ${err.message}`);
          if (err.code === 'EADDRINUSE') {
            log(`Port ${PORT} is already in use`);
          }
          reject(err);
        });
      });
    } catch (error) {
      log(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  } catch (error) {
    log(`Fatal error during initialization: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
})().catch(error => {
  log(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
