import { pgTable, serial, varchar, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  theme: varchar('theme', { length: 10 }).default('light'),
  isAdmin: boolean('is_admin').default(false).notNull(),
  openaiApiKey: text('openai_api_key'),
  dailyRequests: integer('daily_requests').default(0).notNull(),
  dailyTokens: integer('daily_tokens').default(0).notNull(),
  lastResetDate: timestamp('last_reset_date').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
