import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  APP_URL: z.string().default(
    process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG.toLowerCase()}.repl.co`
      : process.env.REPL_ID
        ? `https://${process.env.REPL_ID.toLowerCase()}.repl.co` 
        : 'http://localhost:5000'
  ).transform(url => url.replace(/\/$/, '')), // Remove trailing slash if present
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is required"),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional().transform(val => 
    val?.split(',').map(origin => origin.trim()) || ['http://localhost:5000']
  ),
});

export const env = envSchema.parse(process.env);
