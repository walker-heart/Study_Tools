import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  VITE_GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  APP_URL: z.string().default(process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.repl.co` : 'http://localhost:5000'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});

export const env = envSchema.parse(process.env);
