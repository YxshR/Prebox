const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function createGDPRTables() {
  try {
    console.log('🚀 Creating GDPR compliance tables...');
    
    const sql = `
      -- Create GDPR data export requests table
      CREATE TABLE IF NOT EXISTS gdpr_data_export_requests (
          id VARCHAR(64) PRIMARY KEY,
          user_id UUID NOT NULL,
          tenant_id UUID NOT NULL,
          requested_by UUID NOT NULL,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          processing_started_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          download_url TEXT,
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create GDPR data deletion requests table
      CREATE TABLE IF NOT EXISTS gdpr_data_deletion_requests (
          id VARCHAR(64) PRIMARY KEY,
          user_id UUID NOT NULL,
          tenant_id UUID NOT NULL,
          requested_by UUID NOT NULL,
          retention_period_days INTEGER NOT NULL DEFAULT 30,
          scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
          status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('pending', 'scheduled', 'completed', 'failed')),
          completed_at TIMESTAMP WITH TIME ZONE,
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create GDPR consent records table
      CREATE TABLE IF NOT EXISTS gdpr_consent_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          tenant_id UUID NOT NULL,
          consent_type VARCHAR(20) NOT NULL CHECK (consent_type IN ('marketing', 'analytics', 'functional', 'necessary')),
          granted BOOLEAN NOT NULL,
          granted_at TIMESTAMP WITH TIME ZONE,
          revoked_at TIMESTAMP WITH TIME ZONE,
          ip_address INET,
          user_agent TEXT,
          version VARCHAR(10) NOT NULL DEFAULT '1.0',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_user_id ON gdpr_data_export_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_tenant_id ON gdpr_data_export_requests(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_status ON gdpr_data_export_requests(status);
      CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_created_at ON gdpr_data_export_requests(created_at);

      CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_user_id ON gdpr_data_deletion_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_tenant_id ON gdpr_data_deletion_requests(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_status ON gdpr_data_deletion_requests(status);
      CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_scheduled_at ON gdpr_data_deletion_requests(scheduled_at);

      CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_user_id ON gdpr_consent_records(user_id);
      CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_tenant_id ON gdpr_consent_records(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_consent_type ON gdpr_consent_records(consent_type);
      CREATE INDEX IF NOT EXISTS idx_gdpr_consent_records_created_at ON gdpr_consent_records(created_at);

      -- Add foreign key constraints (if users table exists)
      DO $$ 
      BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
              ALTER TABLE gdpr_data_export_requests 
              ADD CONSTRAINT fk_gdpr_export_user_id 
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
              
              ALTER TABLE gdpr_data_export_requests 
              ADD CONSTRAINT fk_gdpr_export_requested_by 
              FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE;
              
              ALTER TABLE gdpr_data_deletion_requests 
              ADD CONSTRAINT fk_gdpr_deletion_user_id 
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
              
              ALTER TABLE gdpr_data_deletion_requests 
              ADD CONSTRAINT fk_gdpr_deletion_requested_by 
              FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE;
              
              ALTER TABLE gdpr_consent_records 
              ADD CONSTRAINT fk_gdpr_consent_user_id 
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
          END IF;
      EXCEPTION
          WHEN duplicate_object THEN
              -- Constraints already exist, ignore
              NULL;
      END $$;

      -- Add comments for documentation
      COMMENT ON TABLE gdpr_data_export_requests IS 'Stores GDPR data export requests (Right to Data Portability)';
      COMMENT ON TABLE gdpr_data_deletion_requests IS 'Stores GDPR data deletion requests (Right to Erasure)';
      COMMENT ON TABLE gdpr_consent_records IS 'Stores user consent records for GDPR compliance';
    `;
    
    await pool.query(sql);
    console.log('✅ GDPR compliance tables created successfully!');
    
    // Test the connection
    const testResult = await pool.query('SELECT COUNT(*) FROM gdpr_consent_records');
    console.log('✅ GDPR database connection test passed');
    
  } catch (error) {
    console.error('❌ GDPR tables creation failed:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  createGDPRTables().catch(console.error);
}

module.exports = { createGDPRTables };