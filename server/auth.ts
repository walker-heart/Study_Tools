import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { Pool } from 'pg';

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };
  }
}

const app = express();
const router = express.Router();

// PostgreSQL connection with connection logging
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT || '5432'),
  ssl: {
    rejectUnauthorized: false
  }
});

// Log database connection events
pool.on('connect', () => {
  console.log('Database connection established');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err instanceof Error ? err.message : String(err));
});

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Initial database connection error:', err instanceof Error ? err.message : String(err));
  } else {
    console.log('Initial database connection successful at:', res.rows[0].now);
  }
});

router.get('/status', async (req, res) => {
  if (req.session.user) {
    try {
      // Get fresh user data from database
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [req.session.user.id]
      );
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        res.json({ 
          authenticated: true, 
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            picture: user.picture,
          }
        });
      } else {
        // User not found in database
        req.session.destroy(() => {
          res.json({ authenticated: false });
        });
      }
    } catch (error) {
      console.error('Database error:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.json({ authenticated: false });
  }
});

export default router;