import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../db/schema/users";

export async function updateTheme(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { theme } = req.body;
    if (theme !== 'light' && theme !== 'dark') {
      return res.status(400).json({ message: "Invalid theme value" });
    }

    // Update user's theme preference using SQL
    const result = await db
      .update(users)
      .set({ theme })
      .where(eq(users.id, req.session.user.id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ theme });
  } catch (error) {
    console.error('Update theme error:', error);
    res.status(500).json({ message: "Error updating theme preference" });
  }
}

export async function getTheme(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Get user's theme preference using SQL
    const result = await db.select({ theme: users.theme }).from(users).where(eq(users.id, req.session.user.id));
    if (result.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result[0];
    res.json({ theme: user.theme || 'light' });
  } catch (error) {
    console.error('Get theme error:', error);
    res.status(500).json({ message: "Error getting theme preference" });
  }
}
