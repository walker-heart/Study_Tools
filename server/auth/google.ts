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

router.get('/callback', async (req, res) => {
  try {
    //This route is now obsolete due to the removal of Google authentication.
    res.status(404).send("Not Found");
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Detailed error:', errorMessage);
    console.error('Full error object:', JSON.stringify(error, null, 2));
    const redirectUrl = `${env.APP_URL}/signin?error=auth_failed&message=${encodeURIComponent(errorMessage)}`;
    console.log('Error redirect to:', redirectUrl);
    res.redirect(redirectUrl);
  }
});

export default router;