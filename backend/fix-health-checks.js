const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function fixHealthChecksTable() {
  try {
    console.log('🔧 Fixing health_checks table structure...');
    
    const sql = `
      -- Add missing columns to health_checks table
      ALTER TABLE health_checks 
      ADD COLUMN IF NOT EXISTS tenant_id UUID,
      ADD COLUMN IF NOT EXISTS user_id UUID,
      ADD COLUMN IF NOT EXISTS endpoint VARCHAR(255),
      ADD COLUMN IF NOT EXISTS method VARCHAR(10),
      ADD COLUMN IF NOT EXISTS status_code INTEGER,
      ADD COLUMN IF NOT EXISTS ip_address INET,
      ADD COLUMN IF NOT EXISTS user_agent TEXT;

      -- Create missing tables that alert rules are looking for
      CREATE TABLE IF NOT EXISTS api_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          endpoint VARCHAR(255) NOT NULL,
          method VARCHAR(10) NOT NULL,
          response_time_ms INTEGER NOT NULL,
          status_code INTEGER NOT NULL,
          tenant_id UUID,
          user_id UUID,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(50) NOT NULL,
          email_id VARCHAR(255),
          campaign_id UUID,
          tenant_id UUID,
          status VARCHAR(50),
          provider VARCHAR(50),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_api_requests_created_at ON api_requests(created_at);
      CREATE INDEX IF NOT EXISTS idx_api_requests_tenant_id ON api_requests(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON email_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_email_events_tenant_id ON email_events(tenant_id);
    `;
    
    await pool.query(sql);
    console.log('✅ Health checks table structure fixed!');
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    await pool.end();
  }
}

fixHealthChecksTable();