-- Create user_settings table for storing user preferences
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true,
    webhook_url TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at);

-- Add comments for documentation
COMMENT ON TABLE user_settings IS 'User preferences and settings';
COMMENT ON COLUMN user_settings.user_id IS 'Reference to the user who owns these settings';
COMMENT ON COLUMN user_settings.email_notifications IS 'Whether user wants to receive email notifications';
COMMENT ON COLUMN user_settings.webhook_url IS 'URL for webhook notifications (optional)';
COMMENT ON COLUMN user_settings.timezone IS 'User preferred timezone';
COMMENT ON COLUMN user_settings.language IS 'User preferred language code';