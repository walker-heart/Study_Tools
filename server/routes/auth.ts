import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users } from "@db/schema";
import { env } from "../lib/env";

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      email: string;
    };
    authenticated?: boolean;
  }
}

const { JWT_SECRET } = env;

export async function signUp(req: Request, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email));
    if (existingUser.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const [newUser] = await db.insert(users).values({
      firstName,
      lastName,
      email,
      passwordHash,
      provider: 'local'
    }).returning();

    // Generate JWT token
    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '24h' });

    // Set user session
    req.session.user = {
      id: newUser.id,
      email: newUser.email
    };
    req.session.authenticated = true;

    res.status(201).json({ token, user: { id: newUser.id, email: newUser.email } });
  } catch (error) {
    next(error);
  }
}

export async function checkAuth(req: Request, res: Response) {
  if (req.session.authenticated && req.session.user?.id) {
    res.json({ 
      authenticated: true, 
      user: { 
        id: req.session.user.id, 
        email: req.session.user.email 
      } 
    });
  } else {
    res.status(401).json({ authenticated: false });
  }
}

export async function signIn(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Set user session
    req.session.user = {
      id: user.id,
      email: user.email
    };
    req.session.authenticated = true;
    
    // Also send JWT token for API authentication
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
}

export async function signOut(req: Request, res: Response, next: NextFunction) {
  try {
    req.session.destroy((err) => {
      if (err) {
        throw err;
      }
      res.json({ message: "Logged out successfully" });
    });
  } catch (error) {
    next(error);
  }
}
