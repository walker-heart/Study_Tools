import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "./schema/users";
import { flashcardSets, flashcards, memorizationSessions } from "./schema/flashcards";
import { env } from "./lib/env";

// Validate environment variables
if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Configure PostgreSQL client with proper connection options
const client = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: env.NODE_ENV === 'production',
  debug: env.NODE_ENV === 'development',
});

// Initialize Drizzle ORM with schema
export const db = drizzle(client, {
  schema: {
    users,
    flashcardSets,
    flashcards,
    memorizationSessions,
  },
});

// Export the raw client for transactions and complex queries
export const sql = client;
