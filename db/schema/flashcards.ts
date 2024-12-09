import { pgTable, serial, text, timestamp, integer, boolean, json, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";
import { relations } from "drizzle-orm";

export const flashcardSets = pgTable("flashcard_sets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  isPublic: boolean("is_public").default(false),
  tags: json("tags").$type<string[]>().default(['[]']),
  filePath: text("file_path"),
  urlPath: text("url_path"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const flashcards = pgTable("flashcards", {
  id: serial("id").primaryKey(),
  setId: integer("set_id").references(() => flashcardSets.id).notNull(),
  vocabWord: varchar("vocab_word", { length: 255 }).notNull(),
  partOfSpeech: varchar("part_of_speech", { length: 50 }).notNull(),
  definition: text("definition").notNull(),
  exampleSentence: text("example_sentence"),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const memorizationSessions = pgTable("memorization_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  setId: integer("set_id").references(() => flashcardSets.id).notNull(),
  progress: json("progress").$type<{
    completed: number[],
    incorrect: number[],
    remainingCards: number[]
  }>().notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  score: integer("score").default(0),
});

// Define relationships
export const flashcardSetsRelations = relations(flashcardSets, ({ one, many }) => ({
  user: one(users, {
    fields: [flashcardSets.userId],
    references: [users.id],
  }),
  flashcards: many(flashcards),
  memorizationSessions: many(memorizationSessions),
}));

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  set: one(flashcardSets, {
    fields: [flashcards.setId],
    references: [flashcardSets.id],
  }),
}));

export const memorizationSessionsRelations = relations(memorizationSessions, ({ one }) => ({
  user: one(users, {
    fields: [memorizationSessions.userId],
    references: [users.id],
  }),
  set: one(flashcardSets, {
    fields: [memorizationSessions.setId],
    references: [flashcardSets.id],
  }),
}));
