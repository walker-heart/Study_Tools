import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";
import { flashcardSets, flashcards, memorizationSessions } from "@db/schema/flashcards";
import { InferModel } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Setup database with relations
export const db = drizzle({
  connection: process.env.DATABASE_URL,
  schema: {
    ...schema,
    flashcardSets,
    flashcards,
    memorizationSessions,
  },
  ws: ws,
});

// Add proper typing for schemas
export type DBSchema = typeof schema & {
  flashcardSets: typeof flashcardSets;
  flashcards: typeof flashcards;
  memorizationSessions: typeof memorizationSessions;
};

// Define model types
export type FlashcardSet = InferModel<typeof flashcardSets>;
export type Flashcard = InferModel<typeof flashcards>;
export type MemorizationSession = InferModel<typeof memorizationSessions>;

// Export database instance
export type Database = typeof db;
