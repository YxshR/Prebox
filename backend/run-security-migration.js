const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function runSecurityMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running security enhancement migrations...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Migration 1: Enhance users table with JWT secrets
    console.log('📝 Enhancing users table with JWT security...');
    const usersSql = fs.readFileSync('src/config/migrations/001_enhance_users_security.sql', 'utf8');
    await client.query(usersSql);
    console.log('✅ Users security enhancement completed');
    
    // Migration 2: Create OTP verifications table
    console.log('📝 Creating OTP verifications table...');
    const otpSql = fs.readFileSync('src/config/migrations/002_create_otp_verifications.sql', 'utf8');
    await client.query(otpSql);
    console.log('✅ OTP verifications table created');
    
    // Migration 3: Create secure pricing table
    console.log('📝 Creating secure pricing table...');
    const pricingSql = fs.readFileSync('src/config/migrations/003_create_secure_pricing.sql', 'utf8');
    await client.query(pricingSql);
    console.log('✅ Secure pricing table created');
    
    // Migration 4: Create media assets table
    console.log('📝 Creating media assets table...');
    const mediaSql = fs.readFileSync('src/config/migrations/004_create_media_assets.sql', 'utf8');
    await client.query(mediaSql);
    console.log('✅ Media assets table created');
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('🎉 All security migrations completed successfully!');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Security migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Add error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

runSecurityMigrations();