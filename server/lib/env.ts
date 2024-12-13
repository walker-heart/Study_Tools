import { z } from 'zod';

const envSchema = z.object({
  // Core application settings
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  APP_URL: z.string().default(
    process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG.toLowerCase()}.repl.co`
      : process.env.REPL_ID
        ? `https://${process.env.REPL_ID.toLowerCase()}.repl.co` 
        : 'http://localhost:5000'
  ).transform(url => url.replace(/\/$/, '')),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  
  // Firebase Config (Client)
  VITE_FIREBASE_API_KEY: z.string().min(1, "VITE_FIREBASE_API_KEY is required"),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1, "VITE_FIREBASE_AUTH_DOMAIN is required"),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1, "VITE_FIREBASE_PROJECT_ID is required"),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1, "VITE_FIREBASE_STORAGE_BUCKET is required"),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, "VITE_FIREBASE_MESSAGING_SENDER_ID is required"),
  VITE_FIREBASE_APP_ID: z.string().min(1, "VITE_FIREBASE_APP_ID is required"),
  
  // Firebase Admin SDK Config
  FIREBASE_CLIENT_EMAIL: z.string()
    .email("FIREBASE_CLIENT_EMAIL must be a valid email")
    .min(1, "FIREBASE_CLIENT_EMAIL is required")
    .optional()
    .or(z.string()
      .email("VITE_FIREBASE_CLIENT_EMAIL must be a valid email")
      .min(1, "VITE_FIREBASE_CLIENT_EMAIL is required")),

  FIREBASE_PRIVATE_KEY: z.string()
    .min(1, "FIREBASE_PRIVATE_KEY is required")
    .transform((key) => {
      // Handle both regular and escaped newlines
      if (key.includes('\\n')) {
        return key.replace(/\\n/g, '\n');
      }
      return key;
    })
    .optional()
    .or(z.string()
      .min(1, "VITE_FIREBASE_PRIVATE_KEY is required")
      .transform((key) => {
        if (key.includes('\\n')) {
          return key.replace(/\\n/g, '\n');
        }
        return key;
      })),

  // Optional configurations
  ALLOWED_ORIGINS: z.string().optional().transform(val => 
    val?.split(',').map(origin => origin.trim()) || ['http://localhost:5000']
  ),
});

// Parse and validate environment variables
const validateEnv = () => {
  try {
    const validatedEnv = envSchema.parse(process.env);
    console.log('Firebase configuration validated:', {
      projectId: validatedEnv.VITE_FIREBASE_PROJECT_ID,
      hasApiKey: !!validatedEnv.VITE_FIREBASE_API_KEY,
      hasClientEmail: !!validatedEnv.VITE_FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!validatedEnv.VITE_FIREBASE_PRIVATE_KEY
    });
    return validatedEnv;
  } catch (error) {
    console.error('Environment validation failed:', error);
    throw error;
  }
};

const env = validateEnv();

export { env };
