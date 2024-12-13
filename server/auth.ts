import express from 'express';
import type { Request, Response } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { log } from './lib/log';
import { AuthenticationError } from './lib/errorTracking';

// Define user type for type safety
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  is_admin: boolean;
}

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      is_admin: boolean;
    };
  }
}

const router = express.Router();

// PostgreSQL connection with connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log database connection events
pool.on('connect', () => {
  log({ message: 'Database connection established' });
});

pool.on('error', (err) => {
  log({
      message: 'Unexpected database error',
      metadata: {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      }
    }, 'error');
});

// Check authentication status
router.get('/check', async (req: Request, res: Response) => {
  if (req.session.user) {
    try {
      const result = await pool.query(
        'SELECT id, email, first_name, last_name, is_admin FROM users WHERE id = $1',
        [req.session.user.id]
      );
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        res.json({ 
          authenticated: true, 
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            is_admin: user.is_admin
          }
        });
      } else {
        req.session.destroy(() => {
          res.json({ authenticated: false });
        });
      }
    } catch (error) {
      log({
        message: 'Database error during auth check',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      }, 'error');
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.json({ authenticated: false });
  }
});

// Sign in endpoint
router.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT id, email, first_name, last_name, password_hash, is_admin FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_admin: user.is_admin
    };

    res.json({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_admin: user.is_admin
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to sign in';
    log({
        message: 'Sign in error',
        metadata: {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }
      }, 'error');
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Sign up endpoint
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert new user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, is_admin)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, email, first_name, last_name, is_admin`,
      [email, passwordHash, firstName, lastName]
    );

    const newUser = result.rows[0];
    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      is_admin: newUser.is_admin
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to sign up';
    log({
      message: 'Sign up error',
      metadata: {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'error');
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Sign out endpoint
router.post('/signout', (req: Request, res: Response) => {
  req.session.destroy((err: Error | null) => {
    if (err) {
      log({
        message: 'Sign out error',
        metadata: {
          error: err.message,
          stack: err.stack
        }
      }, 'error');
      return res.status(500).json({ message: 'Failed to sign out' });
    }
    res.json({ message: 'Signed out successfully' });
  });
});

export default router;