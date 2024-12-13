import express from 'express';
import session from 'express-session';
import { OAuth2Client } from 'google-auth-library';
import cors from 'cors';
import { Pool } from 'pg';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Profile } from 'passport-google-oauth20';
import { env } from './lib/env';

// Define User interface first
interface User {
  id?: string | number;
  google_id: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  picture?: string;
  is_admin?: boolean;
  isNewUser?: boolean;
  created_at?: Date;
  last_login?: Date;
}

// Extend express-session types
declare module 'express-session' {
  interface Session {
    authType?: 'signup' | 'signin';
    user?: {
      id: string | number;
      email: string;
      isAdmin: boolean;
    } | undefined;
  }
}

const router = express.Router();

// Use environment-specific URLs that match Google Cloud Console settings
const SITE_URL = process.env.REPLIT_ENVIRONMENT 
  ? 'https://343460df-6523-41a1-9a70-d687f288a6a5-00-25snbpzyn9827.spock.replit.dev'
  : env.NODE_ENV === 'production'
    ? 'https://wtoolsw.com'
    : 'http://localhost:5000';

// Set API URL based on the site URL
const API_URL = `${SITE_URL}/api`;

// Ensure these match exactly with Google Cloud Console Authorized redirect URIs
const CALLBACK_URL = `${API_URL}/auth/google/callback`;

// Debug URL configuration
console.log('Auth Configuration:', {
  SITE_URL,
  API_URL,
  NODE_ENV: env.NODE_ENV,
  REPLIT_ENVIRONMENT: process.env.REPLIT_ENVIRONMENT
});

// Verify the environment and URL configuration
console.log('Environment:', env.NODE_ENV);
console.log('Site URL:', SITE_URL);
console.log('API URL:', API_URL);
console.log('Is Replit Environment:', !!process.env.REPLIT_ENVIRONMENT);

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
// Configure CORS options for authentication routes
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      SITE_URL,
      'https://wtoolsw.com',
      'https://www.wtoolsw.com',
      'http://localhost:5000',
      'https://343460df-6523-41a1-9a70-d687f288a6a5-00-25snbpzyn9827.spock.replit.dev'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || origin === 'null') {
      callback(null, true);
      return;
    }

    if (env.NODE_ENV === 'development' || process.env.REPLIT_ENVIRONMENT) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

router.use(cors(corsOptions));

router.use(express.json());
router.use(session({
  secret: env.JWT_SECRET,
  resave: true,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'none',
    domain: env.NODE_ENV === 'production' ? 'wtoolsw.com' : undefined
  }
}));

// Initialize passport and session handling
router.use(passport.initialize());
router.use(passport.session());

// OAuth Setup
if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
  throw new Error('Missing required Google OAuth credentials');
}

// Get the base URL for the current environment
const getBaseUrl = () => SITE_URL;

// Get consistent callback URL using the SITE_URL constant
const getCallbackUrl = () => `${getBaseUrl()}/api/auth/google/callback`;

const oauth2Client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  getCallbackUrl()
);

// Configure Google OAuth2.0 strategy
passport.use(new GoogleStrategy({
    clientID: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    proxy: true
  },
  async (accessToken: string, refreshToken: string, profile: Profile, done) => {
    try {
      console.log('Google OAuth callback received for user:', profile.emails?.[0].value);
      const userInfo = {
        id: profile.id,
        email: profile.emails?.[0].value || '',
        name: profile.displayName,
        picture: profile.photos?.[0].value,
        isNewUser: false
      };
      
      console.log('Attempting to find or create user:', userInfo.email);
      const user = await findOrCreateUser(userInfo);
      console.log('User processed:', user.email, 'isNewUser:', user.isNewUser);
      return done(null, user);
    } catch (error) {
      console.error('Error in Google Strategy:', error);
      return done(error);
    }
  }
));

// Configure passport serialization
passport.serializeUser((user: Express.User, done) => {
  const userWithId = user as User;
  done(null, userWithId.google_id);
});

passport.deserializeUser(async (id: string, done: (err: any, user?: User | false) => void) => {
  try {
    const result = await pool.query<User>(
      'SELECT * FROM users WHERE google_id = $1',
      [id]
    );
    const user = result.rows[0];
    done(null, user || false);
  } catch (err) {
    done(err instanceof Error ? err : new Error('Unknown error'), false);
  }
});

