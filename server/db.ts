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
  max: 1, // Start with single connection for reliability
  idle_timeout: 20, // Shorter idle timeout
  connect_timeout: 10, // Shorter connect timeout
  ssl: {
    rejectUnauthorized: false
  },
  debug: env.NODE_ENV === 'development',
  onnotice: (notice: any) => {
    console.log('Database notice:', notice.message);
  },
  transform: {
    undefined: null,
  }
};

// Log database connection attempt
console.log('Attempting to connect to database with URL:', env.DATABASE_URL?.split('@')[1]);

// Create the client with SSL configuration and retry logic
const createClient = () => {
  const retries = 3;
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Creating database client (attempt ${i + 1}/${retries})...`);
      const client = postgres(env.DATABASE_URL, {
        ...connectionConfig,
        max: 1, // Start with a single connection for initialization
        connect_timeout: 10,
      });
      
      // Test the connection immediately
      client.unsafe('SELECT 1');
      console.log('Database client created successfully');
      return client;
    } catch (error) {
      console.error(`Database client creation attempt ${i + 1} failed:`, error);
      lastError = error;
      if (i < retries - 1) {
        console.log('Waiting before retry...');
        // Wait 2 seconds before retrying
        new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  throw new Error(`Failed to create database client after ${retries} attempts: ${lastError}`);
};

let client;
try {
  client = createClient();
} catch (error) {
  console.error('Fatal: Could not establish database connection:', error);
  process.exit(1);
}

// Initialize Drizzle ORM with schema and connection handling
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

// Initialize database connection
export async function initializeDatabase() {
  try {
    console.log('Testing database connection...');
    const result = await sql`SELECT NOW()`;
    console.log('Database connection successful:', result[0].now);

    // Verify essential tables
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'flashcard_sets'
      );
    `;
    
    if (!tableCheck[0].exists) {
      console.error('Required tables not found. Please ensure migrations have been run.');
      return false;
    }

    // Verify session table
    await sql`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      )
    `;

    return true;
  } catch (error) {
    console.error('Database initialization failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}
