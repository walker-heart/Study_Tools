import { Router } from 'express';
import { env } from '../lib/env';
import { db } from '../db';
import { log } from '../lib/log';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { users } from '../db/schema';
import { Profile } from 'passport-google-oauth20';

const router = Router();

// Initialize Google OAuth 2.0 strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: `${env.APP_URL}/api/auth/google/callback`,
    scope: ['profile', 'email']
  },
  async (accessToken: string, refreshToken: string, profile: Profile, done: Function) => {
    try {
      // Find or create user
      const email = profile.emails?.[0].value;
      if (!email) {
        return done(new Error('No email provided from Google'));
      }

      let user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, email)
      });

      if (!user) {
        // Create new user
        const displayName = profile.displayName || email.split('@')[0];
        const [firstName, ...lastNameParts] = displayName.split(' ');
        const lastName = lastNameParts.join(' ') || firstName;
        
        const newUser = {
          email,
          firstName,
          lastName,
          passwordHash: `google_auth_${profile.id}`, // Placeholder password hash for Google auth
          isAdmin: false,
          theme: 'light' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const result = await db.insert(users)
          .values(newUser)
          .returning();
        user = result[0];
      }

      return done(null, user);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error during Google authentication');
      console.error('Google auth error:', err);
      return done(err);
    }
  }
));

router.get('/init', (req, res) => {
  try {
    // Generate OAuth URL
    const authUrl = `${env.APP_URL}/api/auth/google`;
    res.json({ url: authUrl });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error during auth initialization');
    console.error('Auth init error:', err);
    res.status(500).json({ error: 'Failed to initialize authentication' });
  }
});

router.get('/', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/callback', passport.authenticate('google', {
  successRedirect: '/dashboard',
  failureRedirect: '/signin?error=auth_failed'
}));

export default router;