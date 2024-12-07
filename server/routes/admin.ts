import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../db/schema/users";

// Middleware to check if user is admin
export async function requireAdmin(req: Request, res: Response, next: Function) {
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
}

// List all users
export async function listUsers(req: Request, res: Response) {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt
      })
      .from(users)
      .orderBy(users.createdAt);

    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: "Error fetching users" });
  }
}

// Update user
export async function updateUser(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const { firstName, lastName, email, isAdmin } = req.body;

    const [updatedUser] = await db
      .update(users)
      .set({
        firstName,
        lastName,
        email,
        isAdmin,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: "Error updating user" });
  }
}

// Delete user
export async function deleteUser(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    
    // Prevent deleting self
    if (userId === req.session.user?.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    await db.delete(users).where(eq(users.id, userId));
    
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: "Error deleting user" });
  }
}
