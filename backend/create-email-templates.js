const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function createEmailTemplatesTable() {
  try {
    console.log('🚀 Creating email_templates table...');
    
    const sql = `
      -- Create email_templates table
      CREATE TABLE IF NOT EXISTS email_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          subject VARCHAR(998) NOT NULL,
          html_content TEXT NOT NULL,
          text_content TEXT,
          variables JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT fk_email_templates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_email_templates_tenant_id ON email_templates(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name);
      CREATE INDEX IF NOT EXISTS idx_email_templates_created_at ON email_templates(created_at);
    `;
    
    await pool.query(sql);
    console.log('✅ Email templates table created successfully!');
  } catch (error) {
    console.error('❌ Email templates table creation failed:', error.message);
  } finally {
    await pool.end();
  }
}

createEmailTemplatesTable();