-- Initialize bulk email platform database

-- Create database if not exists (handled by Docker)
-- CREATE DATABASE IF NOT EXISTS bulk_email_platform;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE subscription_tier AS ENUM ('free', 'paid_standard', 'premium', 'enterprise');
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled');
CREATE TYPE email_event_type AS ENUM ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed');
CREATE TYPE domain_status AS ENUM ('pending', 'verified', 'failed');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'unpaid');

-- Create initial tables (basic structure)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    password_hash VARCHAR(255),
    role user_role DEFAULT 'user',
    subscription_tier subscription_tier DEFAULT 'free',
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    google_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL,
    status subscription_status DEFAULT 'active',
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 month',
    daily_email_limit INTEGER DEFAULT 100,
    monthly_recipient_limit INTEGER DEFAULT 300,
    monthly_email_limit INTEGER DEFAULT 2000,
    template_limit INTEGER DEFAULT 1,
    custom_domain_limit INTEGER DEFAULT 0,
    recharge_balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Authentication tables
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'registration', 'login', 'password_reset'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_user_id ON otp_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_phone ON otp_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);

-- Create branding_settings table for logo and branding customization
CREATE TABLE IF NOT EXISTS branding_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    logo_url TEXT,
    logo_position VARCHAR(20) DEFAULT 'header' CHECK (logo_position IN ('header', 'footer', 'sidebar')),
    primary_color VARCHAR(7) DEFAULT '#000000',
    secondary_color VARCHAR(7) DEFAULT '#ffffff',
    text_color VARCHAR(7) DEFAULT '#333333',
    font_family VARCHAR(100) DEFAULT 'Arial, sans-serif',
    custom_css TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create logo_uploads table for logo file metadata
CREATE TABLE IF NOT EXISTS logo_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    thumbnail_url TEXT,
    upload_status VARCHAR(20) DEFAULT 'pending' CHECK (upload_status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for branding tables
CREATE INDEX IF NOT EXISTS idx_branding_settings_tenant_id ON branding_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branding_settings_active ON branding_settings(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_logo_uploads_tenant_id ON logo_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_logo_uploads_status ON logo_uploads(tenant_id, upload_status);

-- Create trigger to update updated_at timestamp for branding_settings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_branding_settings_updated_at 
    BEFORE UPDATE ON branding_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default data
INSERT INTO tenants (id, name) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Default Tenant')
ON CONFLICT DO NOTHING;