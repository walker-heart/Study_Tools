import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

interface APIUsageLog {
  userId: number;
  endpoint: string;
  tokensUsed: number;
  cost: number;
  success: boolean;
  errorMessage?: string;
}

export async function logAPIUsage({
  userId,
  endpoint,
  tokensUsed,
  cost,
  success,
  errorMessage
}: APIUsageLog) {
  try {
    await db.execute(sql`
      INSERT INTO api_key_usage (user_id, endpoint, tokens_used, cost, success, error_message)
      VALUES (${userId}, ${endpoint}, ${tokensUsed}, ${cost}, ${success}, ${errorMessage || null})
    `);
  } catch (error) {
    console.error('Error logging API usage:', error);
  }
}

export async function getAPIUsageStats(userId: number, days: number = 30) {
  try {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_requests,
        SUM(tokens_used) as total_tokens,
        SUM(cost) as total_cost,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_requests,
        MAX(timestamp) as last_used
      FROM api_key_usage 
      WHERE user_id = ${userId}
      AND timestamp >= NOW() - INTERVAL '${days} days'
    `);
    
    return stats.rows[0];
  } catch (error) {
    console.error('Error fetching API usage stats:', error);
    throw error;
  }
}

export function calculateTokenCost(tokensUsed: number, model: string = 'gpt-3.5-turbo'): number {
  // Pricing per 1K tokens (as of 2024)
  const pricing: Record<string, number> = {
    'gpt-4': 0.03,
    'gpt-3.5-turbo': 0.001
  };
  
  return (tokensUsed / 1000) * (pricing[model] || pricing['gpt-3.5-turbo']);
}
