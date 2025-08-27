const axios = require('axios');

async function testHealthEndpoint() {
  console.log('🔍 Testing Health Endpoint Fixes...\n');
  
  const baseUrl = 'http://localhost:3001';
  
  try {
    console.log('Testing basic health check...');
    const startTime = Date.now();
    
    const response = await axios.get(`${baseUrl}/health`, {
      timeout: 5000 // 5 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Health check passed: ${response.status}`);
    console.log(`   Response time: ${responseTime}ms`);
    console.log(`   Status: ${response.data.data.status}`);
    console.log(`   Timestamp: ${response.data.data.timestamp}`);
    
    if (response.headers['x-response-time']) {
      console.log(`   Server response time: ${response.headers['x-response-time']}ms`);
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', {
      message: error.message,
      code: error.code,
      status: error.response?.status
    });
  }
  
  try {
    console.log('\nTesting API health check...');
    const startTime = Date.now();
    
    const response = await axios.get(`${baseUrl}/api/health`, {
      timeout: 5000
    });
    
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ API health check passed: ${response.status}`);
    console.log(`   Response time: ${responseTime}ms`);
    
  } catch (error) {
    console.error('❌ API health check failed:', {
      message: error.message,
      code: error.code,
      status: error.response?.status
    });
  }
  
  try {
    console.log('\nTesting CORS preflight...');
    
    const response = await axios.options(`${baseUrl}/api/health`, {
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET'
      },
      timeout: 5000
    });
    
    console.log(`✅ CORS preflight passed: ${response.status}`);
    
  } catch (error) {
    console.error('❌ CORS preflight failed:', {
      message: error.message,
      code: error.code,
      status: error.response?.status
    });
  }
}

testHealthEndpoint().catch(console.error);