import { pgTable, integer, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export async function up(db: any) {
  await db.schema.alterTable('users').addColumns({
    dailyRequests: integer().default(0).notNull(),
    dailyTokens: integer().default(0).notNull(),
    lastResetDate: timestamp().default(sql`CURRENT_TIMESTAMP`),
  });
}

export async function down(db: any) {
  await db.schema.alterTable('users').dropColumns(['dailyRequests', 'dailyTokens', 'lastResetDate']);
}
