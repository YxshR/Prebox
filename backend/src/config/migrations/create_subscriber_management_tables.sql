-- Subscriber Management Tables Migration
-- This migration creates tables for subscriber preferences and enhanced contact management

-- Contact Preferences table for subscriber preference management
CREATE TABLE IF NOT EXISTS contact_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    preferences JSONB DEFAULT '{
        "marketing": true,
        "transactional": true,
        "newsletters": true,
        "promotions": true
    }',
    frequency VARCHAR(20) DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'never')),
    categories TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_contact_preferences UNIQUE (contact_id)
);

-- Unsubscribe Tokens table for one-click unsubscribe tracking
CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    campaign_id UUID,
    tenant_id UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_unsubscribe_tokens_token (token),
    INDEX idx_unsubscribe_tokens_email (email),
    INDEX idx_unsubscribe_tokens_expires (expires_at)
);

-- Contact Deduplication Log table to track deduplication operations
CREATE TABLE IF NOT EXISTS contact_deduplication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    operation_id UUID DEFAULT gen_random_uuid(),
    primary_contact_id UUID NOT NULL,
    merged_contact_ids UUID[] NOT NULL,
    email VARCHAR(255) NOT NULL,
    merge_strategy VARCHAR(50) DEFAULT 'keep_oldest',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_deduplication_logs_tenant (tenant_id),
    INDEX idx_deduplication_logs_operation (operation_id),
    INDEX idx_deduplication_logs_email (email)
);

-- Enhanced indexes for subscriber management performance
CREATE INDEX IF NOT EXISTS idx_contact_preferences_contact_id ON contact_preferences(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_preferences_frequency ON contact_preferences(frequency);
CREATE INDEX IF NOT EXISTS idx_contact_preferences_categories ON contact_preferences USING GIN(categories);

-- Add indexes for engagement analytics queries
CREATE INDEX IF NOT EXISTS idx_contact_engagement_events_contact_timestamp ON contact_engagement_events(contact_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_contact_engagement_events_campaign_type ON contact_engagement_events(campaign_id, event_type);

-- Function to update contact preferences timestamp
CREATE OR REPLACE FUNCTION update_contact_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contact_preferences_timestamp
    BEFORE UPDATE ON contact_preferences
    FOR EACH ROW EXECUTE FUNCTION update_contact_preferences_timestamp();

-- Function to automatically create default preferences for new contacts
CREATE OR REPLACE FUNCTION create_default_contact_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO contact_preferences (contact_id)
    VALUES (NEW.id)
    ON CONFLICT (contact_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_contact_preferences
    AFTER INSERT ON contacts
    FOR EACH ROW EXECUTE FUNCTION create_default_contact_preferences();

-- View for contact engagement summary (for performance)
CREATE OR REPLACE VIEW contact_engagement_summary AS
SELECT 
    c.id as contact_id,
    c.tenant_id,
    c.email,
    c.subscription_status,
    COUNT(cee.id) as total_events,
    COUNT(CASE WHEN cee.event_type = 'sent' THEN 1 END) as total_sent,
    COUNT(CASE WHEN cee.event_type = 'delivered' THEN 1 END) as total_delivered,
    COUNT(CASE WHEN cee.event_type = 'opened' THEN 1 END) as total_opened,
    COUNT(CASE WHEN cee.event_type = 'clicked' THEN 1 END) as total_clicked,
    COUNT(CASE WHEN cee.event_type = 'bounced' THEN 1 END) as total_bounced,
    COUNT(CASE WHEN cee.event_type = 'complained' THEN 1 END) as total_complaints,
    COUNT(CASE WHEN cee.event_type = 'unsubscribed' THEN 1 END) as total_unsubscribes,
    MAX(cee.timestamp) as last_engagement,
    MIN(cee.timestamp) as first_engagement
FROM contacts c
LEFT JOIN contact_engagement_events cee ON c.id = cee.contact_id
GROUP BY c.id, c.tenant_id, c.email, c.subscription_status;

-- Function to clean up expired unsubscribe tokens
CREATE OR REPLACE FUNCTION cleanup_expired_unsubscribe_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM unsubscribe_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE contact_preferences IS 'Stores subscriber preferences for email frequency, categories, and communication types';
COMMENT ON TABLE unsubscribe_tokens IS 'Tracks one-click unsubscribe tokens with expiration and usage tracking';
COMMENT ON TABLE contact_deduplication_logs IS 'Logs contact deduplication operations for audit and rollback purposes';
COMMENT ON VIEW contact_engagement_summary IS 'Materialized view for fast contact engagement analytics queries';