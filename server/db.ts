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
  ssl: {
    rejectUnauthorized: false
  },
  debug: env.NODE_ENV === 'development',
  onnotice: () => {}, // Ignore notice messages
  connection: {
    application_name: 'flashcard-app'
  },
  transform: {
    undefined: null,
  },
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE
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
    const result = await sql`SELECT NOW()`;
    console.log('Database connection successful:', result[0].now);
    
    // Test session table creation
    await sql`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      )
    `;
    console.log('Session table verified');
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    console.error('Connection details:', {
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      ssl: env.NODE_ENV === 'production'
    });
    throw error;
  }
}
