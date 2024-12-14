import { pgTable, serial, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import type { FirebaseAuthUser } from "../types/firebase-auth";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  firebaseUid: varchar('firebase_uid', { length: 128 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 200 }),
  photoURL: varchar('photo_url', { length: 1024 }),
  theme: varchar('theme', { length: 10 }).default('system'),
  isAdmin: boolean('is_admin').default(false).notNull(),
  emailVerified: boolean('email_verified').default(false),
  phoneNumber: varchar('phone_number', { length: 20 }),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  endedAt: timestamp('ended_at'),
  customClaims: text('custom_claims'),
  providerData: text('provider_data'),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Convert a Firebase auth user to a database user
 */
export function firebaseUserToDbUser(firebaseUser: FirebaseAuthUser): Partial<InsertUser> {
  const names = firebaseUser.displayName?.split(' ') || ['', ''];
  
  return {
    firebaseUid: firebaseUser.uid,
    email: firebaseUser.email || '',
    firstName: names[0],
    lastName: names.slice(1).join(' ') || names[0],
    displayName: firebaseUser.displayName || undefined,
    photoURL: firebaseUser.photoURL || undefined,
    emailVerified: firebaseUser.emailVerified,
    phoneNumber: firebaseUser.phoneNumber || undefined,
    providerData: JSON.stringify(firebaseUser.providerData),
    lastLoginAt: new Date(),
  };
}

export { type FirebaseAuthUser };
