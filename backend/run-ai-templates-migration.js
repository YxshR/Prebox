const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function runAITemplatesMigration() {
  try {
    console.log('🚀 Creating AI templates tables...');
    const sql = fs.readFileSync('src/config/migrations/create_ai_templates_tables.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ AI templates tables created successfully!');
  } catch (error) {
    console.error('❌ AI templates migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runAITemplatesMigration();