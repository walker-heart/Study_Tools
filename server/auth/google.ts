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

// Get the current domain from the request
const getCallbackUrl = () => {
  // Always use env.APP_URL which is already configured for different environments
  return `${env.APP_URL}/api/auth/google/callback`;
};

// Log the possible callback URLs for debugging
console.log('Possible callback URLs:', {
  production: process.env.APP_URL ? `${process.env.APP_URL}/api/auth/google/callback` : 'not set',
  replit: process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.repl.co/api/auth/google/callback` : 'not set',
  local: 'http://localhost:5000/api/auth/google/callback'
});

// Initialize OAuth client with a default callback URL (will be updated per request)
const oauth2Client = new OAuth2Client(
  env.VITE_GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET
);

router.get('/', (_req, res) => {
  try {
    // Set the callback URL for this request
    const callback = getCallbackUrl();
    console.log('Generated callback URL:', callback);
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      redirect_uri: callback,
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'openid'
      ],
      prompt: 'consent'
    });
    console.log('Generated auth URL:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error in auth route:', error);
    res.redirect(`${env.APP_URL}/signin?error=auth_init_failed`);
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const callback = getCallbackUrl();
    const { tokens } = await oauth2Client.getToken({
      code: code as string,
      redirect_uri: callback
    });
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

      const redirectUrl = `${env.APP_URL}/dashboard`;
      console.log('Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
    } catch (dbError) {
      console.error('Database error:', dbError);
      const redirectUrl = `${env.APP_URL}/signin?error=database_error`;
      console.log('Error redirect to:', redirectUrl);
      res.redirect(redirectUrl);
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
    const redirectUrl = `${env.APP_URL}/signin?error=auth_failed&message=${encodeURIComponent(errorMessage)}`;
    console.log('Error redirect to:', redirectUrl);
    res.redirect(redirectUrl);
  }
});

export default router;
