import { Router, Request } from 'express';
import { env } from '../lib/env';
import { db } from '../db';
import { log, info, error } from '../lib/log';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Profile, StrategyOptions } from 'passport-google-oauth20';
import type { AuthenticateOptions } from 'passport';
import crypto from 'crypto';
import { users } from '../../db/schema/users';
import type { User } from '../types/user';
import { eq } from 'drizzle-orm';

const router = Router();

if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
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

// Get the appropriate callback URL based on the environment
function getCallbackURL(): string {
  // Exactly match the authorized redirect URIs from Google Cloud Console
  const baseUrl = env.NODE_ENV === 'production'
    ? 'https://www.wtoolsw.com'
    : process.env.REPLIT_ENVIRONMENT
      ? 'https://343460df-6523-41a1-9a70-d687f288a6a5-00-25snbpzyn9827.spock.replit.dev'
      : 'http://localhost:5000';
  const callbackUrl = `${baseUrl}/api/auth/google/callback`;
  console.log('Google Auth Callback URL:', callbackUrl);
  console.log('Environment:', env.NODE_ENV);
  console.log('Is Replit Environment:', !!process.env.REPLIT_ENVIRONMENT);
  return callbackUrl;
}

// Initialize Google OAuth 2.0 strategy
const strategyConfig: StrategyOptions = {
  clientID: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  callbackURL: getCallbackURL(),
  passReqToCallback: false,
  scope: ['profile', 'email']
};

passport.use(new GoogleStrategy(strategyConfig, 
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
      const errorObj = err instanceof Error ? err : new Error('Unknown error during Google authentication');
      error({
        message: 'Google auth error',
        metadata: {
          error: errorObj.message,
          stack: errorObj.stack
        }
      });
      return done(errorObj);
    }
  }
));

// OAuth routes with enhanced error handling
router.get('/', (req, res, next) => {
  const state = crypto.randomBytes(32).toString('hex');
  
  info({
    message: 'Google OAuth authentication initiated',
    metadata: {
      path: req.path,
      method: req.method,
      state
    }
  });

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state,
    prompt: 'select_account'
  })(req, res, next);
});

router.get('/callback', (req, res, next) => {
  passport.authenticate('google', {
    failureRedirect: '/signin?error=auth_failed',
    successRedirect: '/dashboard',
    failureMessage: true
  })(req, res, next);
});

export default router;