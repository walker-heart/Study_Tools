import { Request, Response } from "express";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { users } from "../db/schema";
import OpenAI from "openai";
import { logAPIUsage, calculateTokenCost } from "../lib/apiMonitoring";

export async function getTheme(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      console.log('Theme request without authentication');
      return res.status(401).json({ message: "Not authenticated" });
    }

    const result = await db
      .select({ theme: users.theme })
      .from(users)
      .where(eq(users.id, req.session.user.id));

    if (!result.length) {
      console.log(`User not found for theme request: ${req.session.user.id}`);
      return res.status(404).json({ message: "User not found" });
    }

    const theme = result[0].theme || 'light'; // Default to light if no theme set
    console.log(`Theme retrieved for user ${req.session.user.id}: ${theme}`);
    res.json({ theme });
  } catch (error) {
    console.error('Error getting theme:', error);
    res.status(500).json({ 
      message: "Error getting theme",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function updateTheme(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      console.log('Theme update attempted without authentication');
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { theme } = req.body;
    if (!theme || !['light', 'dark'].includes(theme)) {
      console.log(`Invalid theme value received: ${theme}`);
      return res.status(400).json({ message: "Invalid theme" });
    }

    console.log(`Updating theme for user ${req.session.user.id} to: ${theme}`);
    
    await db
      .update(users)
      .set({ theme })
      .where(eq(users.id, req.session.user.id));

    console.log(`Theme successfully updated for user ${req.session.user.id}`);
    res.json({ 
      message: "Theme updated successfully",
      theme 
    });
  } catch (error) {
    console.error('Error updating theme:', error);
    res.status(500).json({ 
      message: "Error updating theme",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function getOpenAIKey(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const result = await db
      .select({ openaiApiKey: users.openaiApiKey })
      .from(users)
      .where(eq(users.id, req.session.user.id));

    if (!result.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const apiKey = result[0].openaiApiKey;
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return res.json({ 
        hasKey: false,
        key: null
      });
    }

    res.json({ 
      hasKey: true,
      key: apiKey.slice(-4) // Just send the last 4 chars for security
    });
  } catch (error) {
    console.error('Error getting OpenAI key:', error);
    res.status(500).json({ 
      message: "Error getting OpenAI key",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function updateOpenAIKey(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { apiKey } = req.body;
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return res.status(400).json({ message: "Invalid API key format" });
    }

    await db
      .update(users)
      .set({ openaiApiKey: apiKey })
      .where(eq(users.id, req.session.user.id));

    res.json({ message: "API key updated successfully" });
  } catch (error) {
    console.error('Error updating OpenAI key:', error);
    res.status(500).json({ 
      message: "Error updating OpenAI key",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function getUserAPIStats(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const result = await db.execute(sql`
      WITH stats AS (
        SELECT 
          COUNT(*)::INTEGER as total_requests,
          SUM(tokens_used)::INTEGER as total_tokens,
          ROUND(SUM(cost)::DECIMAL, 4) as total_cost,
          COUNT(CASE WHEN success = false THEN 1 END)::INTEGER as failed_requests
        FROM api_key_usage 
        WHERE user_id = ${req.session.user.id}
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      )
      SELECT 
        total_requests,
        total_tokens,
        total_cost,
        failed_requests,
        CASE 
          WHEN total_requests > 0 THEN 
            ROUND(((total_requests - failed_requests)::DECIMAL / total_requests::DECIMAL * 100), 1)
          ELSE 100
        END as success_rate
      FROM stats
    `);
    
    res.json(result.rows[0] || {
      total_requests: 0,
      total_tokens: 0,
      total_cost: 0,
      failed_requests: 0,
      success_rate: 100
    });
  } catch (error) {
    console.error('Error getting API stats:', error);
    res.status(500).json({ 
      message: "Error retrieving API usage stats",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function testOpenAIEndpoint(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const result = await db
      .select({ openaiApiKey: users.openaiApiKey })
      .from(users)
      .where(eq(users.id, req.session.user.id));

    if (!result.length) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!result[0].openaiApiKey) {
      return res.status(400).json({ 
        message: "No API key configured",
        details: "Please configure your OpenAI API key in the settings page"
      });
    }

    const openai = new OpenAI({ apiKey: result[0].openaiApiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Hello! This is a test message." }],
      max_tokens: 50
    });

    await logAPIUsage({
      userId: req.session.user.id,
      endpoint: "/api/user/test-openai",
      tokensUsed: response.usage?.total_tokens || 0,
      cost: calculateTokenCost(response.usage?.total_tokens || 0),
      success: true
    });

    res.json({ 
      message: "API test successful",
      response: response.choices[0].message.content
    });

  } catch (error) {
    console.error('OpenAI test error:', error);
    
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
    
    res.status(500).json({ 
      message: "Error testing OpenAI API",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function analyzeImage(req: Request, res: Response) {
  try {
    if (!req.session.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!req.body?.image) {
      return res.status(400).json({ message: "No image data provided" });
    }

    // Validate base64 image format
    if (!req.body.image.startsWith('data:image/')) {
      return res.status(400).json({ 
        message: "Invalid image format",
        details: "Image must be provided as a base64 data URL"
      });
    }

    const result = await db
      .select({ openaiApiKey: users.openaiApiKey })
      .from(users)
      .where(eq(users.id, req.session.user.id));

    if (!result.length) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!result[0].openaiApiKey) {
      return res.status(400).json({ 
        message: "No API key configured",
        details: "Please configure your OpenAI API key in the settings page"
      });
    }

    const openai = new OpenAI({ 
      apiKey: result[0].openaiApiKey,
      maxRetries: 2
    });

    try {
      // Clean the base64 image data
      const base64Image = req.body.image.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // Validate base64 content
      try {
        Buffer.from(base64Image, 'base64');
      } catch (e) {
        return res.status(400).json({
          message: "Invalid image data",
          details: "The provided image data is not valid base64"
        });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this image and extract any visible text or describe what you see in detail."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      if (!response.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI API');
      }

      const description = response.choices[0].message.content;

      // Log successful API usage
      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/user/analyze-image",
        tokensUsed: response.usage?.total_tokens || 0,
        cost: calculateTokenCost(response.usage?.total_tokens || 0, "gpt-4"),
        success: true,
        resourceType: 'image'
      });

      // Return successful response
      res.json({ description });

    } catch (apiError: any) {
      console.error('OpenAI API Error:', apiError);
      
      // Handle specific API errors
      const errorMapping: Record<string, { status: number; message: string; details: string }> = {
        'Unauthorized': {
          status: 401,
          message: "Invalid API key",
          details: "Please check your OpenAI API key in settings"
        },
        'has been deprecated': {
          status: 400,
          message: "Vision model error",
          details: "The vision model is being updated. Please try again later."
        },
        'content_policy_violation': {
          status: 400,
          message: "Content policy violation",
          details: "The image content violates OpenAI's content policy"
        }
      };

      // Find matching error type
      const errorType = Object.keys(errorMapping).find(key => 
        apiError.message?.includes(key) || apiError.status === (key === 'Unauthorized' ? 401 : undefined)
      );

      if (errorType) {
        const { status, message, details } = errorMapping[errorType];
        return res.status(status).json({ message, details });
      }

      // Default error handling
      throw new Error(apiError.message || 'Failed to analyze image');
    }

  } catch (error) {
    console.error('Image analysis error:', error);
    
    // Log failed API usage
    if (req.session.user?.id) {
      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/user/analyze-image",
        tokensUsed: 0,
        cost: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        resourceType: 'image'
      });
    }
    
    // Return error response
    res.status(500).json({ 
      message: "Error analyzing image",
      details: error instanceof Error ? error.message : "Unknown error"
    });
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

    const result = await db
      .select({ openaiApiKey: users.openaiApiKey })
      .from(users)
      .where(eq(users.id, req.session.user.id));

    if (!result.length) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!result[0].openaiApiKey) {
      return res.status(400).json({ 
        message: "No API key configured",
        details: "Please configure your OpenAI API key in the settings page"
      });
    }

    const apiKey = result[0].openaiApiKey;
    
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      return res.status(400).json({ 
        message: "Invalid API key format",
        details: "The API key should start with 'sk-' and be at least 20 characters long"
      });
    }

    const openai = new OpenAI({ apiKey });

    try {
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice,
        input: text,
        response_format: "mp3",
      });

      if (!mp3) {
        throw new Error('No response from OpenAI TTS API');
      }

      const arrayBuffer = await mp3.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        throw new Error('Received empty buffer from OpenAI');
      }

      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/user/generate-speech",
        tokensUsed: Math.ceil(text.length / 4), 
        cost: 0.015 * (text.length / 1000), 
        success: true,
        resourceType: 'speech'
      });

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length,
        'Content-Disposition': 'attachment; filename="generated_speech.mp3"',
        'Cache-Control': 'no-cache',
      });
      
      return res.status(200).send(buffer);

    } catch (err) {
      console.error('OpenAI TTS API Error:', err);
      
      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/user/generate-speech",
        tokensUsed: 0,
        cost: 0,
        success: false,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        resourceType: 'speech'
      });

      return res.status(500).json({ 
        message: "Error generating speech",
        details: err instanceof Error ? err.message : "Unknown error"
      });
    }
  } catch (error) {
    console.error('Server Error:', error);
    
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
    
    return res.status(500).json({ 
      message: "Error generating speech",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}