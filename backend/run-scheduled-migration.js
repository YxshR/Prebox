const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function runScheduledEmailsMigration() {
  try {
    console.log('🚀 Creating scheduled_emails table...');
    const sql = fs.readFileSync('src/config/migrations/create_scheduled_emails_table.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Scheduled emails table created successfully!');
  } catch (error) {
    console.error('❌ Scheduled emails migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runScheduledEmailsMigration();