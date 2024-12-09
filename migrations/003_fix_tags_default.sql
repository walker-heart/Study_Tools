-- Fix the tags column default value in flashcard_sets table
ALTER TABLE flashcard_sets 
ALTER COLUMN tags SET DEFAULT '[]'::json;

-- Update any existing NULL values
UPDATE flashcard_sets 
SET tags = '[]'::json 
WHERE tags IS NULL;
