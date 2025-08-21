-- Enhanced OTP table migration for secure OTP management system
-- This migration enhances the existing otp_verifications table with additional security fields

-- Add new columns to existing otp_verifications table
ALTER TABLE otp_verifications 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS otp_code VARCHAR(64), -- Changed to store hashed codes
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS block_expires_at TIMESTAMP WITH TIME ZONE;

-- Update existing records to use phone_number if they have phone field
UPDATE otp_verifications SET phone_number = phone WHERE phone_number IS NULL AND phone IS NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_otp_phone_type ON otp_verifications(phone_number, type);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_user_id ON otp_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_is_used ON otp_verifications(is_used);
CREATE INDEX IF NOT EXISTS idx_otp_attempts ON otp_verifications(attempts);

-- Create function to validate OTP with enhanced security
CREATE OR REPLACE FUNCTION validate_otp(
    p_phone_number VARCHAR(20),
    p_otp_code VARCHAR(6)
) RETURNS TABLE(
    is_valid BOOLEAN,
    user_id UUID,
    error_message TEXT
) AS $$
DECLARE
    otp_record RECORD;
    hashed_code VARCHAR(64);
BEGIN
    -- Hash the provided OTP code for comparison
    hashed_code := encode(digest(p_otp_code || current_setting('app.jwt_secret', true), 'sha256'), 'hex');
    
    -- Get the most recent unused OTP for this phone number
    SELECT * INTO otp_record
    FROM otp_verifications 
    WHERE phone_number = p_phone_number 
    AND is_used = false 
    AND expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Check if OTP exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, 'No valid OTP found for this phone number';
        RETURN;
    END IF;
    
    -- Check if OTP is blocked due to too many attempts
    IF otp_record.attempts >= otp_record.max_attempts THEN
        -- Mark as used to prevent further attempts
        UPDATE otp_verifications 
        SET is_used = true, is_blocked = true 
        WHERE id = otp_record.id;
        
        RETURN QUERY SELECT false, NULL::UUID, 'OTP blocked due to too many attempts';
        RETURN;
    END IF;
    
    -- Increment attempt counter
    UPDATE otp_verifications 
    SET attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP
    WHERE id = otp_record.id;
    
    -- Validate OTP code
    IF otp_record.otp_code = hashed_code THEN
        -- Mark OTP as used
        UPDATE otp_verifications 
        SET is_used = true 
        WHERE id = otp_record.id;
        
        -- Update user phone verification if this is a registration OTP
        IF otp_record.type = 'registration' AND otp_record.user_id IS NOT NULL THEN
            UPDATE users 
            SET is_phone_verified = true 
            WHERE id = otp_record.user_id;
        END IF;
        
        RETURN QUERY SELECT true, otp_record.user_id, NULL;
    ELSE
        RETURN QUERY SELECT false, NULL::UUID, 'Invalid OTP code';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to cleanup expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired or used OTPs older than 24 hours
    DELETE FROM otp_verifications 
    WHERE (expires_at < CURRENT_TIMESTAMP OR is_used = true)
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get OTP statistics
CREATE OR REPLACE FUNCTION get_otp_stats() RETURNS TABLE(
    total_otps BIGINT,
    active_otps BIGINT,
    expired_otps BIGINT,
    used_otps BIGINT,
    blocked_otps BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_otps,
        COUNT(*) FILTER (WHERE is_used = false AND expires_at > CURRENT_TIMESTAMP) as active_otps,
        COUNT(*) FILTER (WHERE expires_at <= CURRENT_TIMESTAMP) as expired_otps,
        COUNT(*) FILTER (WHERE is_used = true) as used_otps,
        COUNT(*) FILTER (WHERE is_blocked = true) as blocked_otps
    FROM otp_verifications;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically cleanup old OTPs
CREATE OR REPLACE FUNCTION auto_cleanup_otps() RETURNS TRIGGER AS $$
BEGIN
    -- Randomly cleanup expired OTPs (1% chance on each insert)
    IF random() < 0.01 THEN
        PERFORM cleanup_expired_otps();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_cleanup_otps ON otp_verifications;
CREATE TRIGGER trigger_auto_cleanup_otps
    AFTER INSERT ON otp_verifications
    FOR EACH ROW
    EXECUTE FUNCTION auto_cleanup_otps();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_otp(VARCHAR, VARCHAR) TO PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_otps() TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_otp_stats() TO PUBLIC;

-- Add comments for documentation
COMMENT ON FUNCTION validate_otp(VARCHAR, VARCHAR) IS 'Securely validate OTP with attempt tracking and rate limiting';
COMMENT ON FUNCTION cleanup_expired_otps() IS 'Clean up expired and used OTP records';
COMMENT ON FUNCTION get_otp_stats() IS 'Get statistics about OTP usage and status';

-- Set application setting for JWT secret (used in OTP hashing)
-- This should be set at runtime, but we provide a default for development
SELECT set_config('app.jwt_secret', COALESCE(current_setting('app.jwt_secret', true), 'default-jwt-secret'), false);