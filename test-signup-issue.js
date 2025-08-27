const axios = require('axios');

async function testSignupIssue() {
  console.log('🔍 Testing Signup Issue...\n');
  
  const baseUrl = 'http://localhost:3001';
  
  // Test 1: Check if backend is running
  try {
    console.log('1. Checking if backend is running...');
    const response = await axios.get(`${baseUrl}/health`, {
      timeout: 5000
    });
    console.log(`✅ Backend is running: ${response.status}`);
  } catch (error) {
    console.error('❌ Backend is not running:', error.code);
    console.log('   Please start the backend server first with: npm run dev');
    return;
  }
  
  // Test 2: Test registration endpoint
  try {
    console.log('\n2. Testing registration endpoint...');
    
    const testUser = {
      phone: '+1234567890',
      firstName: 'Test',
      lastName: 'User',
      registrationMethod: 'phone_google'
    };
    
    const response = await axios.post(`${baseUrl}/api/auth/register`, testUser, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'
      }
    });
    
    console.log(`✅ Registration successful: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Registration failed:', {
      status: error.response?.status,
      message: error.response?.data?.error?.message || error.message,
      code: error.response?.data?.error?.code || error.code
    });
    
    if (error.response?.data) {
      console.log('   Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  // Test 3: Test database connection
  try {
    console.log('\n3. Testing database connection...');
    const response = await axios.get(`${baseUrl}/health/connection`, {
      timeout: 10000
    });
    
    console.log(`✅ Database connection test: ${response.status}`);
    console.log(`   Database healthy: ${response.data.data.database.healthy}`);
    console.log(`   Redis healthy: ${response.data.data.redis.healthy}`);
    
  } catch (error) {
    console.error('❌ Database connection test failed:', {
      status: error.response?.status,
      message: error.response?.data?.error?.message || error.message
    });
  }
  
  // Test 4: Check environment variables
  console.log('\n4. Environment check recommendations:');
  console.log('   Make sure these environment variables are set in backend/.env:');
  console.log('   - DATABASE_URL (PostgreSQL connection string)');
  console.log('   - REDIS_URL (Redis connection string)');
  console.log('   - JWT_SECRET (for token generation)');
  console.log('   - DEMO_MODE=true (if you want to skip some validations)');
}

testSignupIssue().catch(console.error);