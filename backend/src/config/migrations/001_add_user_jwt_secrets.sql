-- Add per-user JWT secrets to users table for enhanced security
-- This migration adds individual JWT secrets for each user

-- Add JWT secret columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS jwt_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS jwt_refresh_secret VARCHAR(255);

-- Create index for faster JWT secret lookups
CREATE INDEX IF NOT EXISTS idx_users_jwt_secret ON users(jwt_secret);

-- Update existing users with generated JWT secrets (for development/migration)
-- In production, this should be done more carefully with proper secret generation
UPDATE users 
SET 
    jwt_secret = encode(gen_random_bytes(32), 'base64'),
    jwt_refresh_secret = encode(gen_random_bytes(32), 'base64')
WHERE jwt_secret IS NULL OR jwt_refresh_secret IS NULL;

-- Make JWT secrets NOT NULL after populating existing records
ALTER TABLE users 
ALTER COLUMN jwt_secret SET NOT NULL,
ALTER COLUMN jwt_refresh_secret SET NOT NULL;

-- Add unique constraints to ensure no duplicate secrets
ALTER TABLE users 
ADD CONSTRAINT unique_jwt_secret UNIQUE (jwt_secret),
ADD CONSTRAINT unique_jwt_refresh_secret UNIQUE (jwt_refresh_secret);