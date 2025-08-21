const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function fixAuditLogsSchema() {
  try {
    console.log('🚀 Fixing audit_logs table schema...');
    
    const sql = `
      -- Add missing details column to audit_logs table
      ALTER TABLE audit_logs 
      ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

      -- Add missing id column if it doesn't exist (some versions might be missing it)
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'audit_logs' AND column_name = 'id') THEN
          ALTER TABLE audit_logs ADD COLUMN id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text;
        END IF;
      END $$;

      -- Create index on details column for better performance
      CREATE INDEX IF NOT EXISTS idx_audit_logs_details ON audit_logs USING GIN(details);

      -- Update any existing records to have empty details if null
      UPDATE audit_logs SET details = '{}'::jsonb WHERE details IS NULL;

      COMMENT ON COLUMN audit_logs.details IS 'Additional details about the audit event in JSON format';
    `;
    
    await pool.query(sql);
    console.log('✅ Audit logs schema fixed successfully!');
    
    // Test the fix by checking the table structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Current audit_logs table structure:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Failed to fix audit logs schema:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  fixAuditLogsSchema().catch(console.error);
}

module.exports = { fixAuditLogsSchema };