import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { flashcardSets } from '../db/schema/flashcards';

export async function up(db: any) {
  await db.schema.alterTable(flashcardSets).addColumn(
    'filePath',
    text('file_path')
  );
}

export async function down(db: any) {
  await db.schema.alterTable(flashcardSets).dropColumn('file_path');
}
