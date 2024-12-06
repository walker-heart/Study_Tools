import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../lib/env';

const router = Router();

const oauth2Client = new OAuth2Client(
  env.VITE_GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api/auth/google/callback`
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
      audience: process.env.VITE_GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('No payload');
    }

    // Store user in database or session
    const user = {
      email: payload.email ?? '',
      name: payload.name ?? '',
      picture: payload.picture,
      googleId: payload.sub ?? ''
    };

    // Validate required fields
    if (!user.email || !user.name) {
      throw new Error('Required user information missing from Google response');
    }

    if (req.session) {
      req.session.user = user;
    }

    res.redirect('/dashboard');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/signin?error=auth_failed');
  }
});

export default router;
