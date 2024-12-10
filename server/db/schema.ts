import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
  theme: text('theme').default('light').notNull(),
  openaiApiKey: text('openai_api_key'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const apiKeyUsage = pgTable('api_key_usage', {
  id: serial('id').primaryKey(),
  userId: serial('user_id').references(() => users.id),
  endpoint: text('endpoint').notNull(),
  tokensUsed: serial('tokens_used').notNull(),
  cost: text('cost').notNull(),
  success: boolean('success').default(true).notNull(),
  errorMessage: text('error_message'),
  resourceType: text('resource_type'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
