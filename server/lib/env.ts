import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  APP_URL: z.string().default(
    process.env.NODE_ENV === 'production'
      ? process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG.toLowerCase()}.repl.co`
        : process.env.REPL_ID
          ? `https://${process.env.REPL_ID.toLowerCase()}.repl.co` 
          : 'https://wtoolsw.repl.co'
      : process.env.REPL_SLUG  // Check for Replit environment even in development
        ? `https://${process.env.REPL_SLUG.toLowerCase()}.repl.co`
        : 'http://localhost:5000'
  ).transform(url => url.replace(/\/$/, '')), // Remove trailing slash if present
  PORT: z.string()
    .default("5000")
    .transform(val => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});

export const env = envSchema.parse(process.env);
