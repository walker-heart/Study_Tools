-- Add ended_at column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;
