-- Migration: Update email_verifications table for SendGrid integration
-- This migration adds support for verification codes and updates the table structure

-- Add verification_code column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_verifications' 
                   AND column_name = 'verification_code') THEN
        ALTER TABLE email_verifications ADD COLUMN verification_code VARCHAR(6);
    END IF;
END $$;

-- Add verified_at column if it doesn't exist (replacing is_used)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_verifications' 
                   AND column_name = 'verified_at') THEN
        ALTER TABLE email_verifications ADD COLUMN verified_at TIMESTAMP;
    END IF;
END $$;

-- Update existing records to use verified_at instead of is_used
UPDATE email_verifications 
SET verified_at = created_at 
WHERE is_used = true AND verified_at IS NULL;

-- Create index on verification_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_verifications_code 
ON email_verifications(verification_code) 
WHERE verified_at IS NULL;

-- Create index on email and verification_code combination
CREATE INDEX IF NOT EXISTS idx_email_verifications_email_code 
ON email_verifications(email, verification_code) 
WHERE verified_at IS NULL;

-- Create index on expires_at for cleanup operations
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at 
ON email_verifications(expires_at);

-- Add constraint to ensure verification_code is 6 digits when present
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'chk_verification_code_format') THEN
        ALTER TABLE email_verifications 
        ADD CONSTRAINT chk_verification_code_format 
        CHECK (verification_code IS NULL OR verification_code ~ '^[0-9]{6}$');
    END IF;
END $$;

-- Update the table comment
COMMENT ON TABLE email_verifications IS 'Email verification records supporting both token and code-based verification';
COMMENT ON COLUMN email_verifications.verification_code IS '6-digit numeric verification code sent via email';
COMMENT ON COLUMN email_verifications.verified_at IS 'Timestamp when the email was successfully verified';
COMMENT ON COLUMN email_verifications.token IS 'Legacy token-based verification (deprecated in favor of verification_code)';

-- Create a function to clean up expired verifications
CREATE OR REPLACE FUNCTION cleanup_expired_email_verifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_verifications 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get verification statistics
CREATE OR REPLACE FUNCTION get_email_verification_stats()
RETURNS TABLE (
    total_verifications BIGINT,
    pending_verifications BIGINT,
    verified_count BIGINT,
    expired_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_verifications,
        COUNT(*) FILTER (WHERE verified_at IS NULL AND expires_at > NOW()) as pending_verifications,
        COUNT(*) FILTER (WHERE verified_at IS NOT NULL) as verified_count,
        COUNT(*) FILTER (WHERE verified_at IS NULL AND expires_at <= NOW()) as expired_count
    FROM email_verifications;
END;
$$ LANGUAGE plpgsql;