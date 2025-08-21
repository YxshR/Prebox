const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function createEmailVerificationTable() {
  try {
    console.log('🚀 Creating email verification table...');
    
    const sql = `
      -- Create email verifications table
      CREATE TABLE IF NOT EXISTS email_verifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          email VARCHAR(255) NOT NULL,
          token VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          is_used BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON email_verifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_verification_token ON email_verifications(token);
      CREATE INDEX IF NOT EXISTS idx_email_verification_expires_at ON email_verifications(expires_at);
      CREATE INDEX IF NOT EXISTS idx_email_verification_is_used ON email_verifications(is_used);
    `;
    
    await pool.query(sql);
    console.log('✅ Email verification table created successfully!');
  } catch (error) {
    console.error('❌ Email verification table creation failed:', error.message);
  } finally {
    await pool.end();
  }
}

createEmailVerificationTable();