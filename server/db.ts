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

// Configure database pool with SSL and connection options
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true,
  connectionTimeoutMillis: 5000,
  max: 20
});

// Initialize drizzle with the schema and connection pool
export const db = drizzle(pool, {
  schema: {
    users,
    flashcardSets,
    flashcards,
    memorizationSessions,
  },
});
