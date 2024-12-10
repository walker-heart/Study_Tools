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

    // First check if user exists
    const userExists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, req.session.user.id));

    if (!userExists.length) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update theme
    await db
      .update(users)
      .set({ theme })
      .where(eq(users.id, req.session.user.id));

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

    // Get user's theme preference
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.user.id));

    if (!result.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const theme = result[0].theme || 'light';
    res.json({ theme });
  } catch (error) {
    console.error('Get theme error:', error);
    res.status(500).json({ message: "Error getting theme preference" });
  }
}

export async function getOpenAIKey(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Get user's OpenAI API key
    const result = await db
      .select({ openaiApiKey: users.openaiApiKey })
      .from(users)
      .where(eq(users.id, req.session.user.id));

    if (!result.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ apiKey: result[0].openaiApiKey || '' });
  } catch (error) {
    console.error('Get OpenAI API key error:', error);
    res.status(500).json({ message: "Error retrieving API key" });
  }
}

export async function updateOpenAIKey(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { apiKey } = req.body;
    if (typeof apiKey !== 'string') {
      return res.status(400).json({ message: "Invalid API key format" });
    }

    // Update the API key
    await db
      .update(users)
      .set({ openaiApiKey: apiKey })
      .where(eq(users.id, req.session.user.id));

    res.json({ message: "API key updated successfully" });
  } catch (error) {
    console.error('Update OpenAI API key error:', error);
    res.status(500).json({ message: "Error updating API key" });
  }
}
