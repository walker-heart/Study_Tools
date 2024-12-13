import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { users } from "../../db/schema/users";
import { Router } from 'express';

// Initialize router
const router = Router();

async function signUp(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

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
      email,
      passwordHash,
      theme: 'light',
      isAdmin: false,
    }).returning();

    // Set session
    req.session.user = {
      id: newUser.id,
      email: newUser.email
    };
    req.session.authenticated = true;

    // Save session
    await new Promise<void>((resolve, reject) => {
      req.session.save((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.status(201).json({ 
      message: "User created successfully",
      user: {
        id: newUser.id,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ message: "Error creating user" });
  }
}

async function signIn(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Set session
    req.session.user = {
      id: user.id,
      email: user.email
    };
    req.session.authenticated = true;

    // Save session
    await new Promise<void>((resolve, reject) => {
      req.session.save((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ 
      message: "Signed in successfully",
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Sign in error:', error);
    res.status(500).json({ message: "Error signing in" });
  }
}

async function signOut(req: Request, res: Response) {
  try {
    // Clear session
    req.session.destroy((err: Error | null) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ message: "Error signing out" });
      }

      // Clear session cookie
      res.clearCookie('connect.sid');
      res.json({ message: "Signed out successfully" });
    });
  } catch (error) {
    console.error('Sign out error:', error);
    res.status(500).json({ message: "Error signing out" });
  }
}

async function checkAuth(req: Request, res: Response) {
  if (req.session.authenticated && req.session.user?.id) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.user.id,
        email: req.session.user.email
      }
    });
  } else {
    res.status(401).json({ 
      authenticated: false,
      message: "Not authenticated"
    });
  }
}

// Configure routes
router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', signOut);
router.get('/check', checkAuth);

export default router;