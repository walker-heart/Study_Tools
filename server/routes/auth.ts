import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users } from "../../db/schema/users";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export async function signUp(req: Request, res: Response) {
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
    }).returning();

    // Generate JWT token
    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({ token });
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ message: "Error creating user" });
  }
}

// Add session check endpoint
export async function checkAuth(req: Request, res: Response) {
  if (req.session.userId) {
    res.json({ authenticated: true, user: { id: req.session.userId, email: req.session.email } });
  } else {
    res.status(401).json({ authenticated: false });
  }
}

export async function signIn(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

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

    // Set user session
    req.session.userId = user.id;
    req.session.email = user.email;
    
    // Also send JWT token for API authentication
    const token = jwt.sign({ userId: user.id }, JWT_SECRET!, { expiresIn: '24h' });

    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Sign in error:', error);
    res.status(500).json({ message: "Error signing in" });
  }
}
