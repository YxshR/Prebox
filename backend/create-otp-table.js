const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function createOTPTable() {
  try {
    console.log('🚀 Creating OTP verification table...');
    
    const sql = `
      -- Create OTP verifications table
      CREATE TABLE IF NOT EXISTS otp_verifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID,
          phone_number VARCHAR(20) NOT NULL,
          otp_code VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          is_used BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_attempt_at TIMESTAMP WITH TIME ZONE
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_otp_user_id ON otp_verifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_otp_phone_number ON otp_verifications(phone_number);
      CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_verifications(expires_at);
      CREATE INDEX IF NOT EXISTS idx_otp_is_used ON otp_verifications(is_used);
      CREATE INDEX IF NOT EXISTS idx_otp_type ON otp_verifications(type);
      CREATE INDEX IF NOT EXISTS idx_otp_phone_type ON otp_verifications(phone_number, type);
    `;
    
    await pool.query(sql);
    console.log('✅ OTP verification table created successfully!');
  } catch (error) {
    console.error('❌ OTP table creation failed:', error.message);
  } finally {
    await pool.end();
  }
}

createOTPTable();