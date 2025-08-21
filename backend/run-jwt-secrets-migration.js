const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function runJWTSecretsMigration() {
  try {
    console.log('🚀 Adding per-user JWT secrets to database...');
    const sql = fs.readFileSync('src/config/migrations/001_add_user_jwt_secrets.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Per-user JWT secrets migration completed successfully!');
  } catch (error) {
    console.error('❌ JWT secrets migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runJWTSecretsMigration();