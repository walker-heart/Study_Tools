import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { flashcardSets } from '../db/schema/flashcards';

export async function up(db: any) {
  await db.schema.alterTable(flashcardSets)
    .addColumn('file_path', text('file_path'));
  
  // Add an index for faster file lookups
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_flashcard_sets_file_path 
    ON flashcard_sets(file_path)
    WHERE file_path IS NOT NULL
  `);
}

export async function down(db: any) {
  await db.execute(sql`DROP INDEX IF EXISTS idx_flashcard_sets_file_path`);
  await db.schema.alterTable(flashcardSets).dropColumn('file_path');
}
