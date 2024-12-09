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
import { db, initializeDatabase } from "./db";
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

// Create PostgreSQL pool with proper SSL config
const sessionPool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Verify database connection with detailed logging
async function verifyDatabaseConnection() {
  let client;
  try {
    console.log('Attempting database connection...');
    client = await sessionPool.connect();
    console.log('Connected to database, testing query...');
    await client.query('SELECT NOW()');
    console.log('Database query successful');
    return true;
  } catch (error) {
    console.error('Database connection error:', {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      database: env.DATABASE_URL?.split('@')[1] // Log only host part for security
    });
    return false;
  } finally {
    if (client) {
      console.log('Releasing database connection');
      client.release();
    }
  }
}

// Initialize session store with SSL support and logging
const pgSession = connectPgSimple(session);
console.log('Session store initialized');

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

// Import session config
import { sessionConfig } from './config/session';

// Session configuration with enhanced error handling and logging
// Configure session middleware with detailed error logging
const sessionStore = new pgSession({
  pool: sessionPool,
  tableName: 'session',
  createTableIfMissing: true,
  pruneSessionInterval: 60 * 15, // Prune every 15 minutes
  errorLog: (err) => {
    console.error('Session store error:', {
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
      stack: err instanceof Error ? err.stack : undefined
    });
  }
});

// Test session store
sessionStore.get('test', (err, _session) => {
  if (err) {
    console.error('Session store test failed:', err);
  } else {
    console.log('Session store test successful');
  }
});

app.use(session({
  ...sessionConfig,
  store: sessionStore,
  cookie: {
    ...sessionConfig.cookie,
    secure: process.env.NODE_ENV === 'production', // Only use secure in production
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  rolling: true, // Refresh session with each request
  saveUninitialized: false, // Don't create session until something stored
  resave: false // Don't save session if unmodified
}));

// Debug logging for session
app.use((req, _res, next) => {
  console.log('Session Debug:', {
    id: req.session.id,
    user: req.session.user,
    authenticated: req.session.authenticated,
    cookie: req.session.cookie
  });
  next();
});

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length');
  }
}));

// Handle storage directory access
app.use('/api/storage/:userId/:filename', (req, res, next) => {
  const { userId, filename } = req.params;
  if (!req.session?.user?.id || req.session.user.id !== parseInt(userId)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
});

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
    log('Starting server initialization...');
    
    // Initialize database connection
    try {
      const dbInitialized = await initializeDatabase();
      if (!dbInitialized) {
        log('Database initialization failed. Please check database configuration and migrations.');
        process.exit(1);
      }
      log('Database initialized successfully');
    } catch (dbError) {
      log(`Fatal error: Database initialization failed: ${dbError.message}`);
      process.exit(1);
    }
    
    // Initialize session store
    try {
      await new Promise((resolve, reject) => {
        sessionStore.get('test', (err) => {
          if (err) reject(err);
          resolve(true);
        });
      });
      log('Session store initialized successfully');
    } catch (sessionError) {
      log(`Fatal error: Session store initialization failed: ${sessionError.message}`);
      process.exit(1);
    }

    // Initialize services
    const initializeServices = async () => {
      try {
        log('Initializing services...');
        
        // Test database connection
        try {
          await db.execute(sql`SELECT 1`);
          log('Database connection successful');
        } catch (error) {
          log('Database connection failed:', error);
          throw error;
        }

        // Verify database tables exist
        const tableCheck = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'flashcard_sets'
          );
        `);
        
        if (!tableCheck[0].exists) {
          log('Required tables not found');
          throw new Error('Required database tables are missing');
        }

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
          // Don't throw error for storage test failure, as it's not critical
        }

        return true;
      } catch (error) {
        log(`Critical error during service initialization: ${error instanceof Error ? error.message : String(error)}`);
        throw error; // Rethrow critical errors
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
    
    // Start server with enhanced error handling
    log('Attempting to start server...');
    try {
      // Ensure all middleware is properly initialized
      log('Verifying middleware initialization...');
      if (!app._router) {
        throw new Error('Express router not initialized');
      }
      
      await new Promise((resolve, reject) => {
        const serverInstance = server.listen({
          port: PORT,
          host: '0.0.0.0',
          backlog: 511
        }, () => {
          log(`Server running in ${app.get("env")} mode on port ${PORT}`);
          log(`APP_URL: ${env.APP_URL}`);
          log('Server initialization complete');
          resolve(true);
        });

        serverInstance.on('error', (err: NodeJS.ErrnoException) => {
          log(`Server startup error: ${err.message}`);
          if (err.code === 'EADDRINUSE') {
            log(`Port ${PORT} is already in use`);
          } else if (err.code === 'EACCES') {
            log(`Permission denied to bind to port ${PORT}`);
          }
          reject(err);
        });

        // Add timeout for startup
        setTimeout(() => {
          reject(new Error(`Server failed to start within 5000ms`));
        }, 5000);
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
