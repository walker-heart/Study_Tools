import session from 'express-session';
import pkg from 'pg';
const { Pool } = pkg;
import connectPgSimple from 'connect-pg-simple';
import { env } from '../lib/env';

const createPool = (): pkg.Pool => {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 2000
  });

  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
  });

  return pool;
};

export async function createSessionConfig(): Promise<session.SessionOptions> {
  const pool = createPool();
  const pgSession = connectPgSimple(session);

  // Create session store
  const store = new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 900000, // 15 minutes
  });

  return {
    store,
    secret: env.JWT_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    name: 'connect.sid',
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: false, // Set to true in production
      sameSite: 'lax'
    }
  };
}