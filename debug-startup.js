const { spawn } = require('child_process');
const axios = require('axios');

async function checkBackendHealth() {
  try {
    const response = await axios.get('http://localhost:3001/health', { timeout: 5000 });
    return { healthy: true, status: response.status };
  } catch (error) {
    return { healthy: false, error: error.code || error.message };
  }
}

async function testRegistration() {
  try {
    const testUser = {
      phone: '+1234567890',
      firstName: 'Test',
      lastName: 'User',
      registrationMethod: 'phone_google'
    };
    
    const response = await axios.post('http://localhost:3001/api/auth/register', testUser, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status 
    };
  }
}

async function debugStartup() {
  console.log('🔍 Debugging Startup Issues...\n');
  
  // Check if backend is running
  console.log('1. Checking backend health...');
  const health = await checkBackendHealth();
  
  if (!health.healthy) {
    console.log('❌ Backend is not running or unhealthy');
    console.log(`   Error: ${health.error}`);
    console.log('\n💡 To fix this:');
    console.log('   1. Make sure you\'re in the backend directory: cd backend');
    console.log('   2. Install dependencies: npm install');
    console.log('   3. Start the server: npm run dev');
    console.log('   4. Check the terminal for any error messages');
    return;
  }
  
  console.log(`✅ Backend is healthy (status: ${health.status})`);
  
  // Test registration
  console.log('\n2. Testing registration...');
  const regResult = await testRegistration();
  
  if (regResult.success) {
    console.log('✅ Registration works!');
    console.log('   Response:', JSON.stringify(regResult.data, null, 2));
  } else {
    console.log('❌ Registration failed');
    console.log(`   Status: ${regResult.status}`);
    console.log('   Error:', JSON.stringify(regResult.error, null, 2));
    
    console.log('\n💡 Common fixes:');
    console.log('   1. Check if DEMO_MODE=true is set in backend/.env');
    console.log('   2. Make sure database connection is working');
    console.log('   3. Check backend terminal for error messages');
    console.log('   4. Verify all required environment variables are set');
  }
  
  // Additional checks
  console.log('\n3. Additional system checks...');
  
  try {
    const dbHealth = await axios.get('http://localhost:3001/health/connection', { timeout: 5000 });
    console.log('✅ Database connection test passed');
    console.log(`   Database: ${dbHealth.data.data.database.healthy ? '✅' : '❌'}`);
    console.log(`   Redis: ${dbHealth.data.data.redis.healthy ? '✅' : '❌'}`);
  } catch (error) {
    console.log('❌ Database connection test failed');
    console.log('   This might be causing registration issues');
  }
}

debugStartup().catch(console.error);