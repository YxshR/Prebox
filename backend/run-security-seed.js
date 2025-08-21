const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function runSecuritySeeds() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Seeding secure pricing data...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Seed secure pricing data
    console.log('📝 Inserting secure pricing plans...');
    const pricingSeedSql = fs.readFileSync('src/config/seeds/secure_pricing_seed.sql', 'utf8');
    await client.query(pricingSeedSql);
    console.log('✅ Secure pricing data seeded successfully');
    
    // Seed media assets data
    console.log('📝 Inserting media assets...');
    const mediaSeedSql = fs.readFileSync('src/config/seeds/media_assets_seed.sql', 'utf8');
    await client.query(mediaSeedSql);
    console.log('✅ Media assets data seeded successfully');
    
    // Verify the data was inserted correctly
    const pricingResult = await client.query('SELECT plan_id, plan_name, price_amount, currency FROM secure_pricing ORDER BY display_order');
    console.log('📊 Inserted pricing plans:');
    pricingResult.rows.forEach(row => {
      console.log(`  - ${row.plan_name}: ${row.currency} ${row.price_amount}`);
    });
    
    const mediaResult = await client.query('SELECT section, COUNT(*) as count FROM media_assets WHERE is_active = true GROUP BY section ORDER BY section');
    console.log('📊 Inserted media assets:');
    mediaResult.rows.forEach(row => {
      console.log(`  - ${row.section}: ${row.count} assets`);
    });
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('🎉 Security seed data completed successfully!');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Security seed failed:', error.message);
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

runSecuritySeeds();