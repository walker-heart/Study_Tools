import passport from "passport";
import { db } from "../db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { type User } from "@db/schema";

// Setup passport serialization
passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

export const initializePassport = () => {
  return passport.initialize();
};

export const initializeSession = () => {
  return passport.session();
};

export default passport;
