import session from 'express-session';
import pkg from 'pg';
const { Pool } = pkg;
import type { PoolConfig } from 'pg';
import connectPgSimple from 'connect-pg-simple';
import MemoryStore from 'memorystore';
import { env } from '../lib/env';
import { log, debug, info, warn, error } from '../lib/log';
import type { LogMessage, LogLevel } from '../lib/log';

import { SessionError, SessionErrorContext } from '../types/session';

// Define retry configuration interface
interface RetryConfig {
  maxRetries: number;
  initialBackoff: number;
  maxBackoff: number;
  factor: number;
}

const MemoryStoreSession = MemoryStore(session);

// Create PostgreSQL pool with enhanced error handling and connection management
const createPool = (): pkg.Pool => {
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
  pool.on('error', (err: unknown) => {
    const context: SessionErrorContext = {
      operation: 'pool_error',
      timestamp: new Date(),
    };
    
    const errorMessage: SessionError = {
      level: 'error',
      message: 'Unexpected error on idle client',
      stack: err instanceof Error ? err.stack : undefined,
      error_message: err instanceof Error ? err.message : String(err),
      metadata: {
        operation: context.operation,
        path: 'session-store',
      }
    };
    
    log(errorMessage as LogMessage, 'error');
  });

  pool.on('connect', () => {
    debug('New client connected to database pool');
  });

  return pool;
};

// Test database connection with retries and exponential backoff
async function testDatabaseConnection(pool: pkg.Pool, maxRetries = 5): Promise<boolean> {
  let backoff = 1000; // Start with 1 second
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query('SELECT NOW()');
      const logMessage: LogMessage = {
        level: 'info',
        message: 'Database connection successful',
        metadata: {
          attempt,
          total_attempts: maxRetries,
          operation: 'db_connection_test'
        }
      };
      log(logMessage);
      info('Database connection successful');
      return true;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const level: LogLevel = isLastAttempt ? 'error' : 'warn';
      const errorMessage: SessionError = {
        level,
        message: `Database connection attempt ${attempt}/${maxRetries} failed`,
        error_message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        metadata: {
          operation: 'db_connection_test',
          attempt,
          total_attempts: maxRetries,
          next_retry: isLastAttempt ? null : `${backoff/1000} seconds`,
        }
      };
      log(errorMessage as LogMessage, level);

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
async function initializeSessionStore(): Promise<session.Store> {
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
      errorLog: (err: unknown) => {
        const context: SessionErrorContext = {
          operation: 'session_store',
          tableName: 'session',
          poolConfig: {
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
          },
          timestamp: new Date()
        };
        
        const errorMessage: SessionError = {
          level: 'error',
          message: 'Session store error',
          error_message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          metadata: {
            path: 'session-store',
            status: 500,
            operation: context.operation,
            tableName: context.tableName,
            poolConfig: context.poolConfig
          }
        };
        log(errorMessage as LogMessage);
      },
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
      
      info('PostgreSQL session store initialized and verified');
      return store;
      
    } catch (verifyError) {
      const errorMessage: SessionError = {
        level: 'error',
        message: 'Session store verification failed',
        error_message: verifyError instanceof Error ? verifyError.message : String(verifyError),
        stack: verifyError instanceof Error ? verifyError.stack : undefined,
        metadata: {
          operation: 'session_store_verify'
        }
      };
      log(errorMessage as LogMessage, 'error');
      throw verifyError;
    }
  } catch (error) {
    warn({
      level: 'warn',
      message: 'PostgreSQL session store initialization failed, falling back to MemoryStore',
      stack: error instanceof Error ? error.stack : undefined,
      metadata: {
        operation: 'session_store_init',
        fallback: 'memory_store'
      }
    });

    // Clean up pool if it exists
    if (pool) {
      try {
        await pool.end();
      } catch (poolError: unknown) {
        const errorMessage: SessionError = {
          level: 'error',
          message: 'Error closing pool during fallback',
          error_message: poolError instanceof Error ? poolError.message : String(poolError),
          stack: poolError instanceof Error ? poolError.stack : undefined,
          metadata: {
            operation: 'pool_cleanup',
            fallback: 'memory_store'
          }
        };
        log(errorMessage as LogMessage, 'error');
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
