import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users } from "../../db/schema/users";
import { sql } from "drizzle-orm";
import { env } from "../lib/env";
const { JWT_SECRET } = env;

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
  if (req.session.user?.id) {
    res.json({ authenticated: true, user: { id: req.session.user.id, email: req.session.user.email } });
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
    req.session.user = {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin
    };
    req.session.authenticated = true;
    
    // Save session explicitly
    await new Promise<void>((resolve, reject) => {
      req.session.save((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Create a session record in the database
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await sql`
      INSERT INTO user_sessions (user_id, ip_address)
      VALUES (${user.id}, ${ipAddress})
    `;
    
    // Also send JWT token for API authentication
    const token = jwt.sign({ userId: user.id }, JWT_SECRET!, { expiresIn: '24h' });

    // Set cookie headers explicitly
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    const origin = req.get('origin');
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    // Include theme in the response
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email,
        theme: user.theme || 'light',
        isAdmin: user.isAdmin || false
      } 
    });
  } catch (error) {
    console.error('Sign in error:', error);
    res.status(500).json({ message: "Error signing in" });
  }
}
export async function signOut(req: Request, res: Response) {
  try {
    const userId = req.session?.user?.id;
    
    // Clear user session from database if user exists
    if (userId) {
      try {
        await db.execute(sql`
          UPDATE user_sessions 
          SET ended_at = NOW() 
          WHERE user_id = ${userId} 
          AND ended_at IS NULL
        `);
      } catch (dbError) {
        console.error('Database error during sign out:', dbError);
        // Continue with session destruction even if DB update fails
      }
    }

    // Clear session data
    req.session.authenticated = false;
    req.session.user = undefined;

    // Destroy session and clear cookie
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err: Error | null) => {
        if (err) {
          console.error('Error destroying session:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Clear cookies after session is destroyed
    res.clearCookie('sid', {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.status(200).json({ message: "Signed out successfully" });
  } catch (error) {
    console.error('Sign out error:', error);
    // Ensure we haven't already sent headers
    if (!res.headersSent) {
      res.status(500).json({ message: "Error signing out" });
    }
  }
}

export async function checkAdmin(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const [user] = await db
      .select({
        isAdmin: users.isAdmin
      })
      .from(users)
      .where(eq(users.id, req.session.user.id))
      .limit(1);

    console.log('Admin check for user:', req.session.user.id, 'Result:', user);
    
    res.json({ isAdmin: user?.isAdmin || false });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ message: "Error checking admin status" });
  }
}

// Admin middleware to check if user is admin
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const [user] = await db
      .select({
        isAdmin: users.isAdmin
      })
      .from(users)
      .where(eq(users.id, req.session.user.id))
      .limit(1);

    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }

    next();
  } catch (error) {
    console.error('Error in admin middleware:', error);
    res.status(500).json({ message: "Error checking admin status" });
  }
}

// Get all users (admin only)
export async function getUsers(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * limit;

    type UserSelect = typeof users.$inferSelect;
    
    const baseQuery = db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt
    }).from(users);

    // Add search condition if search query exists
    const query = search 
      ? baseQuery.where(
          sql`LOWER(${users.firstName}) LIKE LOWER(${'%' + search + '%'}) OR 
              LOWER(${users.lastName}) LIKE LOWER(${'%' + search + '%'}) OR 
              LOWER(${users.email}) LIKE LOWER(${'%' + search + '%'})`
        )
      : baseQuery;

    // Get total count for pagination
    const [{ count }] = await db.select({
      count: sql<number>`count(*)::int`
    }).from(users);

    // Get paginated results
    const usersList = await query.limit(limit).offset(offset);

    res.json({
      users: usersList,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: "Error fetching users" });
  }
}

// Update user (admin only)
export async function updateUser(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const { firstName, lastName, email, isAdmin } = req.body;

    // Validate inputs
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if email is taken by another user
    const existingUser = await db
      .select()
      .from(users)
      .where(sql`${users.email} = ${email} AND ${users.id} != ${userId}`);

    if (existingUser.length > 0) {
      return res.status(400).json({ message: "Email already taken" });
    }

    // Prevent admin from removing their own admin status
    if (req.session.user?.id === userId && isAdmin === false) {
      return res.status(400).json({ message: "Cannot remove your own admin status" });
    }

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set({
        firstName,
        lastName,
        email,
        ...(typeof isAdmin === 'boolean' ? { isAdmin } : {})
      })
      .where(eq(users.id, userId))
      .returning();

    console.log('Updated user:', updatedUser);
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: "Error updating user" });
  }
}

// Update user password (admin only)
export async function updateUserPassword(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: "Invalid password" });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Update user's password
    const [updatedUser] = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId))
      .returning();

    console.log('Updated user password:', userId);
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error('Error updating user password:', error);
    res.status(500).json({ message: "Error updating user password" });
  }
}