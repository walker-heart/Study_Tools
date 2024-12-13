import express from 'express';
import type { Request, Response } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

// Define user type for type safety
interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
}

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      name: string;
    };
  }
}

const router = express.Router();

// PostgreSQL connection
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

// Check authentication status
router.get('/check', async (req: Request, res: Response) => {
  if (req.session.user) {
    try {
      const result = await pool.query(
        'SELECT id, email, name FROM users WHERE id = $1',
        [req.session.user.id]
      );
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        res.json({ 
          authenticated: true, 
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        });
      } else {
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

// Sign in endpoint
router.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
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
      name: user.name
    };

    res.json({
      id: user.id,
      email: user.email,
      name: user.name
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to sign in';
    console.error('Sign in error:', errorMessage);
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
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name`,
      [email, passwordHash, `${firstName} ${lastName}`]
    );

    const newUser = result.rows[0];
    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to sign up';
    console.error('Sign up error:', errorMessage);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Sign out endpoint
router.post('/signout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Sign out error:', err);
      return res.status(500).json({ message: 'Failed to sign out' });
    }
    res.json({ message: 'Signed out successfully' });
  });
});

export default router;
