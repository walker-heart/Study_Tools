import { Router } from 'express';
import pkg from 'pg';
import { env } from '../lib/env';
const { Pool } = pkg;

const router = Router();

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connection successful');
  }
});


router.get('/', (_req, res) => {
  try {
    // Redirect to signin page directly, Google Auth removed.
    res.redirect('/signin');
  } catch (error) {
    console.error('Auth Error:', error);
    console.error('Auth Error Details:', {
      stack: error instanceof Error ? error.stack : undefined,
      env: {
        appUrl: env.APP_URL,
        nodeEnv: env.NODE_ENV
      }
    });
    res.redirect(`${env.APP_URL}/signin?error=auth_init_failed`);
  }
});

export default router;