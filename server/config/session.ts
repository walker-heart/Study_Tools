import session from 'express-session';
import pkg from 'pg';
const { Pool } = pkg;
import connectPgSimple from 'connect-pg-simple';
import MemoryStore from 'memorystore';

const MemoryStoreSession = MemoryStore(session);

// Verify required environment variables
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for session security');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for session storage');
}

// Create PostgreSQL pool and session store
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const pgSession = connectPgSimple(session);

// Configure session settings with fallback to MemoryStore
let sessionStore;
try {
  sessionStore = new pgSession({
    pool,
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
  
  // Test connection
  pool.query('SELECT NOW()', (err) => {
    if (err) {
      console.error('Session store database connection error:', err);
    } else {
      console.log('Session store database connection successful');
    }
  });
} catch (error) {
  console.warn('Failed to create PostgreSQL session store, falling back to MemoryStore:', error);
  sessionStore = new MemoryStoreSession({
    checkPeriod: 86400000 // Prune expired entries every 24h
  });
}

// Export session configuration
export const sessionConfig = {
  secret: process.env.JWT_SECRET,
  resave: true, // Changed to true to ensure session is saved
  saveUninitialized: true, // Changed to true to create session for all requests
  rolling: true,
  cookie: {
    secure: false, // Set to false for development
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' as const,
    path: '/',
    domain: undefined, // Allow the browser to handle domain
  },
  name: 'connect.sid', // Changed to default Express session name
  proxy: false, // Set to false for development
};

// Export store separately
export const getSessionStore = () => sessionStore;
