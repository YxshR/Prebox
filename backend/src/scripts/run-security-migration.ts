import fs from 'fs';
import path from 'path';
import pool from '../config/database';

async function runSecurityMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔒 Running security and compliance migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../config/migrations/create_security_compliance_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Security and compliance tables created successfully');
    
    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'audit_logs', 'threat_alerts', 'blocked_ips', 'throttled_api_keys',
        'gdpr_data_export_requests', 'gdpr_data_deletion_requests', 
        'gdpr_consent_records', 'security_configurations', 'encryption_keys',
        'security_events_summary'
      )
      ORDER BY table_name
    `);
    
    console.log('📋 Created tables:', result.rows.map(row => row.table_name));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  runSecurityMigration()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { runSecurityMigration };