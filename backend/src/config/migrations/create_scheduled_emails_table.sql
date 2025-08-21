-- Create scheduled_emails table for storing scheduled email campaigns
-- Requirements: 17.1, 17.2, 17.3, 17.4, 17.5

CREATE TABLE IF NOT EXISTS scheduled_emails (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    campaign_id VARCHAR(255),
    email_job JSONB NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('subscription', 'recharge')),
    estimated_cost DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_tenant_id ON scheduled_emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_at ON scheduled_emails(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_user_type ON scheduled_emails(user_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status_scheduled_at ON scheduled_emails(status, scheduled_at);

-- Create composite index for efficient processing of due emails
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_due_processing 
ON scheduled_emails(status, scheduled_at) 
WHERE status = 'pending';

-- Add comments for documentation
COMMENT ON TABLE scheduled_emails IS 'Stores scheduled email campaigns with automatic sending capabilities';
COMMENT ON COLUMN scheduled_emails.id IS 'Unique identifier for the scheduled email';
COMMENT ON COLUMN scheduled_emails.tenant_id IS 'Tenant/user who scheduled the email';
COMMENT ON COLUMN scheduled_emails.campaign_id IS 'Optional campaign ID if part of a campaign';
COMMENT ON COLUMN scheduled_emails.email_job IS 'JSON containing email details (recipients, content, etc.)';
COMMENT ON COLUMN scheduled_emails.scheduled_at IS 'When the email should be sent';
COMMENT ON COLUMN scheduled_emails.status IS 'Current status: pending, processing, sent, failed, cancelled';
COMMENT ON COLUMN scheduled_emails.user_type IS 'subscription (14-day limit) or recharge (unlimited)';
COMMENT ON COLUMN scheduled_emails.estimated_cost IS 'Estimated cost for recharge users';
COMMENT ON COLUMN scheduled_emails.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN scheduled_emails.max_retries IS 'Maximum retry attempts allowed';