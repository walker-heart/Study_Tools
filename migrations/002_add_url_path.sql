-- Add url_path column to flashcard_sets table
ALTER TABLE flashcard_sets ADD COLUMN IF NOT EXISTS url_path text;
