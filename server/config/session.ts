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
});

const pgSession = connectPgSimple(session);

// Configure session settings with fallback to MemoryStore
let sessionStore;
try {
  sessionStore = new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  });
} catch (error) {
  console.warn('Failed to create PostgreSQL session store, falling back to MemoryStore');
  sessionStore = new MemoryStoreSession({
    checkPeriod: 86400000 // Prune expired entries every 24h
  });
}

// Export session configuration
export const sessionConfig = {
  store: sessionStore,
  secret: process.env.JWT_SECRET,
  resave: true, // Required for rolling sessions
  saveUninitialized: false,
  rolling: true, // Refresh session with each request
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  },
  name: 'sessionId',
  proxy: process.env.NODE_ENV === 'production', // Trust proxy in production
};
