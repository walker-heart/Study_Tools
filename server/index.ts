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
import { db, sql } from "./db";
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

// Import session config
import { sessionConfig } from './config/session';

// Configure session middleware with detailed error logging
const sessionStore = new pgSession({
  pool: sessionPool,
  tableName: 'session',
  createTableIfMissing: true,
  pruneSessionInterval: 60 * 15,
  errorLog: (err: unknown) => {
    console.error('Session store error:', {
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
      stack: err instanceof Error ? err.stack : undefined
    });
  }
});

// Initialize database and verify connection
async function initializeDatabase() {
  try {
    log('Testing database connection...');
    const result = await sql`SELECT NOW()`;
    log(`Database connection successful: ${result[0].now}`);

    // Verify essential tables
    const [{ exists }] = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'flashcard_sets'
      );
    `;

    if (!exists) {
      log('Required tables not found. Please ensure migrations have been run.');
      return false;
    }

    // Verify session table
    await sql`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      )
    `;

    return true;
  } catch (error) {
    log(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Initialize services
async function initializeServices() {
  try {
    log('Initializing services...');
    
    // Test database connection
    await sql`SELECT 1`;
    log('Database connection successful');

    // Verify database tables exist
    const [{ exists }] = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'flashcard_sets'
      );
    `;
    
    if (!exists) {
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
    }

    return true;
  } catch (error) {
    log(`Critical error during service initialization: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

(async () => {
  try {
    log('Starting server initialization...');
    
    // Initialize database connection
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      log('Database initialization failed. Please check database configuration and migrations.');
      process.exit(1);
    }
    log('Database initialized successfully');
    
    // Initialize session store
    try {
      await new Promise<void>((resolve, reject) => {
        sessionStore.get('test', (err) => {
          if (err) reject(err);
          resolve();
        });
      });
      log('Session store initialized successfully');
    } catch (sessionError) {
      log(`Fatal error: Session store initialization failed: ${sessionError instanceof Error ? sessionError.message : String(sessionError)}`);
      process.exit(1);
    }

    await initializeServices();

    if (!process.env.JWT_SECRET) {
      log('Error: JWT_SECRET is not set. Authentication will not work properly.');
      process.exit(1);
    }

    // Configure app middleware
    app.use(session({
      ...sessionConfig,
      store: sessionStore,
      cookie: {
        ...sessionConfig.cookie,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      },
      rolling: true,
      saveUninitialized: false,
      resave: false
    }));

    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Register routes
    registerRoutes(app);
    app.use('/api/upload', uploadRouter);
    
    const server = createServer(app);

    // Error handling
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
      app.get('*', (_req, res) => {
        res.sendFile(join(__dirname, '..', 'dist', 'public', 'index.html'));
      });
    }

    const PORT = parseInt(process.env.PORT || '5000', 10);
    
    await new Promise<void>((resolve, reject) => {
      const serverInstance = server.listen({
        port: PORT,
        host: '0.0.0.0',
        backlog: 511
      }, () => {
        log(`Server running in ${app.get("env")} mode on port ${PORT}`);
        log(`APP_URL: ${env.APP_URL}`);
        log('Server initialization complete');
        resolve();
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
    log(`Fatal error during initialization: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
})().catch(error => {
  log(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

export default app;