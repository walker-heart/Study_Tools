import { pgTable, serial, text, timestamp, boolean, decimal } from "drizzle-orm/pg-core";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
  theme: text('theme').default('light').notNull(),
  openaiApiKey: text('openai_api_key'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const apiKeyUsage = pgTable('api_key_usage', {
  id: serial('id').primaryKey(),
  userId: serial('user_id').references(() => users.id).notNull(),
  endpoint: text('endpoint').notNull(),
  tokensUsed: serial('tokens_used').notNull().default(0),
  cost: decimal('cost', { precision: 10, scale: 4 }).notNull(),
  success: boolean('success').default(true).notNull(),
  errorMessage: text('error_message'),
  resourceType: text('resource_type').default('text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Export types for use in application code
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ApiKeyUsage = typeof apiKeyUsage.$inferSelect;
export type InsertApiKeyUsage = typeof apiKeyUsage.$inferInsert;
