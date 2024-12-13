import session from 'express-session';
import pkg from 'pg';
const { Pool } = pkg;
import connectPgSimple from 'connect-pg-simple';
import MemoryStore from 'memorystore';
import { env } from '../lib/env';
import { log, debug, info, warn, error } from '../lib/log';
import type { LogMessage, LogLevel } from '../lib/log';

// Define types for session error handling
interface SessionErrorContext {
  operation?: string;
  fallback?: string;
  tableName?: string;
  poolConfig?: Record<string, number>;
}

interface SessionError extends LogMessage {
  level: LogLevel;
  metadata?: {
    path?: string;
    status?: number;
    operation?: string;
    tableName?: string;
    poolConfig?: Record<string, number>;
  }
}

const MemoryStoreSession = MemoryStore(session);

// Create PostgreSQL pool with enhanced error handling and connection management
const createPool = (): pkg.Pool => {
  debug('Creating PostgreSQL connection pool...');
  
  const poolConfig = {
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
    application_name: 'session_store',
    statement_timeout: 10000,
    query_timeout: 10000
  };

  debug({
    message: 'Pool configuration',
    config: {
      ...poolConfig,
      connectionString: poolConfig.connectionString?.replace(/:[^:@]*@/, ':***@') // Hide password
    }
  });

  const pool = new Pool(poolConfig);

  // Add event listeners for connection issues
  pool.on('error', (err: unknown) => {
    const logMessage: LogMessage = {
      message: 'Unexpected error on idle client',
      stack: err instanceof Error ? err.stack : undefined,
      error_message: err instanceof Error ? err.message : String(err),
      level: 'error' as LogLevel,
      metadata: {
        operation: 'pool_error'
      }
    };
    log(logMessage, 'error');
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
      debug({
        message: `Attempting database connection`,
        attempt,
        connection_string: env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@') // Hide password
      });
      
      const result = await pool.query('SELECT NOW() as current_time, current_database() as database_name, version() as pg_version');
      
      info({
        message: 'Database connection successful',
        attempt,
        total_attempts: maxRetries,
        database_info: {
          current_time: result.rows[0]?.current_time,
          database: result.rows[0]?.database_name,
          version: result.rows[0]?.pg_version?.split(' ')[0]
        }
      });
      
      return true;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const level: LogLevel = isLastAttempt ? 'error' : 'warn';
      
      // Get detailed error information
      const pgError = error as pkg.DatabaseError;
      const errorDetails = {
        code: pgError.code,
        detail: pgError.detail,
        schema: pgError.schema,
        table: pgError.table,
        constraint: pgError.constraint,
        position: pgError.position,
        message: pgError.message
      };
      
      const logMessage: LogMessage = {
        message: `Database connection attempt ${attempt}/${maxRetries} failed`,
        next_retry: isLastAttempt ? null : `${backoff/1000} seconds`,
        stack: error instanceof Error ? error.stack : undefined,
        error_message: error instanceof Error ? error.message : String(error),
        attempt,
        total_attempts: maxRetries,
        level,
        metadata: {
          operation: 'db_connection_test',
          error_details: errorDetails,
          connection_params: {
            max_pool_size: pool.options.max,
            idle_timeout: pool.options.idleTimeoutMillis,
            connection_timeout: pool.options.connectionTimeoutMillis
          }
        }
      };
      
      log(logMessage, level);

      if (isLastAttempt) {
        error({
          message: 'All database connection attempts exhausted',
          final_error: errorDetails
        });
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
    info('Initializing session store...');
    
    // Create and test PostgreSQL pool
    try {
      pool = createPool();
      info('PostgreSQL pool created');

      // Simple connection test
      const result = await pool.query('SELECT NOW()');
      info({
        message: 'PostgreSQL connection successful',
        timestamp: result.rows[0]?.now
      });

      // Initialize session store with PostgreSQL
      const pgSession = connectPgSimple(session);
      
      // Create session table with proper error handling
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "session" (
          "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL
        );
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
      `);
      
      info('Session table and index created/verified');

      // Create and verify session store
      const store = new pgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: false,
        schemaName: 'public',
        pruneSessionInterval: 900000, // 15 minutes
        errorLog: (err: unknown) => {
          error({
            message: 'Session store error',
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined
          });
        }
      });

      // Test store functionality
      await new Promise<void>((resolve, reject) => {
        store.get('test-session', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      info('PostgreSQL session store initialized successfully');
      return store;

    } catch (dbError) {
      error({
        message: 'PostgreSQL session store initialization failed',
        error: dbError instanceof Error ? dbError.message : String(dbError)
      });
      throw dbError;
    }
  } catch (error) {
    warn({
      message: 'PostgreSQL session store initialization failed, falling back to MemoryStore',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Clean up pool if it exists
    if (pool) {
      try {
        await pool.end();
      } catch (poolError: unknown) {
        const logMessage: LogMessage = {
          message: 'Error closing pool during fallback',
          stack: poolError instanceof Error ? poolError.stack : undefined,
          error_message: poolError instanceof Error ? poolError.message : String(poolError),
          level: 'error' as LogLevel,
          metadata: {
            operation: 'pool_cleanup',
            fallback: 'memory_store'
          }
        };
        log(logMessage, 'error');
      }
    }

    // Return memory store as fallback
    const memoryStore = new MemoryStoreSession({
      checkPeriod: 86400000, // Prune expired entries every 24h
      stale: false, // Don't keep stale sessions
      max: 100 // Limit maximum number of sessions
    });

    // Initialize MemoryStore as fallback
    warn('Falling back to MemoryStore for session storage');
    const memoryStore = new MemoryStoreSession({
      checkPeriod: 86400000, // Prune expired entries every 24h
      max: 1000, // Limit maximum number of sessions
      dispose: (sid: string) => {
        info(`Removing expired session: ${sid}`);
      }
    });

    return memoryStore;
  }
}

// Export the initialization function instead of the store directly
export async function createSessionConfig(): Promise<session.SessionOptions> {
  try {
    const store = await initializeSessionStore();
    
    const config: session.SessionOptions = {
      store,
      secret: env.JWT_SECRET || 'your-secret-key',
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

    return config;
  } catch (error) {
    error({
      message: 'Failed to create session configuration',
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}