// Database helper functions
async function findOrCreateUser(userInfo: {
  id: string;
  email: string;
  name: string;
  picture?: string;
  isNewUser: boolean;
}): Promise<User> {
  const client = await pool.connect();
  console.log('Starting database operation for user:', userInfo.email);
  
  try {
    await client.query('BEGIN');

    // Check if user exists
    const existingUser = await client.query<User>(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [userInfo.id, userInfo.email]
    );

    let result;
    if (existingUser.rows.length > 0) {
      console.log('Updating existing user:', userInfo.email);
      result = await client.query<User>(
        `UPDATE users 
         SET name = $1, 
             email = $2, 
             picture = $3, 
             google_id = $4,
             last_login = NOW()
         WHERE google_id = $4 OR email = $2
         RETURNING *`,
        [userInfo.name, userInfo.email, userInfo.picture, userInfo.id]
      );
    } else {
      console.log('Creating new user:', userInfo.email);
      result = await client.query<User>(
        `INSERT INTO users (
          google_id, email, name, picture, created_at, last_login
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *`,
        [userInfo.id, userInfo.email, userInfo.name, userInfo.picture]
      );
    }

    await client.query('COMMIT');
    console.log('Database operation successful for:', userInfo.email);
    
    return {
      ...result.rows[0],
      isNewUser: existingUser.rows.length === 0
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Auth Routes
router.get('/google', (req, res) => {
  const isSignUp = req.query.prompt === 'signup';
  
  // Get the correct URL based on environment
  const currentUrl = process.env.REPLIT_ENVIRONMENT 
    ? 'https://343460df-6523-41a1-9a70-d687f288a6a5-00-25snbpzyn9827.spock.replit.dev'
    : env.NODE_ENV === 'production'
      ? 'https://www.wtoolsw.com'
      : 'http://localhost:5000';

  // Ensure callback URL matches exactly what's registered in Google Console
  const callbackUrl = `${currentUrl}/api/auth/google/callback`;
  console.log('Using callback URL:', callbackUrl);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'openid'
    ],
    prompt: isSignUp ? 'consent select_account' : 'select_account',
    redirect_uri: callbackUrl
  });
  
  req.session.authType = isSignUp ? 'signup' : 'signin';
  res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
  try {
    console.log('Google callback received with code');
    const { code } = req.query;
    const redirectUri = getCallbackUrl();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken({
      code: code as string,
      redirect_uri: redirectUri
    });
    oauth2Client.setCredentials(tokens);

    // Verify the ID token
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('No payload received from Google');
    }

    console.log('Google auth payload received:', {
      email: payload.email,
      name: payload.name
    });

    // Create or update user in database
    const userInfo = {
      id: payload.sub || '',
      email: payload.email || '',
      name: payload.name || '',
      picture: payload.picture || '',
      isNewUser: false
    };

    console.log('Finding or creating user in database');
    const dbUser = await findOrCreateUser(userInfo);
    console.log('User processed in database:', dbUser.email);

    // Set up session
    if (req.session) {
      console.log('Setting up session for user:', dbUser.email);
      if (req.session) {
        req.session.user = {
          id: dbUser.google_id,
          email: dbUser.email,
          isAdmin: Boolean(dbUser.is_admin)
        };
      }

      // Save session explicitly
      req.session.save((err: Error | null) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect(`${getBaseUrl()}/login?error=session_error`);
        }

        console.log('Session saved successfully');
        if (dbUser.isNewUser) {
          res.redirect(`${getBaseUrl()}/welcome`);
        } else {
          res.redirect(getBaseUrl());
        }
      });
    } else {
      throw new Error('No session available');
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${getBaseUrl()}/login?error=auth_failed`);
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy((err: Error | null) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    const redirectUrl = getBaseUrl();
    res.redirect(redirectUrl);
  });
});

router.get('/status', async (req, res) => {
  console.log('Auth status check - Session:', {
    id: req.session?.id,
    user: req.session?.user,
    cookie: req.session?.cookie
  });
  console.log('Auth status check - Headers:', req.headers);
  console.log('Auth status check - Is authenticated:', req.isAuthenticated());
  
  if (req.session?.user) {
    try {
      console.log('Checking database for user:', req.session.user.id);
      // Get fresh user data from database
      const result = await pool.query(
        'SELECT * FROM users WHERE google_id = $1',
        [req.session.user.id]
      );
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        console.log('User found in database:', user.email);
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
        console.log('User not found in database');
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
    console.log('No user in session');
    res.json({ authenticated: false });
  }
});

export default router;