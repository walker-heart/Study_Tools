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
  
  // Firebase Admin Configuration
  VITE_FIREBASE_PROJECT_ID: z.string({
    required_error: "VITE_FIREBASE_PROJECT_ID is required",
    invalid_type_error: "VITE_FIREBASE_PROJECT_ID must be a string",
  }).min(1, "VITE_FIREBASE_PROJECT_ID cannot be empty"),
  
  VITE_FIREBASE_PRIVATE_KEY: z.string({
    required_error: "VITE_FIREBASE_PRIVATE_KEY is required",
    invalid_type_error: "VITE_FIREBASE_PRIVATE_KEY must be a string",
  }).min(1, "VITE_FIREBASE_PRIVATE_KEY cannot be empty")
    .transform(key => key.replace(/\\n/g, '\n')),
  
  VITE_FIREBASE_CLIENT_EMAIL: z.string({
    required_error: "VITE_FIREBASE_CLIENT_EMAIL is required",
    invalid_type_error: "VITE_FIREBASE_CLIENT_EMAIL must be a string",
  }).email("VITE_FIREBASE_CLIENT_EMAIL must be a valid email address"),
  
  // Optional configurations
  ALLOWED_ORIGINS: z.string().optional().transform(val => 
    val?.split(',').map(origin => origin.trim()) || ['http://localhost:5000']
  ),
});

// Validate and export environment variables
try {
  export const env = envSchema.parse(process.env);
  console.log('Environment variables validated successfully');
} catch (error) {
  console.error('Environment validation failed:', error);
  throw error;
}
