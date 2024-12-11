import session from 'express-session';
import pkg from 'pg';
const { Pool } = pkg;
import connectPgSimple from 'connect-pg-simple';
import MemoryStore from 'memorystore';
import { env } from '../lib/env';
import { log } from '../lib/log';

const MemoryStoreSession = MemoryStore(session);

// Create PostgreSQL pool with enhanced error handling
const createPool = () => new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Test database connection with retries
async function testDatabaseConnection(pool: pkg.Pool, maxRetries = 5): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query('SELECT NOW()');
      log('Database connection successful', 'info');
      return true;
    } catch (error) {
      log({
        message: `Database connection attempt ${attempt}/${maxRetries} failed`,
        stack: error instanceof Error ? error.stack : undefined
      }, attempt === maxRetries ? 'error' : 'warn');

      if (attempt === maxRetries) {
        return false;
      }

      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
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
      // Enhanced error logging
      errorLog: (error: Error) => {
        log({
          message: `Session store error: ${error.message}`,
          path: 'session-store',
          status: 500,
          stack: error.stack
        }, 'error');
      }
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
