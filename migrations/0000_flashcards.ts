import { sql } from 'drizzle-orm';
import { pgTable, serial, text, timestamp, integer, boolean, json, varchar } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

export async function up() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  // Create flashcard_sets table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS flashcard_sets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      is_public BOOLEAN DEFAULT false,
      tags JSON DEFAULT '[]'::jsonb,
      file_path TEXT,
      url_path TEXT,
      pdf_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create flashcards table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS flashcards (
      id SERIAL PRIMARY KEY,
      set_id INTEGER NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
      vocab_word VARCHAR(255) NOT NULL,
      part_of_speech VARCHAR(50) NOT NULL,
      definition TEXT NOT NULL,
      example_sentence TEXT,
      position INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create memorization_sessions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS memorization_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      set_id INTEGER NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
      progress JSON NOT NULL DEFAULT '{"completed":[],"incorrect":[],"remainingCards":[]}'::jsonb,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      score INTEGER DEFAULT 0
    );
  `);
}

export async function down() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  // Drop tables in reverse order to handle dependencies
  await db.execute(sql`DROP TABLE IF EXISTS memorization_sessions;`);
  await db.execute(sql`DROP TABLE IF EXISTS flashcards;`);
  await db.execute(sql`DROP TABLE IF EXISTS flashcard_sets;`);
}
