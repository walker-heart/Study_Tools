import express from 'express';
import session from 'express-session';
import { OAuth2Client } from 'google-auth-library';
import cors from 'cors';
import { Pool } from 'pg';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Profile } from 'passport-google-oauth20';

// Extend express-session types
declare module 'express-session' {
  interface Session {
    authType?: 'signup' | 'signin';
    user?: {
      id: string;
      email: string;
      isAdmin?: boolean;
    };
  }
}

const app = express();
const router = express.Router();

// Use environment-specific URLs
const SITE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000'
  : 'https://www.wtoolsw.com';
const API_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3000/api'
  : 'https://www.wtoolsw.com/api';

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
  console.error('Unexpected database error:', err);
});

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Initial database connection error:', err);
  } else {
    console.log('Initial database connection successful at:', res.rows[0].now);
  }
});

// Enhanced test endpoint with more debugging info
router.get('/test-db', async (req, res) => {
  console.log('Test-db endpoint called');
  try {
    // Test basic connection
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('Connection test successful:', connectionTest.rows[0].now);

    // Try to create the users table if it doesn't exist
    console.log('Attempting to create/verify users table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        picture TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('Users table created/verified successfully');

    // Get count of users
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log('Current user count:', userCount.rows[0].count);

    // Test inserting a dummy user
    try {
      const testUser = await pool.query(`
        INSERT INTO users (google_id, email, name, picture)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (google_id) DO NOTHING
        RETURNING *
      `, ['test_id', 'test@example.com', 'Test User', 'https://example.com/pic.jpg']);
      console.log('Test user insertion result:', testUser.rows);
    } catch (insertError) {
      console.log('Test user already exists or insertion failed:', insertError instanceof Error ? insertError.message : 'Unknown error');
    }

    // Return comprehensive status
    res.json({ 
      status: 'All database tests completed successfully',
      connection: {
        timestamp: connectionTest.rows[0].now,
        pool: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        }
      },
      database: {
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        port: process.env.PGPORT
      },
      users: {
        count: parseInt(userCount.rows[0].count)
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      error: 'Database test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      config: {
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        port: process.env.PGPORT
      }
    });
  }
});

// Middleware setup
app.use(cors({
  origin: SITE_URL,
  credentials: true
}));

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'none',
    domain: '.wtoolsw.com'
  }
}));

// OAuth Setup
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('Missing required Google OAuth credentials');
}

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${SITE_URL}/auth/google/callback`
);

// Define User type for TypeScript
interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  picture?: string;
}

// Initialize passport and session handling
app.use(passport.initialize());
app.use(passport.session());

// Configure Google OAuth2.0 strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: `${SITE_URL}/auth/google/callback`
  },
  async (accessToken: string, refreshToken: string, profile: Profile, done: any) => {
    try {
      const userInfo = {
        id: profile.id,
        email: profile.emails?.[0].value || '',
        name: profile.displayName,
        picture: profile.photos?.[0].value,
        isNewUser: false
      };
      
      const user = await findOrCreateUser(userInfo);
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Configure passport serialization
passport.serializeUser((user: any, done: (err: any, id?: string) => void) => {
  done(null, user.google_id);
});

passport.deserializeUser(async (id: string, done: (err: any, user?: User | false) => void) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE google_id = $1', [id]);
    const user = result.rows[0];
    done(null, user || false);
  } catch (err) {
    done(err, false);
  }
});

// Database helper functions
async function findOrCreateUser(userInfo: {
  id: string;
  email: string;
  name: string;
  picture?: string;
  isNewUser: boolean;
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user exists
    const existingUser = await client.query(
      'SELECT * FROM users WHERE google_id = $1',
      [userInfo.id]
    );

    if (existingUser.rows.length > 0) {
      // Update existing user
      await client.query(
        `UPDATE users 
         SET name = $1, email = $2, picture = $3, last_login = NOW()
         WHERE google_id = $4
         RETURNING *`,
        [userInfo.name, userInfo.email, userInfo.picture, userInfo.id]
      );
      await client.query('COMMIT');
      return { ...existingUser.rows[0], isNewUser: false };
    } else {
      // Create new user
      const newUser = await client.query(
        `INSERT INTO users (
          google_id, email, name, picture, created_at, last_login
        ) VALUES ($1, $2, $3, COALESCE($4, NULL), NOW(), NOW())
        RETURNING *`,
        [userInfo.id, userInfo.email, userInfo.name, userInfo.picture || null]
      );
      await client.query('COMMIT');
      return { ...newUser.rows[0], isNewUser: true };
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Auth Routes
router.get('/google', (req, res) => {
  const isSignUp = req.query.prompt === 'signup';
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'openid'
    ],
    prompt: isSignUp ? 'consent select_account' : 'select_account'
  });
  
  req.session.authType = isSignUp ? 'signup' : 'signin';
  res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('No payload received from Google');
    }

    const userInfo = {
      id: payload.sub || '',
      email: payload.email || '',
      name: payload.name || '',
      picture: payload.picture || '',
      isNewUser: req.session.authType === 'signup'
    };

    // Save or update user in database
    const dbUser = await findOrCreateUser(userInfo);

    // Store user info in session
    req.session.user = {
      ...dbUser,
      id: dbUser.google_id // Use google_id as the user id
    };

    // Clear auth type from session
    delete req.session.authType;

    if (dbUser.isNewUser) {
      res.redirect(`${SITE_URL}/welcome`);
    } else {
      res.redirect(SITE_URL);
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${SITE_URL}/login?error=auth_failed`);
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.redirect(SITE_URL);
  });
});

router.get('/status', async (req, res) => {
  if (req.session.user) {
    try {
      // Get fresh user data from database
      const result = await pool.query(
        'SELECT * FROM users WHERE google_id = $1',
        [req.session.user.id]
      );
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        res.json({ 
          authenticated: true, 
          user: {
            id: user.google_id,
            email: user.email,
            name: user.name,
            picture: user.picture,
            created_at: user.created_at,
            last_login: user.last_login
          }
        });
      } else {
        // User not found in database
        req.session.destroy(() => {
          res.json({ authenticated: false });
        });
      }
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.json({ authenticated: false });
  }
});

export default router; 