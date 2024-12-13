import { Router } from 'express';
import { env } from '../lib/env';
import { db } from '../db';
import { log, info, error, warn } from '../lib/log';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { users } from '../db/schema';
import type { Profile } from 'passport-google-oauth20';
import type { User } from '../types/user';
import { eq } from 'drizzle-orm';

const router = Router();

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('Missing required Google OAuth credentials');
}

// Configure passport serialization
passport.serializeUser((user: Express.User, done: (err: any, id?: number) => void) => {
  const typedUser = user as User;
  done(null, typedUser.id);
});

passport.deserializeUser(async (id: number, done: (err: any, user?: Express.User | false) => void) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id)
    });
    done(null, user || false);
  } catch (err) {
    done(err, false);
  }
});

// Initialize Google OAuth 2.0 strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.NODE_ENV === 'production'
      ? 'https://www.wtoolsw.com/api/auth/google/callback'
      : 'http://localhost:3000/api/auth/google/callback',
    scope: ['profile', 'email'],
    proxy: true
  },
  async (accessToken: string, refreshToken: string, profile: Profile, done: (error: any, user?: any) => void) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error('No email provided from Google'));
      }

      let user = await db.query.users.findFirst({
        where: eq(users.email, email)
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
        
        info({
          message: 'New user created via Google OAuth',
          metadata: {
            userId: user.id,
            email: user.email
          }
        });
      }

      return done(null, user);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Unknown error during Google authentication');
      error({
        message: 'Google auth error',
        metadata: {
          error: error.message,
          stack: error.stack
        }
      });
      return done(error);
    }
  }
));

// OAuth routes with enhanced error handling
router.get('/', (req, res, next) => {
  // Log the authentication attempt
  info({
    message: 'Google OAuth authentication initiated',
    metadata: {
      path: req.path,
      method: req.method
    }
  });
  
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res, next);
});

router.get('/callback', (req, res, next) => {
  passport.authenticate('google', (err: Error | null, user?: Express.User, info?: any) => {
    if (err) {
      error({
        message: 'Google OAuth callback error',
        metadata: {
          error: err.message,
          stack: err.stack
        }
      });
      return res.redirect('/signin?error=auth_failed');
    }

    if (!user) {
      warn({
        message: 'Google OAuth authentication failed',
        metadata: {
          info: info
        }
      });
      return res.redirect('/signin?error=auth_failed');
    }

    req.logIn(user, (err) => {
      if (err) {
        error({
          message: 'Session login error',
          metadata: {
            error: err.message,
            stack: err.stack
          }
        });
        return res.redirect('/signin?error=auth_failed');
      }

      info({
        message: 'Google OAuth authentication successful',
        metadata: {
          userId: (user as User).id
        }
      });
      
      return res.redirect('/dashboard');
    });
  })(req, res, next);
});

export default router;