const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function createMonitoringTables() {
  try {
    console.log('🚀 Creating monitoring and health check tables...');
    
    const sql = `
      -- Create health_checks table
      CREATE TABLE IF NOT EXISTS health_checks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          service_name VARCHAR(100) NOT NULL,
          status VARCHAR(20) NOT NULL,
          response_time_ms INTEGER,
          error_message TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create alert_rules table
      CREATE TABLE IF NOT EXISTS alert_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          metric VARCHAR(100) NOT NULL,
          condition VARCHAR(50) NOT NULL,
          threshold DECIMAL(10,4) NOT NULL,
          time_window INTEGER DEFAULT 5,
          severity VARCHAR(20) DEFAULT 'medium',
          enabled BOOLEAN DEFAULT true,
          channels JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create system_metrics table
      CREATE TABLE IF NOT EXISTS system_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          metric_name VARCHAR(100) NOT NULL,
          metric_value DECIMAL(15,4) NOT NULL,
          metric_type VARCHAR(50) DEFAULT 'gauge',
          tags JSONB DEFAULT '{}'::jsonb,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create performance_logs table
      CREATE TABLE IF NOT EXISTS performance_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          endpoint VARCHAR(255) NOT NULL,
          method VARCHAR(10) NOT NULL,
          response_time_ms INTEGER NOT NULL,
          status_code INTEGER NOT NULL,
          user_id UUID,
          tenant_id UUID,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks(service_name);
      CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status);
      CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON health_checks(checked_at);

      CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
      CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules(metric);

      CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
      CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON system_metrics(recorded_at);

      CREATE INDEX IF NOT EXISTS idx_performance_logs_endpoint ON performance_logs(endpoint);
      CREATE INDEX IF NOT EXISTS idx_performance_logs_created_at ON performance_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_performance_logs_tenant_id ON performance_logs(tenant_id);

      -- Insert default alert rules
      INSERT INTO alert_rules (name, metric, condition, threshold, severity, channels) VALUES
      ('High Error Rate', 'performance:error_rate', 'greater_than', 0.05, 'high', '[{"type":"email","config":{"email":"alerts@bulkemail.com"}}]'::jsonb),
      ('High Response Time', 'performance:avg_response_time', 'greater_than', 2000, 'medium', '[{"type":"email","config":{"email":"alerts@bulkemail.com"}}]'::jsonb),
      ('Low Database Health', 'health:database', 'less_than', 1, 'critical', '[{"type":"email","config":{"email":"alerts@bulkemail.com"}}]'::jsonb)
      ON CONFLICT DO NOTHING;

      COMMENT ON TABLE health_checks IS 'Stores health check results for various system services';
      COMMENT ON TABLE alert_rules IS 'Defines alerting rules for system monitoring';
      COMMENT ON TABLE system_metrics IS 'Stores system performance and business metrics';
      COMMENT ON TABLE performance_logs IS 'Logs API endpoint performance data';
    `;
    
    await pool.query(sql);
    console.log('✅ Monitoring tables created successfully!');
  } catch (error) {
    console.error('❌ Monitoring tables creation failed:', error.message);
  } finally {
    await pool.end();
  }
}

createMonitoringTables();