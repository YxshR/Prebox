-- Create domains table
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    domain VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    dkim_key TEXT,
    verification_records JSONB DEFAULT '[]',
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, domain)
);

-- Create domain_alerts table
CREATE TABLE IF NOT EXISTS domain_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create domain_reputation table
CREATE TABLE IF NOT EXISTS domain_reputation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 100,
    factors JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create domain_monitoring_logs table
CREATE TABLE IF NOT EXISTS domain_monitoring_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    check_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    results JSONB DEFAULT '{}',
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_domains_tenant_id ON domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
CREATE INDEX IF NOT EXISTS idx_domain_alerts_domain_id ON domain_alerts(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_alerts_unresolved ON domain_alerts(domain_id, is_resolved) WHERE is_resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_domain_reputation_domain_id ON domain_reputation(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_monitoring_logs_domain_id ON domain_monitoring_logs(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_monitoring_logs_checked_at ON domain_monitoring_logs(checked_at);

-- Add updated_at trigger for domains table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_domains_updated_at 
    BEFORE UPDATE ON domains 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();