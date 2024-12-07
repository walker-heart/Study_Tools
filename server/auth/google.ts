import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from '../lib/env';
import { db } from '@db/index';
import { users } from '@db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('Missing required Google OAuth credentials');
}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${env.APP_URL}/api/auth/google/callback`,
    scope: ['email', 'profile']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, profile.emails?.[0]?.value || ''))
        .limit(1);

      if (existingUser) {
        return done(null, existingUser);
      }

      // Create new user if doesn't exist
      const [newUser] = await db
        .insert(users)
        .values({
          email: profile.emails?.[0]?.value || '',
          firstName: profile.name?.givenName || '',
          lastName: profile.name?.familyName || '',
          provider: 'google',
          providerId: profile.id
        })
        .returning();

      return done(null, newUser);
    } catch (error) {
      return done(error as Error);
    }
  }
));

// Google OAuth login route
router.get('/', passport.authenticate('google', {
  scope: ['email', 'profile']
}));

// Google OAuth callback route
router.get('/callback',
  passport.authenticate('google', {
    failureRedirect: '/signin?error=google_auth_failed'
  }),
  (req, res) => {
    // Successful authentication
    res.redirect('/dashboard');
  }
);

export default router;