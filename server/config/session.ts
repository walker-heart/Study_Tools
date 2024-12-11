import session from 'express-session';
import pkg from 'pg';
const { Pool } = pkg;
import connectPgSimple from 'connect-pg-simple';
import MemoryStore from 'memorystore';
import { env } from '../lib/env';
import { log } from '../lib/log';

const MemoryStoreSession = MemoryStore(session);

// Create PostgreSQL pool with proper error handling
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    log('Database connection error: ' + err.message, 'error');
  } else {
    log('Database connection successful', 'info');
  }
});

const pgSession = connectPgSimple(session);

// Configure session store with enhanced error handling
let sessionStore;
try {
  sessionStore = new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // Prune every 15 minutes
    errorLog: (error: Error) => {
      log('Session store error: ' + error.message, 'error');
    }
  });
  log('PostgreSQL session store initialized', 'info');
} catch (error) {
  log('Failed to create PostgreSQL session store, falling back to MemoryStore: ' + error, 'warn');
  sessionStore = new MemoryStoreSession({
    checkPeriod: 86400000 // Prune expired entries every 24h
  });
}

// Type-safe session configuration
export const sessionConfig = {
  store: sessionStore,
  secret: env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  proxy: env.NODE_ENV === 'production',
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: (env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
    path: '/',
  },
  name: 'sid'
} satisfies session.SessionOptions;
