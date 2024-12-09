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
  max: 10, // Reduce max connections
  idle_timeout: 30, // Increase idle timeout
  connect_timeout: 30, // Increase connect timeout
  ssl: {
    rejectUnauthorized: false
  },
  debug: env.NODE_ENV === 'development',
  onnotice: (notice: any) => {
    console.log('Database notice:', notice.message);
  },
  connection: {
    application_name: 'flashcard-app'
  },
  transform: {
    undefined: null,
  }
};

// Log database connection attempt
console.log('Attempting to connect to database with URL:', env.DATABASE_URL?.split('@')[1]);

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

// Test database connection function with retries
export async function testDatabaseConnection(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Database connection attempt ${attempt}/${retries}`);
      
      // Test basic connection
      const result = await sql`SELECT NOW()`;
      console.log('Basic connection successful:', result[0].now);
      
      // Verify essential tables
      const tableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'flashcard_sets'
        );
      `;
      
      if (!tableCheck[0].exists) {
        console.log('Tables not found, running migrations...');
        // You might want to run your migrations here
      }
      
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
      
      // Test write capability
      await sql`
        INSERT INTO session (sid, sess, expire) 
        VALUES ('test', '{}', NOW()) 
        ON CONFLICT (sid) DO NOTHING
      `;
      console.log('Write capability verified');
      
      return true;
    } catch (error) {
      console.error(`Database connection attempt ${attempt} failed:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        details: {
          url: env.DATABASE_URL?.split('@')[1], // Log only host part
          attempt,
          timestamp: new Date().toISOString()
        }
      });
      
      if (attempt === retries) {
        throw new Error(`Failed to connect to database after ${retries} attempts: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return false;
}
