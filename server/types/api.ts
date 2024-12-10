export interface APIUsageLog {
  userId: number;
  endpoint: string;
  tokensUsed: number;
  success: boolean;
  errorMessage?: string;
  resourceType?: 'text' | 'image' | 'speech';
  duration: number;  // Making duration required since we always calculate it
  cost: number;
}
