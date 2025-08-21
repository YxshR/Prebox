-- OTP Verifications Table Migration
-- Enhance existing OTP table with security features

-- Add security columns to existing OTP table
ALTER TABLE otp_verifications 
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS is_expired BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Rename columns to match our security schema (if they don't match)
DO $$
BEGIN
  -- Check if phone_number column exists, if not rename phone to phone_number
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_verifications' AND column_name = 'phone_number') THEN
    ALTER TABLE otp_verifications RENAME COLUMN phone TO phone_number;
  END IF;
  
  -- Check if otp_code column exists, if not rename code to otp_code
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_verifications' AND column_name = 'otp_code') THEN
    ALTER TABLE otp_verifications RENAME COLUMN code TO otp_code;
  END IF;
END $$;

-- Add indexes for efficient OTP queries
CREATE INDEX IF NOT EXISTS idx_otp_phone_number ON otp_verifications(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_is_used ON otp_verifications(is_used);
CREATE INDEX IF NOT EXISTS idx_otp_user_id ON otp_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_phone_active ON otp_verifications(phone_number, is_used, expires_at);

-- Add function to automatically mark expired OTPs
CREATE OR REPLACE FUNCTION mark_expired_otps()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark OTP as expired if current time is past expiration
  IF NEW.expires_at <= CURRENT_TIMESTAMP THEN
    NEW.is_expired := TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-mark expired OTPs
DROP TRIGGER IF EXISTS trigger_mark_expired_otps ON otp_verifications;
CREATE TRIGGER trigger_mark_expired_otps
  BEFORE INSERT OR UPDATE ON otp_verifications
  FOR EACH ROW
  EXECUTE FUNCTION mark_expired_otps();

-- Add updated_at trigger for OTP table
DROP TRIGGER IF EXISTS trigger_otp_updated_at ON otp_verifications;
CREATE TRIGGER trigger_otp_updated_at
  BEFORE UPDATE ON otp_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired OTPs (to be called by cleanup job)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete OTPs that are older than 24 hours
  DELETE FROM otp_verifications 
  WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to validate OTP with rate limiting
CREATE OR REPLACE FUNCTION validate_otp(
  p_phone_number VARCHAR(20),
  p_otp_code VARCHAR(6)
)
RETURNS TABLE(
  is_valid BOOLEAN,
  user_id UUID,
  error_message TEXT
) AS $$
DECLARE
  otp_record RECORD;
BEGIN
  -- Find the most recent unused OTP for this phone number
  SELECT * INTO otp_record
  FROM otp_verifications
  WHERE phone_number = p_phone_number
    AND is_used = FALSE
    AND is_expired = FALSE
    AND expires_at > CURRENT_TIMESTAMP
    AND attempts < max_attempts
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Check if OTP exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Invalid or expired OTP'::TEXT;
    RETURN;
  END IF;
  
  -- Increment attempt count
  UPDATE otp_verifications 
  SET attempts = attempts + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = otp_record.id;
  
  -- Check if OTP matches
  IF otp_record.otp_code = p_otp_code THEN
    -- Mark OTP as used
    UPDATE otp_verifications 
    SET is_used = TRUE,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = otp_record.id;
    
    RETURN QUERY SELECT TRUE, otp_record.user_id, 'OTP validated successfully'::TEXT;
  ELSE
    -- Check if max attempts reached
    IF otp_record.attempts + 1 >= otp_record.max_attempts THEN
      UPDATE otp_verifications 
      SET is_expired = TRUE,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = otp_record.id;
      
      RETURN QUERY SELECT FALSE, NULL::UUID, 'Maximum attempts reached. Please request a new OTP'::TEXT;
    ELSE
      RETURN QUERY SELECT FALSE, NULL::UUID, 'Invalid OTP code'::TEXT;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;