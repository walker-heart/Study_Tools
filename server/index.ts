import express from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import session from "express-session";
import { db, pool } from "../db";
import { sql } from "drizzle-orm";
import MemoryStore from "memorystore";

const MemoryStoreSession = MemoryStore(session);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function log(message: string) {
  console.log(`[express] ${message}`);
}

const app = express();

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  log(`Error: ${err.message}`);
  res.status(500).send('Internal Server Error');
});

// Basic CORS setup
app.use(cors({
  origin: true,
  credentials: true
}));

// Session configuration
app.use(session({
  store: new MemoryStoreSession({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  secret: process.env.JWT_SECRET || 'development-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add basic health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server function
async function startServer() {
  const PORT = parseInt(process.env.PORT || '5000', 10);
  
  try {
    // Test database connection first
    try {
      const result = await pool.query('SELECT NOW()');
      log('Database connection successful');
    } catch (dbError) {
      log(`Database connection error: ${dbError}`);
      throw dbError;
    }

    // Create HTTP server
    const server = createServer(app);
    
    // Register routes after database connection is confirmed
    try {
      registerRoutes(app);
      log('Routes registered successfully');
    } catch (routeError) {
      log(`Failed to register routes: ${routeError}`);
      throw routeError;
    }
    
    // Configure environment-specific settings
    if (process.env.NODE_ENV === "development") {
      log('Setting up Vite in development mode');
      await setupVite(app, server);
    } else {
      log('Setting up static serving for production');
      serveStatic(app);
    }
    
    // Start the server
    await new Promise<void>((resolve, reject) => {
      server.listen(PORT, '0.0.0.0', () => {
        log(`Server running on port ${PORT}`);
        log(`Environment: ${process.env.NODE_ENV}`);
        resolve();
      });

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          log(`Port ${PORT} is already in use`);
        } else {
          log(`Server error: ${error.message}`);
        }
        reject(error);
      });
    });

    return server;
  } catch (error) {
    log(`Fatal error during server startup: ${error}`);
    throw error;
  }
}

// Start the server
startServer().catch((error) => {
  log(`Failed to start server: ${error}`);
  process.exit(1);
});