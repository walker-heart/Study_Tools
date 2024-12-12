import { db } from '../db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface RateLimitInfo {
  remaining: number;
  reset: Date;
  total: number;
}

interface QueryResult<T> {
  rows: T[];
}

type RateLimitRecord = {
  key: string;
  hits: number;
  expires: Date;
};

export async function getRateLimitInfo(key: string, options: RateLimitOptions): Promise<RateLimitInfo> {
  const now = new Date();
  const windowMs = options.windowMs;
  const maxHits = options.max;

  try {
    const result = await db.execute(sql`
      SELECT key, hits, expires
      FROM rate_limits
      WHERE key = ${key} AND expires > ${now}
      LIMIT 1
    `) as QueryResult<RateLimitRecord>;

    const record = result.rows[0];
    if (!record) {
      return {
        remaining: maxHits,
        reset: new Date(now.getTime() + windowMs),
        total: maxHits
      };
    }

    return {
      remaining: Math.max(0, maxHits - record.hits),
      reset: record.expires,
      total: maxHits
    };
  } catch (error) {
    console.error('Error getting rate limit info:', error);
    return {
      remaining: maxHits,
      reset: new Date(now.getTime() + windowMs),
      total: maxHits
    };
  }
}

export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<boolean> {
  const now = new Date();
  const windowMs = options.windowMs;
  const maxHits = options.max;
  const expires = new Date(now.getTime() + windowMs);

  try {
    const result = await db.execute(sql`
      INSERT INTO rate_limits (key, hits, expires)
      VALUES (${key}, 1, ${expires})
      ON CONFLICT (key) DO UPDATE
      SET hits = CASE
        WHEN rate_limits.expires <= ${now} THEN 1
        WHEN rate_limits.hits >= ${maxHits} THEN rate_limits.hits
        ELSE rate_limits.hits + 1
      END,
      expires = CASE
        WHEN rate_limits.expires <= ${now} THEN ${expires}
        ELSE rate_limits.expires
      END
      RETURNING hits
    `) as QueryResult<{ hits: number }>;

    const hits = result.rows[0]?.hits ?? 0;
    return hits <= maxHits;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return true;
  }
}
