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
      console.error('Missing required fields:', { text: !!text, voice: !!voice });
      return res.status(400).json({ message: "Missing required fields" });
    }

    console.log('Generating speech for text:', text.substring(0, 50) + '...');
    console.log('Selected voice:', voice);
    console.log('Request body:', req.body); // Added logging for request body

    // Get user's OpenAI API key
    console.log('Retrieving OpenAI API key for user:', req.session.user.id);
    const result = await db
      .select({ openaiApiKey: users.openaiApiKey })
      .from(users)
      .where(eq(users.id, req.session.user.id));

    console.log('Database query result:', {
      hasResult: result.length > 0,
      hasApiKey: result.length > 0 && !!result[0].openaiApiKey,
    });

    if (!result.length || !result[0].openaiApiKey) {
      console.error('OpenAI API key not found for user:', req.session.user.id);
      return res.status(400).json({ message: "No API key configured" });
    }

    const apiKey = result[0].openaiApiKey;
    console.log('API Key retrieved:', apiKey.substring(0, 10) + '...');
    
    if (!apiKey.startsWith('sk-')) {
      console.error('Invalid OpenAI API key format');
      return res.status(400).json({ message: "Invalid API key format" });
    }

    console.log('API key validation passed, initializing OpenAI client...');

    console.log('Initializing OpenAI client...');
    const openai = new OpenAI({ apiKey });

    try {
      console.log('Preparing OpenAI TTS API request...');
      console.log('Request parameters:', {
        model: "tts-1",
        voice,
        textLength: text.length,
        hasValidKey: !!apiKey,
        keyPrefix: apiKey.substring(0, 10)
      });
      
      if (!text.trim()) {
        throw new Error('Empty text provided');
      }

      console.log('Initiating OpenAI API call...');
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice,
        input: text,
        response_format: "mp3",
      });

      console.log('OpenAI API call completed:', {
        success: !!mp3,
        responseType: mp3 ? typeof mp3 : 'null'
      });

      if (!mp3) {
        throw new Error('No response from OpenAI TTS API');
      }
      
      console.log('OpenAI API response received');

      console.log('Converting response to buffer...');
      const arrayBuffer = await mp3.arrayBuffer();
      console.log('Received array buffer type:', typeof arrayBuffer);
      
      const buffer = Buffer.from(arrayBuffer);
      console.log('Converted to Buffer, length:', buffer.length);

      if (buffer.length === 0) {
        throw new Error('Received empty buffer from OpenAI');
      }

      console.log('Audio buffer size:', buffer.length, 'bytes');
      console.log('Buffer is valid:', buffer.length > 0);

      // Log successful API usage
      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/user/generate-speech",
        tokensUsed: Math.ceil(text.length / 4),
        cost: 0.015 * (text.length / 1000),
        success: true,
        resourceType: 'speech'
      });

      console.log('Setting response headers...');
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length,
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-cache',
        'Accept-Ranges': 'bytes'
      });
      
      // Verify buffer contains valid MP3 data (should start with ID3 or be a valid MP3 frame)
      const isValidMP3 = buffer.length > 2 && 
        ((buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) || // ID3
         (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)); // MP3 frame
      
      if (!isValidMP3) {
        console.error('Invalid MP3 data detected');
        throw new Error('Invalid audio data received from OpenAI');
      }
      
      console.log('Sending audio response...');
      res.status(200).send(buffer);
    } catch (err) {
      console.error('OpenAI API Error:', err);
      
      // Log failed attempt
      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/user/generate-speech",
        tokensUsed: 0,
        cost: 0,
        success: false,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        resourceType: 'speech'
      });

      res.status(500).json({ 
        message: err instanceof Error ? err.message : "Failed to generate speech",
        details: err instanceof Error ? err.message : "Unknown error"
      });
      return;
    }
  } catch (error) {
    console.error('Server Error:', error);
    
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
    
    res.status(500).json({ 
      message: "Error generating speech",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}