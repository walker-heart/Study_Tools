import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";
import { flashcardSets, flashcards, memorizationSessions } from "@db/schema/flashcards";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Setup database with relations
export const db = drizzle({
  connection: process.env.DATABASE_URL,
  schema,
  ws: ws,
});

// Configure relations
db.query.flashcardSets.findFirst.relations = {
  user: true,
  flashcards: true,
  memorizationSessions: true
};

db.query.flashcards.findFirst.relations = {
  set: true
};

db.query.memorizationSessions.findFirst.relations = {
  user: true,
  set: true
};

// Add query builder types
export type Database = typeof db;
