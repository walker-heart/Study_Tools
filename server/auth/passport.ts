import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { db } from "../db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { type User } from "@db/schema";

// Setup passport serialization
passport.serializeUser((user: User, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Configure Google Strategy
const setupGoogleStrategy = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: "/api/auth/google/callback",
        scope: ["email", "profile"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Find or create user
          let [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, profile.emails?.[0]?.value || ""))
            .limit(1);

          if (!user) {
            const [newUser] = await db
              .insert(users)
              .values({
                email: profile.emails?.[0]?.value || "",
                name: profile.displayName,
                googleId: profile.id,
              })
              .returning();
            user = newUser;
          }

          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
};

export const initializePassport = () => {
  setupGoogleStrategy();
  return passport.initialize();
};

export const initializeSession = () => {
  return passport.session();
};

export default passport;
