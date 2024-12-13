import session from 'express-session';
import pkg from 'pg';
const { Pool } = pkg;
import connectPgSimple from 'connect-pg-simple';
import MemoryStore from 'memorystore';
import { env } from '../lib/env';
import { log, debug, info, warn, error } from '../lib/log';
import type { LogMessage, LogLevel } from '../lib/log';

const MemoryStoreSession = MemoryStore(session);

// Create PostgreSQL pool with enhanced error handling
function createPool(): pkg.Pool {
  debug('Creating PostgreSQL connection pool...');
  
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  debug(`Using database URL: ${env.DATABASE_URL.replace(/:[^:@]*@/, ':***@')}`);

  const poolConfig = {
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false,
    max: 3, // Reduce max connections
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 3000,
    allowExitOnIdle: true // Allow idle connections to exit
  };

  debug('Pool configuration created');
  const pool = new Pool(poolConfig);

  // Add event listeners for connection issues
  pool.on('error', (err) => {
    console.error('Pool error:', err);
    error('Database pool error: ' + (err instanceof Error ? err.message : String(err)));
  });

  pool.on('connect', () => {
    debug('New database connection established');
  });

  return pool;
}

// Initialize session store with proper error handling
async function initializeSessionStore(): Promise<session.Store> {
  let pool: pkg.Pool | undefined;

  try {
    console.log('\n=== Session Store Initialization Starting ===');
    
    // Validate environment
    console.log('Checking environment variables...');
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    console.log('Database URL format:', env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'));

    // Create and test pool with retries
    console.log('\nAttempting database connection...');
    let connectionAttempts = 3;
    let lastError: Error | null = null;

    while (connectionAttempts > 0) {
      try {
        console.log(`Connection attempt ${4 - connectionAttempts}/3...`);
        pool = createPool();
        
        const testResult = await pool.query('SELECT NOW() as time, current_database() as db, version() as version');
        console.log('Database connection successful:', {
          time: testResult.rows[0]?.time,
          database: testResult.rows[0]?.db,
          version: testResult.rows[0]?.version?.split(' ')[0]
        });
        break;
      } catch (connError) {
        lastError = connError instanceof Error ? connError : new Error(String(connError));
        connectionAttempts--;
        
        if (connectionAttempts > 0) {
          console.log(`Connection failed, retrying in 1 second... (${connectionAttempts} attempts remaining)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!pool || lastError) {
      throw new Error(`Failed to establish database connection after 3 attempts: ${lastError?.message}`);
    }

    // Initialize session store
    console.log('\nInitializing session store components...');
    console.log('1. Creating connect-pg-simple instance...');
    const pgSession = connectPgSimple(session);

    console.log('2. Setting up session store...');
    const store = new pgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60000,
      errorLog: console.error.bind(console)
    });

    // Verify store functionality
    console.log('3. Verifying session store...');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Session store verification timed out after 5 seconds'));
      }, 5000);

      store.get('test-session', (err) => {
        clearTimeout(timeout);
        if (err) {
          console.error('Store verification failed:', err);
          reject(err);
        } else {
          console.log('Store verification successful');
          resolve();
        }
      });
    });

    console.log('=== Session Store Initialization Complete ===\n');
    return store;

  } catch (error) {
    console.error('\n=== Session Store Initialization Failed ===');
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown Error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Clean up pool if it exists
    if (pool) {
      try {
        console.log('\nClosing database pool...');
        await pool.end();
        console.log('Database pool closed successfully');
      } catch (poolError) {
        console.error('Error closing database pool:', poolError);
      }
    }

    // Create memory store fallback
    console.log('\nFalling back to memory store...');
    const memoryStore = new MemoryStoreSession({
      checkPeriod: 86400000, // 24 hours
      max: 1000,
      stale: false
    });

    console.warn('Using in-memory session store as fallback (Note: This is not suitable for production)');
    return memoryStore;
  }
}

// Create session configuration
export async function createSessionConfig(): Promise<session.SessionOptions> {
  try {
    console.log('=== Starting Session Configuration ===');
    console.log('Environment:', env.NODE_ENV);
    console.log('Database URL exists:', !!env.DATABASE_URL);

    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required but not set');
    }

    if (!env.JWT_SECRET) {
      console.warn('Warning: JWT_SECRET not set, using default secret key');
    }

    console.log('Initializing session store...');
    let store;
    try {
      store = await initializeSessionStore();
      console.log('Session store initialized successfully');
    } catch (storeError) {
      console.error('Failed to initialize session store:', storeError);
      throw storeError;
    }

    console.log('Creating session configuration object...');
    const config: session.SessionOptions = {
      store,
      secret: env.JWT_SECRET || 'default-secret-key',
      name: 'sid',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      proxy: env.NODE_ENV === 'production',
      cookie: {
        secure: env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
        path: '/'
      }
    };

    console.log('Session configuration details:', {
      mode: env.NODE_ENV,
      cookieSecure: config.cookie?.secure,
      cookieSameSite: config.cookie?.sameSite,
      proxyEnabled: config.proxy,
      storeType: store.constructor.name
    });

    console.log('=== Session Configuration Complete ===');
    return config;

  } catch (error) {
    console.error('=== Session Configuration Failed ===');
    console.error('Error details:', error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error);
    throw error;
  }
}