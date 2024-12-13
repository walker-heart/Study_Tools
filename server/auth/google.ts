import { Router } from 'express';
import { env } from '../lib/env';
import { db } from '../db';
import { log } from '../lib/log';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { users } from '../db/schema';
import type { Profile } from 'passport-google-oauth20';
import type { User } from '../types/user';

const router = Router();

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('Missing required Google OAuth credentials');
}

// Configure passport serialization
passport.serializeUser((user: User, done: (err: any, id?: string) => void) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done: (err: any, user?: User | false) => void) => {
  try {
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, id)
    });
    done(null, user || false);
  } catch (err) {
    done(err, false);
  }
});

// Initialize Google OAuth 2.0 strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${env.APP_URL}/api/auth/google/callback`,
    scope: ['profile', 'email']
  },
  async (accessToken: string, refreshToken: string, profile: Profile, done: Function) => {
    try {
      const email = profile.emails?.[0].value;
      if (!email) {
        return done(new Error('No email provided from Google'));
      }

      let user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, email)
      });

      if (!user) {
        const displayName = profile.displayName || email.split('@')[0];
        const [firstName, ...lastNameParts] = displayName.split(' ');
        const lastName = lastNameParts.join(' ') || firstName;
        
        const newUser = {
          email,
          firstName,
          lastName,
          passwordHash: `google_auth_${profile.id}`,
          isAdmin: false,
          theme: 'light' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const result = await db.insert(users)
          .values(newUser)
          .returning();
        user = result[0];
        
        log.info({
          message: 'New user created via Google OAuth',
          metadata: {
            userId: user.id,
            email: user.email
          }
        });
      }

      return done(null, user);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error during Google authentication');
      log.error({
        message: 'Google auth error',
        metadata: {
          error: err.message,
          stack: err.stack
        }
      });
      return done(err);
    }
  }
));

// OAuth routes
router.get('/', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/callback', passport.authenticate('google', {
  successRedirect: '/dashboard',
  failureRedirect: '/signin?error=auth_failed'
}));

export default router;