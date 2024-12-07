import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  APP_URL: z.string().default('https://w-schooltools.repl.co')
    .transform(url => url.replace(/\/$/, '')), // Remove trailing slash if present
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});

export const env = envSchema.parse(process.env);
