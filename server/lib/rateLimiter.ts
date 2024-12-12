import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  max: number;       // Max number of requests within the window
  message?: string;  // Custom error message
}

interface RateLimitRecord {
  count: number;
  created_at: Date;
}

export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = config;
  
  return async function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip;
    const now = Date.now();
    const key = `${ip}:${req.path}`;
    
    try {
      // Clean up old records and get request count
      const result = await db.execute<RateLimitRecord>(sql`
        WITH deleted AS (
          DELETE FROM rate_limit
          WHERE created_at < NOW() - INTERVAL '${(windowMs / 1000).toString()} seconds'
          RETURNING 1
        ),
        inserted AS (
          INSERT INTO rate_limit (ip_address, path, created_at)
          VALUES (${ip}, ${req.path}, NOW())
        )
        SELECT COUNT(*)::integer as count, MAX(created_at) as created_at
        FROM rate_limit
        WHERE ip_address = ${ip}
          AND path = ${req.path}
          AND created_at > NOW() - INTERVAL '${(windowMs / 1000).toString()} seconds'
      `);
      
      const [row] = result;
      const count = row?.count || 0;
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000).toString());
      
      if (count > max) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - allow request in case of rate limiter error
      // Log the error for monitoring but don't block the request
      next();
    }
  };
}
