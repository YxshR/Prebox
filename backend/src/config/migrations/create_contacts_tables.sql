-- Contact Management Tables Migration
-- This migration creates tables for contact management, lists, and engagement tracking

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    custom_fields JSONB DEFAULT '{}',
    subscription_status VARCHAR(20) DEFAULT 'subscribed' CHECK (subscription_status IN ('subscribed', 'unsubscribed', 'bounced', 'complained')),
    source VARCHAR(50) DEFAULT 'manual', -- manual, import, api, form
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_email_per_tenant UNIQUE (tenant_id, email)
);

-- Contact Lists table
CREATE TABLE IF NOT EXISTS contact_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    contact_count INTEGER DEFAULT 0,
    is_suppression_list BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_list_name_per_tenant UNIQUE (tenant_id, name)
);

-- Contact List Memberships (many-to-many relationship)
CREATE TABLE IF NOT EXISTS contact_list_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    added_by VARCHAR(50) DEFAULT 'system', -- system, user, import, api
    
    CONSTRAINT unique_contact_list_membership UNIQUE (contact_id, list_id)
);

-- Contact Engagement Events
CREATE TABLE IF NOT EXISTS contact_engagement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    campaign_id UUID,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed')),
    event_data JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_contact_engagement_contact_id (contact_id),
    INDEX idx_contact_engagement_event_type (event_type),
    INDEX idx_contact_engagement_timestamp (timestamp)
);

-- Contact Import Jobs
CREATE TABLE IF NOT EXISTS contact_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_size INTEGER,
    total_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    successful_imports INTEGER DEFAULT 0,
    failed_imports INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_details JSONB,
    list_id UUID REFERENCES contact_lists(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Suppression Lists (Global and List-specific)
CREATE TABLE IF NOT EXISTS suppression_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    suppression_type VARCHAR(20) NOT NULL CHECK (suppression_type IN ('bounce', 'complaint', 'unsubscribe', 'manual')),
    reason TEXT,
    source_campaign_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_suppression_per_tenant UNIQUE (tenant_id, email, suppression_type)
);

-- Contact Segments (for advanced segmentation)
CREATE TABLE IF NOT EXISTS contact_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL, -- JSON conditions for dynamic segmentation
    contact_count INTEGER DEFAULT 0,
    last_calculated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_segment_name_per_tenant UNIQUE (tenant_id, name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_subscription_status ON contacts(subscription_status);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);

CREATE INDEX IF NOT EXISTS idx_contact_lists_tenant_id ON contact_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_lists_suppression ON contact_lists(is_suppression_list);

CREATE INDEX IF NOT EXISTS idx_contact_list_memberships_contact_id ON contact_list_memberships(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_list_memberships_list_id ON contact_list_memberships(list_id);

CREATE INDEX IF NOT EXISTS idx_suppression_entries_tenant_id ON suppression_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppression_entries_email ON suppression_entries(email);
CREATE INDEX IF NOT EXISTS idx_suppression_entries_type ON suppression_entries(suppression_type);

CREATE INDEX IF NOT EXISTS idx_contact_segments_tenant_id ON contact_segments(tenant_id);

-- Triggers for updating contact counts
CREATE OR REPLACE FUNCTION update_contact_list_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE contact_lists 
        SET contact_count = contact_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.list_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE contact_lists 
        SET contact_count = contact_count - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.list_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contact_list_count
    AFTER INSERT OR DELETE ON contact_list_memberships
    FOR EACH ROW EXECUTE FUNCTION update_contact_list_count();

-- Function to update contact updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contact_timestamp
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_contact_timestamp();

CREATE TRIGGER trigger_update_contact_list_timestamp
    BEFORE UPDATE ON contact_lists
    FOR EACH ROW EXECUTE FUNCTION update_contact_timestamp();