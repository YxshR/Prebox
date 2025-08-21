-- Security and Compliance Tables Migration
-- This migration creates all necessary tables for security monitoring, audit logging, and GDPR compliance

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    details JSONB,
    ip_address INET NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Threat Alerts Table
CREATE TABLE IF NOT EXISTS threat_alerts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64),
    threat_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    description TEXT NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    details JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(64)
);

-- Indexes for threat alerts
CREATE INDEX IF NOT EXISTS idx_threat_alerts_tenant_id ON threat_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_threat_alerts_user_id ON threat_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_threat_alerts_threat_type ON threat_alerts(threat_type);
CREATE INDEX IF NOT EXISTS idx_threat_alerts_severity ON threat_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_threat_alerts_status ON threat_alerts(status);
CREATE INDEX IF NOT EXISTS idx_threat_alerts_created_at ON threat_alerts(created_at);

-- Blocked IPs Table
CREATE TABLE IF NOT EXISTS blocked_ips (
    id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL UNIQUE,
    reason VARCHAR(100) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for blocked IPs
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires_at ON blocked_ips(expires_at);

-- Throttled API Keys Table
CREATE TABLE IF NOT EXISTS throttled_api_keys (
    id SERIAL PRIMARY KEY,
    api_key_id VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for throttled API keys
CREATE INDEX IF NOT EXISTS idx_throttled_api_keys_api_key_id ON throttled_api_keys(api_key_id);
CREATE INDEX IF NOT EXISTS idx_throttled_api_keys_expires_at ON throttled_api_keys(expires_at);

-- GDPR Data Export Requests Table
CREATE TABLE IF NOT EXISTS gdpr_data_export_requests (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    requested_by VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    download_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Indexes for GDPR export requests
CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_user_id ON gdpr_data_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_tenant_id ON gdpr_data_export_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_status ON gdpr_data_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_created_at ON gdpr_data_export_requests(created_at);

-- GDPR Data Deletion Requests Table
CREATE TABLE IF NOT EXISTS gdpr_data_deletion_requests (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    requested_by VARCHAR(64) NOT NULL,
    retention_period_days INTEGER NOT NULL DEFAULT 30,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('pending', 'scheduled', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for GDPR deletion requests
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_user_id ON gdpr_data_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_tenant_id ON gdpr_data_deletion_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_status ON gdpr_data_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_scheduled_at ON gdpr_data_deletion_requests(scheduled_at);

-- GDPR Consent Records Table
CREATE TABLE IF NOT EXISTS gdpr_consent_records (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('marketing', 'analytics', 'functional', 'necessary')),
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    version VARCHAR(10) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for consent records
CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_user_id ON gdpr_consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_tenant_id ON gdpr_consent_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_consent_type ON gdpr_consent_records(consent_type);
CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_created_at ON gdpr_consent_records(created_at);

-- Security Configuration Table
CREATE TABLE IF NOT EXISTS security_configurations (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL UNIQUE,
    max_login_attempts INTEGER NOT NULL DEFAULT 5,
    lockout_duration_minutes INTEGER NOT NULL DEFAULT 15,
    password_min_length INTEGER NOT NULL DEFAULT 8,
    password_require_uppercase BOOLEAN NOT NULL DEFAULT true,
    password_require_lowercase BOOLEAN NOT NULL DEFAULT true,
    password_require_numbers BOOLEAN NOT NULL DEFAULT true,
    password_require_symbols BOOLEAN NOT NULL DEFAULT false,
    session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
    api_rate_limit_per_minute INTEGER NOT NULL DEFAULT 100,
    enable_2fa BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for security configurations
CREATE INDEX IF NOT EXISTS idx_security_configurations_tenant_id ON security_configurations(tenant_id);

-- Data Encryption Keys Table (for key rotation)
CREATE TABLE IF NOT EXISTS encryption_keys (
    id SERIAL PRIMARY KEY,
    key_id VARCHAR(64) NOT NULL UNIQUE,
    encrypted_key TEXT NOT NULL, -- The actual key is encrypted with a master key
    algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotating', 'retired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    retired_at TIMESTAMP WITH TIME ZONE
);

-- Index for encryption keys
CREATE INDEX IF NOT EXISTS idx_encryption_keys_key_id ON encryption_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_status ON encryption_keys(status);

-- Security Events Summary Table (for performance)
CREATE TABLE IF NOT EXISTS security_events_summary (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    date DATE NOT NULL,
    failed_logins INTEGER NOT NULL DEFAULT 0,
    successful_logins INTEGER NOT NULL DEFAULT 0,
    rate_limit_violations INTEGER NOT NULL DEFAULT 0,
    threat_alerts INTEGER NOT NULL DEFAULT 0,
    blocked_requests INTEGER NOT NULL DEFAULT 0,
    api_requests INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, date)
);

-- Indexes for security events summary
CREATE INDEX IF NOT EXISTS idx_security_events_summary_tenant_id ON security_events_summary(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_events_summary_date ON security_events_summary(date);

-- Add foreign key constraints (if referenced tables exist)
-- Note: Uncomment these if the referenced tables exist in your schema

-- ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_tenant_id 
--     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_user_id 
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ALTER TABLE threat_alerts ADD CONSTRAINT fk_threat_alerts_tenant_id 
--     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ALTER TABLE threat_alerts ADD CONSTRAINT fk_threat_alerts_user_id 
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ALTER TABLE gdpr_data_export_requests ADD CONSTRAINT fk_gdpr_export_user_id 
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ALTER TABLE gdpr_data_deletion_requests ADD CONSTRAINT fk_gdpr_deletion_user_id 
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ALTER TABLE gdpr_consent_records ADD CONSTRAINT fk_gdpr_consent_user_id 
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ALTER TABLE security_configurations ADD CONSTRAINT fk_security_config_tenant_id 
--     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Create functions for automatic cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_security_data()
RETURNS void AS $$
BEGIN
    -- Clean up expired blocked IPs
    DELETE FROM blocked_ips WHERE expires_at <= NOW();
    
    -- Clean up expired throttled API keys
    DELETE FROM throttled_api_keys WHERE expires_at <= NOW();
    
    -- Clean up expired data export requests
    DELETE FROM gdpr_data_export_requests WHERE expires_at <= NOW();
    
    -- Archive old audit logs (older than 7 years)
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '7 years';
    
    -- Archive old threat alerts (older than 2 years)
    UPDATE threat_alerts SET status = 'RESOLVED' 
    WHERE created_at < NOW() - INTERVAL '2 years' AND status = 'ACTIVE';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update security events summary
CREATE OR REPLACE FUNCTION update_security_events_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Update daily summary based on audit log entries
    INSERT INTO security_events_summary (tenant_id, date, failed_logins, successful_logins, rate_limit_violations, api_requests)
    VALUES (
        NEW.tenant_id,
        DATE(NEW.created_at),
        CASE WHEN NEW.action = 'LOGIN_FAILED' THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'LOGIN_SUCCESS' THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'SECURITY_RATE_LIMIT_EXCEEDED' THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'API_REQUEST' THEN 1 ELSE 0 END
    )
    ON CONFLICT (tenant_id, date) DO UPDATE SET
        failed_logins = security_events_summary.failed_logins + 
            CASE WHEN NEW.action = 'LOGIN_FAILED' THEN 1 ELSE 0 END,
        successful_logins = security_events_summary.successful_logins + 
            CASE WHEN NEW.action = 'LOGIN_SUCCESS' THEN 1 ELSE 0 END,
        rate_limit_violations = security_events_summary.rate_limit_violations + 
            CASE WHEN NEW.action = 'SECURITY_RATE_LIMIT_EXCEEDED' THEN 1 ELSE 0 END,
        api_requests = security_events_summary.api_requests + 
            CASE WHEN NEW.action = 'API_REQUEST' THEN 1 ELSE 0 END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logs
DROP TRIGGER IF EXISTS trigger_update_security_events_summary ON audit_logs;
CREATE TRIGGER trigger_update_security_events_summary
    AFTER INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_security_events_summary();

-- Insert default security configuration for existing tenants
-- INSERT INTO security_configurations (tenant_id)
-- SELECT DISTINCT tenant_id FROM users
-- ON CONFLICT (tenant_id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system activities';
COMMENT ON TABLE threat_alerts IS 'Security threat detection and alerting system';
COMMENT ON TABLE blocked_ips IS 'Temporarily blocked IP addresses for security';
COMMENT ON TABLE throttled_api_keys IS 'Temporarily throttled API keys for rate limiting';
COMMENT ON TABLE gdpr_data_export_requests IS 'GDPR Article 20 - Right to Data Portability requests';
COMMENT ON TABLE gdpr_data_deletion_requests IS 'GDPR Article 17 - Right to Erasure requests';
COMMENT ON TABLE gdpr_consent_records IS 'GDPR Article 7 - Consent management records';
COMMENT ON TABLE security_configurations IS 'Per-tenant security policy configurations';
COMMENT ON TABLE encryption_keys IS 'Encryption key management for data protection';
COMMENT ON TABLE security_events_summary IS 'Daily aggregated security metrics for performance';