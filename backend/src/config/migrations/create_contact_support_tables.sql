-- Create contact_forms table
CREATE TABLE IF NOT EXISTS contact_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    category VARCHAR(20) NOT NULL CHECK (category IN ('technical', 'billing', 'feature', 'general')),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_form_id UUID NOT NULL REFERENCES contact_forms(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'ai', 'support')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(20) NOT NULL DEFAULT 'ai' CHECK (session_type IN ('ai', 'live', 'enterprise')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'transferred')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Create support_agents table (for live chat support)
CREATE TABLE IF NOT EXISTS support_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'busy', 'offline')),
    specialties TEXT[] DEFAULT '{}',
    max_concurrent_chats INTEGER DEFAULT 5,
    current_chat_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contact_forms_tenant_id ON contact_forms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_forms_status ON contact_forms(status);
CREATE INDEX IF NOT EXISTS idx_contact_forms_priority ON contact_forms(priority);
CREATE INDEX IF NOT EXISTS idx_contact_forms_created_at ON contact_forms(created_at);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_id ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_contact_form_id ON support_tickets(contact_form_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_id ON chat_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_tenant_id ON chat_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);

CREATE INDEX IF NOT EXISTS idx_support_agents_status ON support_agents(status);
CREATE INDEX IF NOT EXISTS idx_support_agents_user_id ON support_agents(user_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contact_forms_updated_at 
    BEFORE UPDATE ON contact_forms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at 
    BEFORE UPDATE ON support_tickets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_agents_updated_at 
    BEFORE UPDATE ON support_agents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample support agents (optional)
INSERT INTO support_agents (user_id, name, email, status, specialties) VALUES
    (gen_random_uuid(), 'AI Assistant', 'ai@bulkemail.com', 'online', ARRAY['general', 'technical', 'billing']),
    (gen_random_uuid(), 'Sarah Johnson', 'sarah@bulkemail.com', 'online', ARRAY['technical', 'integration']),
    (gen_random_uuid(), 'Mike Chen', 'mike@bulkemail.com', 'online', ARRAY['billing', 'enterprise']),
    (gen_random_uuid(), 'Lisa Rodriguez', 'lisa@bulkemail.com', 'offline', ARRAY['general', 'feature'])
ON CONFLICT DO NOTHING;