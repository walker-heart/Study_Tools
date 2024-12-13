import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

import { apiKeyUsage } from '../db/schema';
import type { InsertApiKeyUsage } from '../db/schema';

interface APIUsageLog {
  userId: number;
  endpoint: string;
  tokensUsed: number;
  cost: number;
  success: boolean;
  errorMessage?: string;
  resourceType?: 'text' | 'image' | 'speech';
}

export async function logAPIUsage({
  userId,
  endpoint,
  tokensUsed,
  cost,
  success,
  errorMessage,
  resourceType = 'text'
}: APIUsageLog) {
  try {
    // Ensure userId is a number
    const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    
    const insertData: InsertApiKeyUsage = {
      userId: numericUserId,
      endpoint,
      tokensUsed,
      cost: cost.toString(), // Convert number to string for decimal type
      success,
      errorMessage,
      resourceType
    };

    await db.insert(apiKeyUsage).values(insertData);
    
    console.log(`API usage logged - Endpoint: ${endpoint}, Type: ${resourceType}, Success: ${success}`);
  } catch (error) {
    console.error('Error logging API usage:', error);
    // Re-throw to allow handling by the caller
    throw error;
  }
}

export async function getAPIUsageStats(userId: number, days: number = 30) {
  try {
    const result = await db.execute(sql`
      WITH stats AS (
        SELECT 
          COUNT(*)::INTEGER as total_requests,
          COALESCE(SUM(tokens_used), 0)::INTEGER as total_tokens,
          ROUND(COALESCE(SUM(cost), 0)::DECIMAL, 4) as total_cost,
          COUNT(CASE WHEN success = false THEN 1 END)::INTEGER as failed_requests,
          MAX(created_at) as last_used,
          COUNT(CASE WHEN resource_type = 'image' THEN 1 END)::INTEGER as image_requests,
          COUNT(CASE WHEN resource_type = 'text' THEN 1 END)::INTEGER as text_requests,
          COUNT(CASE WHEN resource_type = 'speech' THEN 1 END)::INTEGER as speech_requests
        FROM api_key_usage 
        WHERE user_id = ${userId}
        AND created_at >= CURRENT_TIMESTAMP - (${days}::INTEGER * INTERVAL '1 day')
      )
      SELECT 
        total_requests,
        total_tokens,
        total_cost,
        failed_requests,
        last_used,
        image_requests,
        text_requests,
        speech_requests,
        CASE 
          WHEN total_requests > 0 THEN 
            ROUND(((total_requests - failed_requests)::DECIMAL / total_requests::DECIMAL * 100), 1)
          ELSE 100
        END as success_rate
      FROM stats
    `);
    
    // Ensure we always return a valid object even if no data is found
    return result.rows[0] || {
      total_requests: 0,
      total_tokens: 0,
      total_cost: 0,
      failed_requests: 0,
      success_rate: 100,
      last_used: null,
      image_requests: 0,
      text_requests: 0,
      speech_requests: 0
    };
  } catch (error) {
    console.error('Error fetching API usage stats:', error);
    // Return default values instead of throwing to prevent UI errors
    return {
      total_requests: 0,
      total_tokens: 0,
      total_cost: 0,
      failed_requests: 0,
      success_rate: 100,
      last_used: null,
      image_requests: 0,
      text_requests: 0,
      speech_requests: 0
    };
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
