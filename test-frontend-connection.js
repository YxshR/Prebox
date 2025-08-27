const axios = require('axios');

async function testFrontendConnection() {
  console.log('🔍 Testing Frontend Connection to Backend...\n');
  
  const frontendUrl = 'http://localhost:3000';
  const backendUrl = 'http://localhost:3001';
  
  // Test 1: Direct backend health check
  try {
    console.log('1. Testing direct backend health check...');
    const response = await axios.get(`${backendUrl}/api/health`, {
      timeout: 10000,
      headers: {
        'Origin': frontendUrl,
        'User-Agent': 'Frontend-Test'
      }
    });
    
    console.log(`✅ Direct backend health: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
    
  } catch (error) {
    console.error('❌ Direct backend health failed:', {
      message: error.message,
      code: error.code,
      status: error.response?.status
    });
  }
  
  // Test 2: Frontend health check (through Next.js API route)
  try {
    console.log('\n2. Testing frontend health check...');
    const response = await axios.get(`${frontendUrl}/api/health`, {
      timeout: 10000
    });
    
    console.log(`✅ Frontend health: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
    
  } catch (error) {
    console.error('❌ Frontend health failed:', {
      message: error.message,
      code: error.code,
      status: error.response?.status
    });
  }
  
  // Test 3: CORS test
  try {
    console.log('\n3. Testing CORS configuration...');
    const response = await axios.get(`${backendUrl}/health/cors-test`, {
      timeout: 5000,
      headers: {
        'Origin': frontendUrl
      }
    });
    
    console.log(`✅ CORS test: ${response.status}`);
    console.log(`   CORS headers:`, {
      'access-control-allow-origin': response.headers['access-control-allow-origin'],
      'access-control-allow-credentials': response.headers['access-control-allow-credentials']
    });
    
  } catch (error) {
    console.error('❌ CORS test failed:', {
      message: error.message,
      code: error.code,
      status: error.response?.status
    });
  }
  
  // Test 4: Connection timing
  console.log('\n4. Testing connection timing (5 requests)...');
  const times = [];
  
  for (let i = 1; i <= 5; i++) {
    try {
      const startTime = Date.now();
      await axios.get(`${backendUrl}/api/health`, {
        timeout: 5000,
        headers: { 'Origin': frontendUrl }
      });
      const responseTime = Date.now() - startTime;
      times.push(responseTime);
      console.log(`   Request ${i}: ${responseTime}ms`);
    } catch (error) {
      console.log(`   Request ${i}: FAILED (${error.message})`);
    }
  }
  
  if (times.length > 0) {
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    console.log(`\n📊 Timing Summary:`);
    console.log(`   Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   Min: ${minTime}ms`);
    console.log(`   Max: ${maxTime}ms`);
    console.log(`   Success rate: ${times.length}/5 (${(times.length/5*100).toFixed(1)}%)`);
  }
}

testFrontendConnection().catch(console.error);