import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from '@neondatabase/serverless';
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create a new pool for the serverless connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create the drizzle database instance
export const db = drizzle(pool, { schema });

// Export the pool for direct queries if needed
export { pool };
