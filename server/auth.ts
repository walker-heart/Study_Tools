import express from 'express';
import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { auth } from 'firebase-admin';
import { log } from './lib/log';
import { AuthenticationError } from './lib/errorTracking';
import type { User as DbUser } from '../db/schema/users';

// Define user type for type safety
interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  firebaseUid: string;
}

// Extend express Request type to include user from Firebase
declare global {
  namespace Express {
    interface Request {
      user?: auth.DecodedIdToken;
    }
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
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.json({ authenticated: false });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth().verifyIdToken(token);
    
    const result = await pool.query<DbUser>(
      'SELECT id, email, first_name as "firstName", last_name as "lastName", is_admin as "isAdmin" FROM users WHERE firebase_uid = $1',
      [decodedToken.uid]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      res.json({ 
        authenticated: true, 
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin
        }
      });
    } else {
      res.json({ authenticated: false });
    }
  } catch (error) {
    log({
      message: 'Auth check error',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'error');
    res.json({ authenticated: false });
  }
});

// Create or update user profile after Firebase authentication
router.post('/profile', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName } = req.body;
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const result = await pool.query<DbUser>(
      `INSERT INTO users (email, first_name, last_name, firebase_uid, is_admin)
       VALUES ($1, $2, $3, $4, false)
       ON CONFLICT (firebase_uid) 
       DO UPDATE SET first_name = $2, last_name = $3, email = $1
       RETURNING id, email, first_name as "firstName", last_name as "lastName", is_admin as "isAdmin"`,
      [req.user.email, firstName, lastName, req.user.uid]
    );

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.isAdmin
    });
  } catch (error) {
    log({
      message: 'Profile update error',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'error');
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;