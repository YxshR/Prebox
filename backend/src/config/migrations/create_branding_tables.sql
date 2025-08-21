-- Create branding_settings table for logo and branding customization
CREATE TABLE IF NOT EXISTS branding_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    logo_url TEXT,
    logo_position VARCHAR(20) DEFAULT 'header' CHECK (logo_position IN ('header', 'footer', 'sidebar')),
    primary_color VARCHAR(7) DEFAULT '#000000',
    secondary_color VARCHAR(7) DEFAULT '#ffffff',
    text_color VARCHAR(7) DEFAULT '#333333',
    font_family VARCHAR(100) DEFAULT 'Arial, sans-serif',
    custom_css TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create logo_uploads table for logo file metadata
CREATE TABLE IF NOT EXISTS logo_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    thumbnail_url TEXT,
    upload_status VARCHAR(20) DEFAULT 'pending' CHECK (upload_status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_branding_settings_tenant_id ON branding_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branding_settings_active ON branding_settings(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_logo_uploads_tenant_id ON logo_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_logo_uploads_status ON logo_uploads(tenant_id, upload_status);

-- Add foreign key constraints (assuming tenants table exists)
-- ALTER TABLE branding_settings ADD CONSTRAINT fk_branding_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- ALTER TABLE logo_uploads ADD CONSTRAINT fk_logo_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_branding_settings_updated_at 
    BEFORE UPDATE ON branding_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();