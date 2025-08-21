const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function testSecurityDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing security database setup...\n');
    
    // Test 1: Check if all security tables exist
    console.log('1️⃣ Checking security tables...');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'otp_verifications', 'secure_pricing', 'media_assets')
      ORDER BY table_name
    `;
    const tablesResult = await client.query(tablesQuery);
    console.log('   Tables found:', tablesResult.rows.map(r => r.table_name).join(', '));
    
    // Test 2: Check if users table has JWT secrets
    console.log('\n2️⃣ Checking users table structure...');
    const usersColumnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('jwt_secret', 'jwt_refresh_secret', 'phone_number', 'is_phone_verified')
      ORDER BY column_name
    `;
    const usersColumnsResult = await client.query(usersColumnsQuery);
    console.log('   Security columns:');
    usersColumnsResult.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Test 3: Check indexes
    console.log('\n3️⃣ Checking security indexes...');
    const indexesQuery = `
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE tablename IN ('users', 'otp_verifications', 'secure_pricing', 'media_assets')
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `;
    const indexesResult = await client.query(indexesQuery);
    console.log('   Security indexes:');
    indexesResult.rows.forEach(row => {
      console.log(`   - ${row.tablename}.${row.indexname}`);
    });
    
    // Test 4: Check functions
    console.log('\n4️⃣ Checking security functions...');
    const functionsQuery = `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN (
        'generate_user_jwt_secrets', 
        'validate_otp', 
        'cleanup_expired_otps',
        'generate_pricing_jwt_signature',
        'validate_pricing_signature',
        'get_secure_pricing',
        'get_media_assets_by_section'
      )
      ORDER BY routine_name
    `;
    const functionsResult = await client.query(functionsQuery);
    console.log('   Security functions:');
    functionsResult.rows.forEach(row => {
      console.log(`   - ${row.routine_name}()`);
    });
    
    // Test 5: Test JWT secret generation for existing users
    console.log('\n5️⃣ Testing JWT secret generation...');
    const userWithSecretsQuery = `
      SELECT id, 
             CASE WHEN jwt_secret IS NOT NULL THEN 'YES' ELSE 'NO' END as has_jwt_secret,
             CASE WHEN jwt_refresh_secret IS NOT NULL THEN 'YES' ELSE 'NO' END as has_refresh_secret
      FROM users 
      LIMIT 3
    `;
    const userSecretsResult = await client.query(userWithSecretsQuery);
    console.log('   User JWT secrets:');
    userSecretsResult.rows.forEach(row => {
      console.log(`   - User ${row.id.substring(0, 8)}...: JWT=${row.has_jwt_secret}, Refresh=${row.has_refresh_secret}`);
    });
    
    // Test 6: Test secure pricing data
    console.log('\n6️⃣ Testing secure pricing data...');
    const pricingQuery = `SELECT plan_id, plan_name, price_amount, currency, LENGTH(jwt_signature) as sig_length FROM secure_pricing ORDER BY display_order LIMIT 3`;
    const pricingResult = await client.query(pricingQuery);
    console.log('   Pricing plans with signatures:');
    pricingResult.rows.forEach(row => {
      console.log(`   - ${row.plan_name}: ${row.currency} ${row.price_amount} (sig: ${row.sig_length} chars)`);
    });
    
    // Test 7: Test media assets
    console.log('\n7️⃣ Testing media assets...');
    const mediaQuery = `SELECT section, asset_type, COUNT(*) as count FROM media_assets WHERE is_active = true GROUP BY section, asset_type ORDER BY section, asset_type`;
    const mediaResult = await client.query(mediaQuery);
    console.log('   Media assets by section:');
    mediaResult.rows.forEach(row => {
      console.log(`   - ${row.section}/${row.asset_type}: ${row.count} assets`);
    });
    
    // Test 8: Test OTP validation function
    console.log('\n8️⃣ Testing OTP validation function...');
    try {
      const otpTestQuery = `SELECT * FROM validate_otp('1234567890', '000000')`;
      const otpTestResult = await client.query(otpTestQuery);
      console.log('   OTP validation function works:', otpTestResult.rows[0].error_message);
    } catch (error) {
      console.log('   OTP validation function error (expected for invalid OTP):', error.message);
    }
    
    // Test 9: Test pricing signature validation
    console.log('\n9️⃣ Testing pricing signature validation...');
    const sigTestQuery = `SELECT validate_pricing_signature('free', 0.00, 'INR', 'monthly', 'invalid_signature')`;
    const sigTestResult = await client.query(sigTestQuery);
    console.log('   Pricing signature validation works:', !sigTestResult.rows[0].validate_pricing_signature ? 'YES (correctly rejected invalid signature)' : 'NO');
    
    console.log('\n✅ Security database test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Security database test failed:', error.message);
    console.error('Full error:', error);
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

testSecurityDatabase();