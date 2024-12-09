import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";
import { flashcardSets, flashcards, memorizationSessions } from "@db/schema/flashcards";
import { InferModel, eq } from "drizzle-orm";
import { users } from "@db/schema/users";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Define model types using InferModel
export type FlashcardSet = InferModel<typeof flashcardSets, "select">;
export type Flashcard = InferModel<typeof flashcards, "select">;
export type MemorizationSession = InferModel<typeof memorizationSessions, "select">;

// Setup database with relations
export const db = drizzle({
  connection: process.env.DATABASE_URL,
  schema: {
    users,
    flashcardSets,
    flashcards,
    memorizationSessions,
  },
  ws: ws,
});

// Define complete schema type
export type DBSchema = {
  users: typeof users;
  flashcardSets: typeof flashcardSets;
  flashcards: typeof flashcards;
  memorizationSessions: typeof memorizationSessions;
};

// Export database instance type
export type Database = typeof db;

// Configure and export query helpers
export const query = {
  flashcardSets: {
    ...db.query.flashcardSets,
    findWithCards: async (setId: number) => {
      return db.query.flashcardSets.findFirst({
        where: eq(flashcardSets.id, setId),
        with: {
          cards: true,
        },
      });
    },
  },
  flashcards: {
    ...db.query.flashcards,
    findBySet: async (setId: number) => {
      return db.query.flashcards.findMany({
        where: eq(flashcards.setId, setId),
        orderBy: [flashcards.position],
      });
    },
  },
  memorizationSessions: {
    ...db.query.memorizationSessions,
    findByUser: async (userId: number) => {
      return db.query.memorizationSessions.findMany({
        where: eq(memorizationSessions.userId, userId),
        with: {
          set: true,
        },
      });
    },
  },
  users: db.query.users,
};
