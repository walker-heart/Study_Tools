import { pgTable, serial, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  theme: varchar('theme', { length: 10 }).default('light'),
  isAdmin: boolean('is_admin').default(false).notNull(),
  firebaseUid: varchar('firebase_uid', { length: 128 }).unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
