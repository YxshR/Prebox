const axios = require('axios');

/**
 * Simple test script to verify connection fixes
 */
async function testConnectionFixes() {
  const baseUrl = 'http://localhost:3001';
  
  console.log('🧪 Testing connection fixes...\n');

  // Test 1: Basic health check
  try {
    const response = await axios.get(`${baseUrl}/health`);
    console.log('✅ Basic health check passed:', response.status);
  } catch (error) {
    console.error('❌ Basic health check failed:', error.message);
  }

  // Test 2: CORS test
  try {
    const response = await axios.get(`${baseUrl}/health/cors-test`, {
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });
    console.log('✅ CORS test passed:', response.status);
  } catch (error) {
    console.error('❌ CORS test failed:', error.message);
  }

  // Test 3: Connection diagnostics
  try {
    const response = await axios.get(`${baseUrl}/health/connection`);
    console.log('✅ Connection diagnostics passed:', response.status);
    console.log('   Database:', response.data.data.database.healthy ? '✅' : '❌');
    console.log('   Redis:', response.data.data.redis.healthy ? '✅' : '❌');
  } catch (error) {
    console.error('❌ Connection diagnostics failed:', error.message);
  }

  // Test 4: Preflight request (OPTIONS)
  try {
    const response = await axios.options(`${baseUrl}/health`, {
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET'
      }
    });
    console.log('✅ Preflight request passed:', response.status);
  } catch (error) {
    console.error('❌ Preflight request failed:', error.message);
  }

  console.log('\n✨ Connection fix tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  testConnectionFixes().catch(console.error);
}

module.exports = { testConnectionFixes };