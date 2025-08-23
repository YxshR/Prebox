-- Migration: Create authentication monitoring tables
-- Description: Creates tables for tracking authentication events and monitoring
-- Version: 1.0.0
-- Date: 2024-01-01

-- Create auth_events table for tracking authentication activities
CREATE TABLE IF NOT EXISTS auth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'login_attempt', 'login_success', 'login_failure', 
        'signup_start', 'signup_complete', 
        'phone_verification', 'email_verification', 
        'password_reset', 'logout'
    )),
    user_id UUID,
    email VARCHAR(255),
    phone VARCHAR(20),
    ip_address INET,
    user_agent TEXT,
    method VARCHAR(50) NOT NULL CHECK (method IN (
        'email_password', 'phone_otp', 'auth0', 'google_oauth'
    )),
    success BOOLEAN NOT NULL DEFAULT false,
    error_code VARCHAR(100),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    response_time INTEGER, -- in milliseconds
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create performance_metrics table if it doesn't exist
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER NOT NULL, -- in milliseconds
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    tenant_id UUID,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create business_metrics table if it doesn't exist
CREATE TABLE IF NOT EXISTS business_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    value DECIMAL(15,4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tenant_id UUID,
    user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create error_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS error_events (
    id UUID PRIMARY KEY,
    message TEXT NOT NULL,
    stack TEXT,
    level VARCHAR(20) NOT NULL DEFAULT 'error',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    tenant_id UUID,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create deployment_logs table for tracking deployments
CREATE TABLE IF NOT EXISTS deployment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(50) NOT NULL,
    environment VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'rolled_back')),
    commit_hash VARCHAR(40),
    build_time TIMESTAMP WITH TIME ZONE,
    deployed_by VARCHAR(100),
    deployment_notes TEXT,
    health_check_passed BOOLEAN DEFAULT false,
    rollback_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auth_events_event_type ON auth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_timestamp ON auth_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_auth_events_method ON auth_events(method);
CREATE INDEX IF NOT EXISTS idx_auth_events_success ON auth_events(success);
CREATE INDEX IF NOT EXISTS idx_auth_events_ip_address ON auth_events(ip_address);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint ON performance_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_tenant_id ON performance_metrics(tenant_id);

CREATE INDEX IF NOT EXISTS idx_business_metrics_name ON business_metrics(name);
CREATE INDEX IF NOT EXISTS idx_business_metrics_timestamp ON business_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_business_metrics_tenant_id ON business_metrics(tenant_id);

CREATE INDEX IF NOT EXISTS idx_error_events_level ON error_events(level);
CREATE INDEX IF NOT EXISTS idx_error_events_timestamp ON error_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_events_endpoint ON error_events(endpoint);

CREATE INDEX IF NOT EXISTS idx_deployment_logs_version ON deployment_logs(version);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_environment ON deployment_logs(environment);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_status ON deployment_logs(status);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_created_at ON deployment_logs(created_at);

-- Add foreign key constraints where appropriate (only if users table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        -- Add foreign key constraints (skip if already exists)
        BEGIN
            ALTER TABLE auth_events 
            ADD CONSTRAINT fk_auth_events_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN
            -- Constraint already exists, skip
        END;

        BEGIN
            ALTER TABLE performance_metrics 
            ADD CONSTRAINT fk_performance_metrics_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN
            -- Constraint already exists, skip
        END;

        BEGIN
            ALTER TABLE business_metrics 
            ADD CONSTRAINT fk_business_metrics_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN
            -- Constraint already exists, skip
        END;

        BEGIN
            ALTER TABLE error_events 
            ADD CONSTRAINT fk_error_events_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN
            -- Constraint already exists, skip
        END;
    END IF;
END $$;

-- Add table comments for documentation
COMMENT ON TABLE auth_events IS 'Tracks all authentication-related events for monitoring and security analysis';
COMMENT ON TABLE performance_metrics IS 'Stores API endpoint performance data for monitoring and optimization';
COMMENT ON TABLE business_metrics IS 'Stores business-specific metrics for analytics and reporting';
COMMENT ON TABLE error_events IS 'Logs application errors and exceptions for debugging and monitoring';
COMMENT ON TABLE deployment_logs IS 'Tracks deployment history and status for operational monitoring';

-- Add column comments
COMMENT ON COLUMN auth_events.event_type IS 'Type of authentication event (login, signup, verification, etc.)';
COMMENT ON COLUMN auth_events.method IS 'Authentication method used (email/password, phone OTP, Auth0, etc.)';
COMMENT ON COLUMN auth_events.success IS 'Whether the authentication event was successful';
COMMENT ON COLUMN auth_events.response_time IS 'Time taken to process the authentication request in milliseconds';

COMMENT ON COLUMN performance_metrics.response_time IS 'API response time in milliseconds';
COMMENT ON COLUMN business_metrics.value IS 'Numeric value of the business metric';
COMMENT ON COLUMN deployment_logs.health_check_passed IS 'Whether post-deployment health checks passed';