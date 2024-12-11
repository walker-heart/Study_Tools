import { Request, Response } from "express";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { users } from "../db/schema";
import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';
import { logAPIUsage, calculateTokenCost } from "../lib/apiMonitoring";

// Define API error interfaces
interface OpenAIAPIError {
  status?: number;
  message?: string;
  code?: string;
}

interface AnthropicAPIError {
  status?: number;
  message?: string;
  type?: string;
}

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

  } catch (error: unknown) {
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
    
    // Type guard for OpenAI API errors
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as OpenAIAPIError;
      if (apiError.status === 401) {
        return res.status(401).json({
          message: "Invalid API key",
          details: "Please check your OpenAI API key in settings"
        });
      }
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

    const mode = req.body.mode || 'extract'; // 'extract' or 'summarize'
    if (!['extract', 'summarize'].includes(mode)) {
      return res.status(400).json({ message: "Invalid mode. Use 'extract' or 'summarize'" });
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
      if (!req.body.image.startsWith('data:image/')) {
        return res.status(400).json({ 
          message: "Invalid image format",
          details: "Image must be provided as a base64 data URL"
        });
      }

      const base64Image = req.body.image.replace(/^data:image\/[a-z]+;base64,/, '');

      try {
        Buffer.from(base64Image, 'base64');
      } catch (error) {
        return res.status(400).json({
          message: "Invalid image data",
          details: "The provided image data is not valid base64"
        });
      }

      const prompt = mode === 'extract' 
        ? "Please extract and transcribe any visible text from this image. If there is no visible text, provide a detailed description of what you see." 
        : "Please provide a concise summary of this image's content in 2-3 sentences.";

      const openai = new OpenAI({ apiKey: result[0].openaiApiKey });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4-1106-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { 
                type: "image_url", 
                image_url: { 
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: mode === 'extract' ? 'high' : 'low'
                } 
              }
            ]
          }
        ],
        max_tokens: mode === 'extract' ? 1000 : 150,
        temperature: mode === 'extract' ? 0.3 : 0.7
      });

      if (!response.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI API');
      }

      const description = response.choices[0].message.content;

      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/user/analyze-image",
        tokensUsed: response.usage?.total_tokens || 0,
        cost: calculateTokenCost(response.usage?.total_tokens || 0),
        success: true,
        resourceType: 'image'
      });

      res.json({ description });

    } catch (error: unknown) {
      console.error('OpenAI Vision API Error:', error);
      
      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/user/analyze-image",
        tokensUsed: 0,
        cost: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        resourceType: 'image'
      });

      // Type guard for OpenAI API errors
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as OpenAIAPIError;
        if (apiError.status === 401) {
          return res.status(401).json({
            message: "Invalid API key",
            details: "Please check your OpenAI API key in settings"
          });
        }
      }

      // Check for rate limit or model availability errors
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          return res.status(429).json({
            message: "Rate limit exceeded",
            details: "Please try again in a few moments"
          });
        } else if (error.message.includes('model')) {
          return res.status(400).json({
            message: "Model error",
            details: "The vision model is temporarily unavailable. Please try again later."
          });
        }
      }

      return res.status(500).json({ 
        message: "Error analyzing image",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  } catch (error: unknown) {
    console.error('Server Error:', error);
    
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
    
    return res.status(500).json({ 
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

    } catch (error: unknown) {
      console.error('OpenAI TTS API Error:', error);
      
      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/user/generate-speech",
        tokensUsed: 0,
        cost: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        resourceType: 'speech'
      });

      // Type guard for OpenAI API errors
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as OpenAIAPIError;
        if (apiError.status === 401) {
          return res.status(401).json({
            message: "Invalid API key",
            details: "Please check your OpenAI API key in settings"
          });
        }
      }

      return res.status(500).json({ 
        message: "Error generating speech",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  } catch (error: unknown) {
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

export async function translateText(req: Request, res: Response) {
  // Ensure consistent JSON response
  res.setHeader('Content-Type', 'application/json');
  
  // Wrap in error boundary to ensure JSON responses
  const sendError = (status: number, message: string, details?: string) => {
    return res.status(status).json({
      message,
      details: details || message
    });
  };
  
  try {
    if (!req.session.user?.id) {
      return sendError(401, "Not authenticated");
    }

    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return sendError(400, "Missing required fields");
    }

    const result = await db
      .select({ openaiApiKey: users.openaiApiKey })
      .from(users)
      .where(eq(users.id, req.session.user.id));

    if (!result.length || !result[0].openaiApiKey) {
      return sendError(400, "OpenAI API key not configured", "Please configure your OpenAI API key in settings");
    }

    const openai = new OpenAI({ apiKey: result[0].openaiApiKey });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the following text to ${targetLanguage}. Provide only the translation, no explanations.`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      if (!response.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI API');
      }

      const translation = response.choices[0].message.content.trim();

      // Log successful API usage
      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/ai/translate",
        tokensUsed: response.usage?.total_tokens || 0,
        cost: calculateTokenCost(response.usage?.total_tokens || 0),
        success: true
      }).catch(error => {
        console.error('Error logging API usage:', error);
        // Don't throw, just log the error
      });

      return res.json({ translation });

    } catch (openaiError: any) {
      console.error('OpenAI API error:', openaiError);
      
      if (openaiError?.status === 401) {
        return res.status(401).json({
          message: "Invalid OpenAI API key",
          details: "Please check your API key in settings"
        });
      }

      // Log failed API usage
      if (req.session.user?.id) {
        await logAPIUsage({
          userId: req.session.user.id,
          endpoint: "/api/ai/translate",
          tokensUsed: 0,
          cost: 0,
          success: false,
          errorMessage: openaiError?.message || "OpenAI API error"
        }).catch(error => {
          console.error('Error logging API usage:', error);
        });
      }

      return res.status(500).json({ 
        message: "Translation failed",
        details: openaiError?.message || "Error calling OpenAI API"
      });
    }

  } catch (error: unknown) {
    console.error('Translation error:', error);
    
    // Log failed API usage for unexpected errors
    if (req.session.user?.id) {
      await logAPIUsage({
        userId: req.session.user.id,
        endpoint: "/api/ai/translate",
        tokensUsed: 0,
        cost: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      }).catch(error => {
        console.error('Error logging API usage:', error);
      });
    }

    return res.status(500).json({ 
      message: "Translation failed",
      details: error instanceof Error ? error.message : "Unexpected error occurred"
    });
  }
}
