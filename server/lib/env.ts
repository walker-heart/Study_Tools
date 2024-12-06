import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  VITE_GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  APP_URL: z.string().default('https://study-tools.repl.co'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});

export const env = envSchema.parse(process.env);
