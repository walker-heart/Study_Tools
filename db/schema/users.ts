import { pgTable, serial, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  theme: varchar('theme', { length: 10 }).default('system'),
  isAdmin: boolean('is_admin').default(false).notNull(),
  firebaseUid: varchar('firebase_uid', { length: 128 }).notNull().unique(),
  photoURL: varchar('photo_url', { length: 1024 }),
  emailVerified: boolean('email_verified').default(false),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  endedAt: timestamp('ended_at'), // Add the missing column
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Firebase auth types
export interface FirebaseAuthUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified: boolean;
  phoneNumber?: string | null;
  tenantId?: string | null;
  providerData: Array<{
    uid: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    photoURL: string | null;
    providerId: string;
  }>;
}

// Type guard to check if a user has admin privileges
export function isAdmin(user: FirebaseAuthUser | null | undefined): boolean {
  if (!user) return false;
  // Add your admin checking logic here
  // For example, check against a list of admin emails or custom claims
  return false;
}
