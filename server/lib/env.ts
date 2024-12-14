import { z } from 'zod';

// Firebase Admin Configuration Schema
const firebaseAdminSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1, "Firebase Project ID is required"),
  FIREBASE_CLIENT_EMAIL: z.string()
    .email("Firebase Client Email must be a valid email")
    .min(1, "Firebase Client Email is required"),
  FIREBASE_PRIVATE_KEY: z.string()
    .min(1, "Firebase Private Key is required")
    .transform(key => key?.replace(/\\n/g, '\n') || ''),
  FIREBASE_STORAGE_BUCKET: z.string()
    .optional()
    .transform(val => {
      if (val) return val;
      const projectId = process.env.FIREBASE_PROJECT_ID;
      return projectId ? `${projectId}.appspot.com` : '';
    }),
}).strict();

// Core Application Schema
const coreAppSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, "Database URL is required"),
  JWT_SECRET: z.string().min(1, "JWT Secret is required"),
  APP_URL: z.string().default(
    process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG.toLowerCase()}.repl.co`
      : process.env.REPL_ID
        ? `https://${process.env.REPL_ID.toLowerCase()}.repl.co` 
        : 'http://localhost:5000'
  ).transform(url => url.replace(/\/$/, '')),
  ALLOWED_ORIGINS: z.string()
    .optional()
    .transform(val => val?.split(',').map(origin => origin.trim()) || ['http://localhost:5000']),
}).strict();

// Combined Environment Schema
const envSchema = z.object({
  ...coreAppSchema.shape,
  ...firebaseAdminSchema.shape,
}).strict();

// Environment Type
type Env = z.infer<typeof envSchema>;

// Validate environment variables
function validateEnv(): Env {
  try {
    const validated = envSchema.parse(process.env);
    
    // Log non-sensitive configuration details
    console.log('Environment Configuration:', {
      nodeEnv: validated.NODE_ENV,
      hasDbUrl: !!validated.DATABASE_URL,
      hasJwtSecret: !!validated.JWT_SECRET,
      appUrl: validated.APP_URL,
      allowedOrigins: validated.ALLOWED_ORIGINS,
      firebase: {
        projectId: validated.FIREBASE_PROJECT_ID,
        storageBucket: validated.FIREBASE_STORAGE_BUCKET,
        hasClientEmail: !!validated.FIREBASE_CLIENT_EMAIL,
        hasPrivateKey: !!validated.FIREBASE_PRIVATE_KEY?.length,
      }
    });

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment validation failed:', {
        issues: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      });
    } else {
      console.error('Unexpected error during environment validation:', error);
    }
    throw error;
  }
}

const env = validateEnv();

export { env, type Env };
