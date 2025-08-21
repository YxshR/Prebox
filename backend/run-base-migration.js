const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function runBaseSchema() {
  try {
    console.log('🚀 Creating base schema...');
    const sql = fs.readFileSync('src/config/migrations/000_create_base_schema.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Base schema created successfully!');
  } catch (error) {
    console.error('❌ Base schema creation failed:', error.message);
  } finally {
    await pool.end();
  }
}

runBaseSchema();