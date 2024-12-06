import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../lib/env';
import pkg from 'pg';
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

const oauth2Client = new OAuth2Client(
  env.VITE_GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  `${env.APP_URL}/api/auth/google/callback`  // Use environment variable for consistency
);

router.get('/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'openid'
    ]
  });
  res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: env.VITE_GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('No payload');
    }

    // Store user in database and session
    const user = {
      email: payload.email ?? '',
      name: payload.name ?? '',
      picture: payload.picture ?? '',
      google_id: payload.sub ?? ''
    };

    // Validate required fields
    if (!user.email || !user.name || !user.google_id) {
      throw new Error('Required user information missing from Google response');
    }

    try {
      // Insert or update user in database
      const result = await pool.query(
        `INSERT INTO users (email, name, picture, google_id) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (google_id) 
         DO UPDATE SET email = $1, name = $2, picture = $3
         RETURNING id`,
        [user.email, user.name, user.picture, user.google_id]
      );

      const userId = result.rows[0].id;
      
      if (req.session) {
        req.session.user = { ...user, id: userId };
        req.session.authenticated = true;
      }

      res.redirect('/dashboard');
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save user information');
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Detailed error:', errorMessage);
    console.error('Full error object:', JSON.stringify(error, null, 2));
    console.error('OAuth client configuration:', {
      clientId: env.VITE_GOOGLE_CLIENT_ID ? 'Set' : 'Not set',
      clientSecret: env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set',
      redirectUri: `${env.APP_URL}/api/auth/google/callback`
    });
    res.redirect(`/signin?error=auth_failed&message=${encodeURIComponent(errorMessage)}`);
  }
});

export default router;
