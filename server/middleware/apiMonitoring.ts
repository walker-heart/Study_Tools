import { Request, Response, NextFunction } from 'express';
import { logAPIUsage } from '../lib/apiMonitoring';
import { db } from '../db';
import { users } from '../../db/schema/users';
import { eq } from 'drizzle-orm';

// Interface for tracking request metadata
interface APIRequestMetadata {
  startTime: number;
  endTime?: number;
  tokensUsed?: number;
  success: boolean;
  errorMessage?: string;
}

// Map to store request metadata
const requestMetadata = new Map<string, APIRequestMetadata>();

export async function apiMonitoringMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user?.id) {
    return next();
  }

  const requestId = `${req.session.user.id}-${Date.now()}`;
  
  // Start tracking request
  requestMetadata.set(requestId, {
    startTime: Date.now(),
    success: false
  });

  // Get the original send function
  const originalSend = res.send;

  // Override send function to capture response
  res.send = function(body: any) {
    const metadata = requestMetadata.get(requestId);
    if (metadata) {
      metadata.endTime = Date.now();
      metadata.success = res.statusCode >= 200 && res.statusCode < 300;
      
      // Try to extract tokens used from response body if it's JSON
      try {
        const responseBody = typeof body === 'string' ? JSON.parse(body) : body;
        if (responseBody?.usage?.total_tokens) {
          metadata.tokensUsed = responseBody.usage.total_tokens;
        }
      } catch {
        // Ignore parsing errors
      }

      // Log the API usage
      logAPIUsage({
        userId: req.session.user!.id,
        endpoint: req.path,
        tokensUsed: metadata.tokensUsed || 0,
        success: metadata.success,
        errorMessage: metadata.success ? undefined : res.statusMessage,
        duration: metadata.endTime - metadata.startTime
      }).catch(console.error);

      // Clean up metadata
      requestMetadata.delete(requestId);
    }

    // Call original send
    return originalSend.apply(res, [body]);
  };

  next();
}

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user?.id) {
    return next();
  }

  try {
    // Get user's current usage
    const result = await db
      .select({
        dailyRequests: users.dailyRequests,
        dailyTokens: users.dailyTokens,
        lastResetDate: users.lastResetDate
      })
      .from(users)
      .where(eq(users.id, req.session.user.id));

    if (!result.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result[0];
    const now = new Date();
    const lastReset = user.lastResetDate ? new Date(user.lastResetDate) : new Date(0);

    // Reset daily counts if it's a new day
    if (lastReset.getDate() !== now.getDate() || lastReset.getMonth() !== now.getMonth()) {
      await db
        .update(users)
        .set({
          dailyRequests: 0,
          dailyTokens: 0,
          lastResetDate: now
        })
        .where(eq(users.id, req.session.user.id));
    }
    // Check if user has exceeded daily limits
    else if (user.dailyRequests >= 1000 || user.dailyTokens >= 100000) {
      return res.status(429).json({
        message: "Daily API limit exceeded. Please try again tomorrow.",
        dailyRequests: user.dailyRequests,
        dailyTokens: user.dailyTokens
      });
    }

    next();
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Allow request to proceed if rate limit check fails
    next();
  }
}
