-- Enhanced Users Security Migration
-- Adds JWT secrets and security enhancements to existing users table

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add JWT secret columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS jwt_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS jwt_refresh_secret VARCHAR(255);

-- Make phone unique where not null (phone column already exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique 
ON users(phone) WHERE phone IS NOT NULL;

-- Update existing users to have JWT secrets if they don't already
UPDATE users 
SET 
  jwt_secret = encode(digest(random()::text || clock_timestamp()::text || id::text, 'sha256'), 'hex'),
  jwt_refresh_secret = encode(digest(random()::text || clock_timestamp()::text || id::text || 'refresh', 'sha256'), 'hex')
WHERE jwt_secret IS NULL OR jwt_refresh_secret IS NULL;

-- Make JWT secrets NOT NULL after populating existing records
ALTER TABLE users 
ALTER COLUMN jwt_secret SET NOT NULL,
ALTER COLUMN jwt_refresh_secret SET NOT NULL;

-- Add indexes for security queries
CREATE INDEX IF NOT EXISTS idx_users_jwt_secret ON users(jwt_secret);
CREATE INDEX IF NOT EXISTS idx_users_phone_verified ON users(is_phone_verified);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Add function to generate JWT secrets for new users
CREATE OR REPLACE FUNCTION generate_user_jwt_secrets()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.jwt_secret IS NULL THEN
    NEW.jwt_secret := encode(digest(random()::text || clock_timestamp()::text || NEW.id::text, 'sha256'), 'hex');
  END IF;
  
  IF NEW.jwt_refresh_secret IS NULL THEN
    NEW.jwt_refresh_secret := encode(digest(random()::text || clock_timestamp()::text || NEW.id::text || 'refresh', 'sha256'), 'hex');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate JWT secrets for new users
DROP TRIGGER IF EXISTS trigger_generate_jwt_secrets ON users;
CREATE TRIGGER trigger_generate_jwt_secrets
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION generate_user_jwt_secrets();

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at on users table
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();