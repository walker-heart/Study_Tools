import { Request, Response } from "express";
import { getAPIUsageStats, logAPIUsage, calculateTokenCost } from "../lib/apiMonitoring";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../db/schema/users";
import OpenAI from "openai";

// Test endpoint for OpenAI API usage
export async function testOpenAIEndpoint(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Get user's OpenAI API key
    const result = await db
      .select({ openaiApiKey: users.openaiApiKey })
      .from(users)
      .where(eq(users.id, req.session.user.id));

    if (!result.length || !result[0].openaiApiKey) {
      return res.status(400).json({ message: "No API key configured" });
    }

    const openai = new OpenAI({ apiKey: result[0].openaiApiKey });

    // Make a simple test completion
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: "Say hello for testing API monitoring" }],
      model: "gpt-3.5-turbo",
    });

    // Log the API usage
    const tokensUsed = completion.usage?.total_tokens || 0;
    await logAPIUsage({
      userId: req.session.user.id,
      endpoint: "/api/user/test-openai",
      tokensUsed,
      cost: calculateTokenCost(tokensUsed, "gpt-3.5-turbo"),
      success: true
    });

    res.json({ 
      message: "Test completed successfully",
      response: completion.choices[0].message.content,
      tokensUsed,
      model: "gpt-3.5-turbo"
    });
  } catch (error) {
    console.error('Test OpenAI endpoint error:', error);
    
    // Log failed attempt if authenticated
    if (req.session.user?.id) {
      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/user/test-openai",
        tokensUsed: 0,
        cost: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      });
    }
    
    res.status(500).json({ message: "Error testing OpenAI API" });
  }
}

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

export async function getUserAPIStats(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const days = parseInt(req.query.days as string) || 30;
    
    const stats = await getAPIUsageStats(req.session.user.id, days);
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching API usage stats:', error);
    res.status(500).json({ message: "Error fetching API usage statistics" });
  }
}

export async function generateSpeech(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { text, voice } = req.body;
    if (!text || !voice) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Get user's OpenAI API key
    const result = await db
      .select({ openaiApiKey: users.openaiApiKey })
      .from(users)
      .where(eq(users.id, req.session.user.id));

    if (!result.length || !result[0].openaiApiKey) {
      return res.status(400).json({ message: "No API key configured" });
    }

    const openai = new OpenAI({ apiKey: result[0].openaiApiKey });

    // Generate speech using OpenAI's TTS API
    try {
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice,
        input: text,
      });

      // Get the audio data as a Buffer
      const audioData = await mp3.arrayBuffer();
      const buffer = Buffer.from(audioData);

      // Log successful API usage
      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/user/generate-speech",
        tokensUsed: Math.ceil(text.length / 4), // Approximate token count
        cost: 0.015 * (text.length / 1000), // $0.015 per 1K characters
        success: true,
        resourceType: 'speech'
      });

      // Set proper headers for audio streaming
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length,
        'Cache-Control': 'no-cache',
        'Content-Disposition': 'attachment; filename="speech.mp3"'
      });
      
      // Send the audio buffer
      res.send(buffer);
    } catch (err) {
      console.error('Speech generation error:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to generate speech');
    }
  } catch (error) {
    console.error('Speech generation error:', error);
    
    // Log failed attempt
    if (req.session.user?.id) {
      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/user/generate-speech",
        tokensUsed: 0,
        cost: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        resourceType: 'speech'
      });
    }
    
    res.status(500).json({ message: "Error generating speech" });
  }
}