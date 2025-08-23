-- Migration: Create user_sessions table for session management
-- Description: Add session management with database persistence for JWT tokens

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jwt_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    
    -- Indexes for performance
    CONSTRAINT user_sessions_user_id_idx UNIQUE (user_id, refresh_token),
    CONSTRAINT user_sessions_expires_at_check CHECK (expires_at > created_at)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active, expires_at);

-- Add comments for documentation
COMMENT ON TABLE user_sessions IS 'Stores user session information with JWT tokens for authentication';
COMMENT ON COLUMN user_sessions.id IS 'Unique session identifier';
COMMENT ON COLUMN user_sessions.user_id IS 'Reference to the user who owns this session';
COMMENT ON COLUMN user_sessions.jwt_token IS 'The JWT access token for this session';
COMMENT ON COLUMN user_sessions.refresh_token IS 'The refresh token for renewing access tokens';
COMMENT ON COLUMN user_sessions.expires_at IS 'When this session expires';
COMMENT ON COLUMN user_sessions.created_at IS 'When this session was created';
COMMENT ON COLUMN user_sessions.last_accessed_at IS 'When this session was last used';
COMMENT ON COLUMN user_sessions.ip_address IS 'IP address where the session was created';
COMMENT ON COLUMN user_sessions.user_agent IS 'User agent string from the client';
COMMENT ON COLUMN user_sessions.is_active IS 'Whether this session is currently active';