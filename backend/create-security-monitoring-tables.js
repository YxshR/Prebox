const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function createSecurityMonitoringTables() {
  try {
    console.log('🚀 Creating security monitoring tables...');
    
    const sql = `
      -- Create threat_alerts table
      CREATE TABLE IF NOT EXISTS threat_alerts (
          id VARCHAR(64) PRIMARY KEY,
          tenant_id UUID NOT NULL,
          user_id UUID,
          threat_type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
          description TEXT NOT NULL,
          ip_address INET,
          user_agent TEXT,
          details JSONB DEFAULT '{}'::jsonb,
          status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP WITH TIME ZONE
      );

      -- Create blocked_ips table
      CREATE TABLE IF NOT EXISTS blocked_ips (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ip_address INET NOT NULL UNIQUE,
          reason VARCHAR(100) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create throttled_api_keys table
      CREATE TABLE IF NOT EXISTS throttled_api_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          api_key_id UUID NOT NULL UNIQUE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create blocked_user_pricing table
      CREATE TABLE IF NOT EXISTS blocked_user_pricing (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL UNIQUE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create security_events table
      CREATE TABLE IF NOT EXISTS security_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          user_id UUID,
          event_type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
          description TEXT NOT NULL,
          ip_address INET,
          user_agent TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create audit_logs table (if not exists)
      CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          user_id UUID,
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(50),
          resource_id VARCHAR(255),
          ip_address INET,
          user_agent TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create performance_metrics table (if not exists)
      CREATE TABLE IF NOT EXISTS performance_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          endpoint VARCHAR(255) NOT NULL,
          method VARCHAR(10) NOT NULL,
          status_code INTEGER NOT NULL,
          response_time INTEGER NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          user_id UUID,
          tenant_id UUID,
          error_message TEXT
      );

      -- Create business_metrics table (if not exists)
      CREATE TABLE IF NOT EXISTS business_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          value DECIMAL(15,4) NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          tenant_id UUID,
          user_id UUID,
          metadata JSONB DEFAULT '{}'::jsonb
      );

      -- Create error_events table (if not exists)
      CREATE TABLE IF NOT EXISTS error_events (
          id VARCHAR(64) PRIMARY KEY,
          message TEXT NOT NULL,
          stack TEXT,
          level VARCHAR(20) NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          user_id UUID,
          tenant_id UUID,
          endpoint VARCHAR(255),
          method VARCHAR(10),
          metadata JSONB DEFAULT '{}'::jsonb
      );

      -- Create campaigns table (if not exists for quarantine functionality)
      CREATE TABLE IF NOT EXISTS campaigns (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          user_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'quarantined')),
          quarantine_reason VARCHAR(100),
          quarantined_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_threat_alerts_tenant_id ON threat_alerts(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_threat_alerts_status ON threat_alerts(status);
      CREATE INDEX IF NOT EXISTS idx_threat_alerts_created_at ON threat_alerts(created_at);
      CREATE INDEX IF NOT EXISTS idx_threat_alerts_severity ON threat_alerts(severity);

      CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
      CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires_at ON blocked_ips(expires_at);

      CREATE INDEX IF NOT EXISTS idx_throttled_api_keys_api_key_id ON throttled_api_keys(api_key_id);
      CREATE INDEX IF NOT EXISTS idx_throttled_api_keys_expires_at ON throttled_api_keys(expires_at);

      CREATE INDEX IF NOT EXISTS idx_blocked_user_pricing_user_id ON blocked_user_pricing(user_id);
      CREATE INDEX IF NOT EXISTS idx_blocked_user_pricing_expires_at ON blocked_user_pricing(expires_at);

      CREATE INDEX IF NOT EXISTS idx_security_events_tenant_id ON security_events(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

      CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

      CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint ON performance_metrics(endpoint);
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_tenant_id ON performance_metrics(tenant_id);

      CREATE INDEX IF NOT EXISTS idx_business_metrics_name ON business_metrics(name);
      CREATE INDEX IF NOT EXISTS idx_business_metrics_timestamp ON business_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_business_metrics_tenant_id ON business_metrics(tenant_id);

      CREATE INDEX IF NOT EXISTS idx_error_events_timestamp ON error_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_error_events_level ON error_events(level);
      CREATE INDEX IF NOT EXISTS idx_error_events_tenant_id ON error_events(tenant_id);

      CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_quarantined_at ON campaigns(quarantined_at);

      -- Add comments for documentation
      COMMENT ON TABLE threat_alerts IS 'Stores security threat alerts and their status';
      COMMENT ON TABLE blocked_ips IS 'Stores temporarily blocked IP addresses';
      COMMENT ON TABLE throttled_api_keys IS 'Stores temporarily throttled API keys';
      COMMENT ON TABLE blocked_user_pricing IS 'Stores users temporarily blocked from pricing access';
      COMMENT ON TABLE security_events IS 'Stores security-related events for monitoring';
      COMMENT ON TABLE audit_logs IS 'Stores audit trail of user actions';
      COMMENT ON TABLE performance_metrics IS 'Stores API performance metrics';
      COMMENT ON TABLE business_metrics IS 'Stores business-related metrics';
      COMMENT ON TABLE error_events IS 'Stores application error events';
    `;
    
    await pool.query(sql);
    console.log('✅ Security monitoring tables created successfully!');
    
    // Test the connection to ensure everything is working
    const testResult = await pool.query('SELECT COUNT(*) FROM threat_alerts');
    console.log('✅ Security monitoring database connection test passed');
    
  } catch (error) {
    console.error('❌ Security monitoring tables creation failed:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  createSecurityMonitoringTables().catch(console.error);
}

module.exports = { createSecurityMonitoringTables };