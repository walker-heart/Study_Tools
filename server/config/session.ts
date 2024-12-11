import session from 'express-session';
import pkg from 'pg';
const { Pool } = pkg;
import connectPgSimple from 'connect-pg-simple';
import MemoryStore from 'memorystore';
import { env } from '../lib/env';
import { log } from '../lib/log';

import type { LogMessage } from '../lib/log';

const MemoryStoreSession = MemoryStore(session);

// Create PostgreSQL pool with enhanced error handling and connection management
const createPool = () => {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : undefined,
    max: env.NODE_ENV === 'production' ? 20 : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  });

  // Add event listeners for connection issues
  pool.on('error', (err: Error) => {
    const logMessage: LogMessage = {
      message: 'Unexpected error on idle client',
      stack: err.stack,
      error_message: err.message,
      level: 'error'
    };
    log(logMessage);
  });

  pool.on('connect', () => {
    log('New client connected to database pool', 'debug');
  });

  return pool;
};

// Test database connection with retries and exponential backoff
async function testDatabaseConnection(pool: pkg.Pool, maxRetries = 5): Promise<boolean> {
  let backoff = 1000; // Start with 1 second
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query('SELECT NOW()');
      log({
        message: 'Database connection successful',
        attempt,
        total_attempts: maxRetries
      }, 'info');
      return true;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const logMessage: LogMessage = {
        message: `Database connection attempt ${attempt}/${maxRetries} failed`,
        next_retry: isLastAttempt ? null : `${backoff/1000} seconds`,
        stack: error instanceof Error ? error.stack : undefined,
        error_message: error instanceof Error ? error.message : String(error),
        attempt,
        total_attempts: maxRetries,
        level: isLastAttempt ? 'error' : 'warn'
      };
      log(logMessage);

      if (isLastAttempt) {
        return false;
      }

      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, backoff));
      backoff *= 2; // Double the backoff time for next attempt
    }
  }
  return false;
}

// Initialize session store with proper error handling and retries
async function initializeSessionStore() {
  let pool: pkg.Pool | undefined;

  try {
    pool = createPool();
    
    // Test database connection first
    const isConnected = await testDatabaseConnection(pool);
    if (!isConnected) {
      throw new Error('Failed to establish database connection after retries');
    }

    // Initialize session store
    const pgSession = connectPgSimple(session);
    
    // Create session store with enhanced error handling
    const store = new pgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15, // Prune every 15 minutes
      // Enhanced error logging with context
      errorLog: (error: Error) => {
        const poolConfig = {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        };
        
        const logMessage: LogMessage = {
          message: `Session store error: ${error.message}`,
          path: 'session-store',
          status: 500,
          stack: error.stack,
          level: 'error',
          context: {
            tableName: 'session',
            poolConfig
          }
        };
        log(logMessage);
      },
      // Connection configuration
      ttl: 24 * 60 * 60,
      disableTouch: false
    });

    // Verify session store functionality with timeout
    try {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          store.get('test-session', (err) => {
            if (err) {
              reject(new Error(`Session store verification failed: ${err.message}`));
            } else {
              resolve();
            }
          });
        }),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Session store verification timeout')), 5000)
        )
      ]);
      
      log('PostgreSQL session store initialized and verified', 'info');
      return store;
      
    } catch (verifyError) {
      log({
        message: `Session store verification failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`,
        stack: verifyError instanceof Error ? verifyError.stack : undefined
      }, 'error');
      throw verifyError;
    }
  } catch (error) {
    log({
      message: 'PostgreSQL session store initialization failed, falling back to MemoryStore',
      stack: error instanceof Error ? error.stack : undefined
    }, 'warn');

    // Clean up pool if it exists
    if (pool) {
      try {
        await pool.end();
      } catch (poolError) {
        log({
          message: 'Error closing pool during fallback',
          stack: poolError instanceof Error ? poolError.stack : undefined
        }, 'error');
      }
    }

    // Return memory store as fallback
    const memoryStore = new MemoryStoreSession({
      checkPeriod: 86400000, // Prune expired entries every 24h
      stale: false, // Don't keep stale sessions
      max: 100 // Limit maximum number of sessions
    });

    return memoryStore;
  }
}

// Export the initialization function instead of the store directly
export async function createSessionConfig(): Promise<session.SessionOptions> {
  const store = await initializeSessionStore();
  
  return {
    store,
    secret: env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: env.NODE_ENV === 'production',
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
    },
    name: 'sid'
  };
}
