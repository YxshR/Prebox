-- Authentication System Database Schema
-- Migration 001: Create core authentication tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table with unique constraints
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    auth0_id VARCHAR(255) UNIQUE,
    phone_verified BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT users_email_or_phone_required CHECK (email IS NOT NULL OR phone IS NOT NULL),
    CONSTRAINT users_valid_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_valid_phone CHECK (phone IS NULL OR phone ~* '^\+?[1-9]\d{1,14}$')
);

-- Phone verifications table
CREATE TABLE IF NOT EXISTS phone_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT phone_verifications_valid_phone CHECK (phone ~* '^\+?[1-9]\d{1,14}$'),
    CONSTRAINT phone_verifications_valid_otp CHECK (LENGTH(otp_code) >= 4 AND LENGTH(otp_code) <= 10),
    CONSTRAINT phone_verifications_max_attempts CHECK (attempts <= 10)
);

-- Email verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    verification_code VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT email_verifications_valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Auth0 profiles table
CREATE TABLE IF NOT EXISTS auth0_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auth0_id VARCHAR(255) NOT NULL UNIQUE,
    profile_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jwt_token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Pricing plans table
CREATE TABLE IF NOT EXISTS pricing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    features JSONB NOT NULL DEFAULT '[]',
    limits JSONB NOT NULL DEFAULT '{}',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT pricing_plans_positive_price CHECK (price >= 0),
    CONSTRAINT pricing_plans_valid_currency CHECK (LENGTH(currency) = 3)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id) WHERE auth0_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_expires_at ON phone_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_created_at ON phone_verifications(created_at);

CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verifications_created_at ON email_verifications(created_at);

CREATE INDEX IF NOT EXISTS idx_auth0_profiles_user_id ON auth0_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_auth0_profiles_auth0_id ON auth0_profiles(auth0_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON user_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_pricing_plans_active ON pricing_plans(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pricing_plans_name ON pricing_plans(name);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auth0_profiles_updated_at BEFORE UPDATE ON auth0_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_plans_updated_at BEFORE UPDATE ON pricing_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default pricing plans
INSERT INTO pricing_plans (name, price, features, limits) VALUES
('Free', 0.00, '["Basic email sending", "Up to 100 contacts", "Standard templates"]', '{"contacts": 100, "emails_per_month": 1000, "templates": 5}'),
('Starter', 29.99, '["All Free features", "Up to 1,000 contacts", "Advanced templates", "Basic analytics"]', '{"contacts": 1000, "emails_per_month": 10000, "templates": 20, "analytics": true}'),
('Professional', 79.99, '["All Starter features", "Up to 10,000 contacts", "Custom templates", "Advanced analytics", "A/B testing"]', '{"contacts": 10000, "emails_per_month": 100000, "templates": -1, "analytics": true, "ab_testing": true}'),
('Enterprise', 199.99, '["All Professional features", "Unlimited contacts", "Priority support", "Custom integrations", "Dedicated account manager"]', '{"contacts": -1, "emails_per_month": -1, "templates": -1, "analytics": true, "ab_testing": true, "priority_support": true}')
ON CONFLICT DO NOTHING;