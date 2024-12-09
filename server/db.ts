import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { users } from "../db/schema/users";
import { flashcardSets, flashcards, memorizationSessions } from "../db/schema/flashcards";
import { Pool } from '@neondatabase/serverless';

// Validate environment variables
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create the database pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Initialize drizzle with the schema
export const db = drizzle(pool, {
  schema: {
    users,
    flashcardSets,
    flashcards,
    memorizationSessions,
  },
});
