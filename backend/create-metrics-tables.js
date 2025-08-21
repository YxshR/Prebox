const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function createMetricsTables() {
  try {
    console.log('🚀 Creating metrics and alerting tables...');
    
    const sql = `
      -- Create metrics table
      CREATE TABLE IF NOT EXISTS metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          value DECIMAL(15,4) NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          tags JSONB DEFAULT '{}'::jsonb,
          type VARCHAR(20) DEFAULT 'gauge' CHECK (type IN ('counter', 'gauge', 'timer', 'histogram')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create alerts table
      CREATE TABLE IF NOT EXISTS alerts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rule_id UUID NOT NULL,
          message TEXT NOT NULL,
          severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          resolved BOOLEAN DEFAULT FALSE,
          resolved_at TIMESTAMP WITH TIME ZONE,
          metadata JSONB DEFAULT '{}'::jsonb
      );

      -- Create indexes for metrics table
      CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(name);
      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON metrics(name, timestamp);
      CREATE INDEX IF NOT EXISTS idx_metrics_tags ON metrics USING GIN(tags);

      -- Create indexes for alerts table
      CREATE INDEX IF NOT EXISTS idx_alerts_rule_id ON alerts(rule_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
      CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
      CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

      -- Add foreign key constraint for alerts
      ALTER TABLE alerts ADD CONSTRAINT fk_alerts_rule_id 
        FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE;

      -- Add comments
      COMMENT ON TABLE metrics IS 'Stores time-series metrics data';
      COMMENT ON TABLE alerts IS 'Stores alert instances triggered by alert rules';
    `;
    
    await pool.query(sql);
    console.log('✅ Metrics and alerting tables created successfully!');
    
  } catch (error) {
    console.error('❌ Metrics tables creation failed:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  createMetricsTables().catch(console.error);
}

module.exports = { createMetricsTables };