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
  errorMessage,
  resourceType = 'text'
}: APIUsageLog & { resourceType?: 'text' | 'image' | 'speech' }) {
  try {
    await db.execute(sql`
      INSERT INTO api_key_usage (
        user_id, 
        endpoint, 
        tokens_used, 
        cost, 
        success, 
        error_message,
        resource_type
      )
      VALUES (
        ${userId}, 
        ${endpoint}, 
        ${tokensUsed}, 
        ${cost}, 
        ${success}, 
        ${errorMessage || null},
        ${resourceType}
      )
    `);
    console.log(`API usage logged - Endpoint: ${endpoint}, Type: ${resourceType}, Success: ${success}`);
  } catch (error) {
    console.error('Error logging API usage:', error);
  }
}

export async function getAPIUsageStats(userId: number, days: number = 30) {
  try {
    const result = await db.execute(sql`
      WITH hourly_stats AS (
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*)::INTEGER as requests,
          COALESCE(SUM(tokens_used), 0)::INTEGER as tokens,
          ROUND(COALESCE(SUM(cost), 0)::DECIMAL, 4) as cost,
          COUNT(CASE WHEN success = false THEN 1 END)::INTEGER as failed,
          resource_type
        FROM api_key_usage 
        WHERE user_id = ${userId}
        AND created_at >= CURRENT_TIMESTAMP - (${days}::INTEGER * INTERVAL '1 day')
        GROUP BY DATE_TRUNC('hour', created_at), resource_type
      ),
      stats AS (
        SELECT 
          COUNT(*)::INTEGER as total_requests,
          COALESCE(SUM(tokens), 0)::INTEGER as total_tokens,
          ROUND(COALESCE(SUM(cost), 0)::DECIMAL, 4) as total_cost,
          COUNT(CASE WHEN failed > 0 THEN 1 END)::INTEGER as failed_requests,
          MAX(hour) as last_used,
          SUM(CASE WHEN resource_type = 'image' THEN requests ELSE 0 END)::INTEGER as image_requests,
          SUM(CASE WHEN resource_type = 'text' THEN requests ELSE 0 END)::INTEGER as text_requests,
          SUM(CASE WHEN resource_type = 'speech' THEN requests ELSE 0 END)::INTEGER as speech_requests,
          json_agg(json_build_object(
            'hour', hour,
            'requests', requests,
            'tokens', tokens,
            'cost', cost,
            'resource_type', resource_type
          ) ORDER BY hour DESC) as hourly_breakdown
        FROM hourly_stats
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
        hourly_breakdown,
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
      last_used: null
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
      last_used: null
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
