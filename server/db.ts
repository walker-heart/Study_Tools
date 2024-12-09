import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../db/schema/users";
import { flashcardSets, flashcards, memorizationSessions } from "../db/schema/flashcards";
import { env } from "./lib/env";

// Validate environment variables
if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Configure PostgreSQL client with proper connection options
const connectionConfig = {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  debug: env.NODE_ENV === 'development',
  onnotice: () => {}, // Ignore notice messages
  connection: {
    application_name: 'flashcard-app'
  }
};

// Create the client with SSL configuration
const client = postgres(env.DATABASE_URL, connectionConfig);

// Initialize Drizzle ORM with schema
export const db = drizzle(client, {
  schema: {
    users,
    flashcardSets,
    flashcards,
    memorizationSessions,
  },
});

// Export the SQL interface for raw queries
export const sql = client;

// Test database connection function
export async function testDatabaseConnection() {
  try {
    await sql`SELECT NOW()`;
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
}
