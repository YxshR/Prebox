const http = require('http');

/**
 * Simple connection test without requiring full compilation
 */
async function testBasicConnection() {
  console.log('🧪 Testing basic connection to backend...\n');

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/health',
    method: 'GET',
    headers: {
      'Origin': 'http://localhost:3000',
      'User-Agent': 'Connection-Test/1.0'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ Connection test passed!`);
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Headers:`, res.headers);
        console.log(`   Response:`, data);
        resolve({ status: res.statusCode, data, headers: res.headers });
      });
    });

    req.on('error', (err) => {
      console.error('❌ Connection test failed:', err.message);
      reject(err);
    });

    req.setTimeout(5000, () => {
      console.error('❌ Connection test timed out');
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

// Test CORS preflight
async function testCORSPreflight() {
  console.log('\n🧪 Testing CORS preflight...\n');

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/health',
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Content-Type'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`✅ CORS preflight test passed!`);
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   CORS Headers:`, {
        'Access-Control-Allow-Origin': res.headers['access-control-allow-origin'],
        'Access-Control-Allow-Methods': res.headers['access-control-allow-methods'],
        'Access-Control-Allow-Headers': res.headers['access-control-allow-headers']
      });
      resolve({ status: res.statusCode, headers: res.headers });
    });

    req.on('error', (err) => {
      console.error('❌ CORS preflight test failed:', err.message);
      reject(err);
    });

    req.setTimeout(5000, () => {
      console.error('❌ CORS preflight test timed out');
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

async function runTests() {
  try {
    await testBasicConnection();
    await testCORSPreflight();
    console.log('\n✨ All connection tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Connection tests failed:', error.message);
    console.log('\n💡 Make sure the backend server is running on port 3001');
    console.log('   Run: npm run dev (in the backend directory)');
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { testBasicConnection, testCORSPreflight };