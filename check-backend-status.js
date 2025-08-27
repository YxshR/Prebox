const http = require('http');

function checkPort(port, host = 'localhost') {
  return new Promise((resolve) => {
    const req = http.request({
      host,
      port,
      method: 'GET',
      path: '/health',
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          running: true,
          status: res.statusCode,
          response: data
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        running: false,
        error: err.message,
        code: err.code
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        running: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

async function checkBackendStatus() {
  console.log('🔍 Checking Backend Status...\n');
  
  // Check if backend port is open
  console.log('1. Checking if port 3001 is open...');
  const portCheck = await checkPort(3001);
  
  if (!portCheck.running) {
    console.log('❌ Backend server is not running on port 3001');
    console.log(`   Error: ${portCheck.error}`);
    console.log(`   Code: ${portCheck.code}`);
    
    console.log('\n💡 To start the backend server:');
    console.log('   1. Open a new terminal');
    console.log('   2. Navigate to backend directory: cd backend');
    console.log('   3. Install dependencies: npm install');
    console.log('   4. Start the server: npm run dev');
    console.log('   5. Wait for "🚀 Backend server running on port 3001" message');
    
    return;
  }
  
  console.log(`✅ Backend server is running (status: ${portCheck.status})`);
  
  try {
    const response = JSON.parse(portCheck.response);
    console.log('   Response:', response);
    
    if (response.success) {
      console.log('✅ Backend health check passed');
    } else {
      console.log('⚠️ Backend is running but reports unhealthy status');
    }
  } catch (error) {
    console.log('⚠️ Backend is running but returned invalid JSON');
    console.log('   Raw response:', portCheck.response);
  }
  
  // Check frontend port too
  console.log('\n2. Checking if frontend (port 3000) is running...');
  const frontendCheck = await checkPort(3000);
  
  if (frontendCheck.running) {
    console.log('✅ Frontend server is also running');
  } else {
    console.log('❌ Frontend server is not running');
    console.log('\n💡 To start the frontend server:');
    console.log('   1. Open another terminal');
    console.log('   2. Navigate to frontend directory: cd frontend');
    console.log('   3. Install dependencies: npm install');
    console.log('   4. Start the server: npm run dev');
  }
  
  console.log('\n📋 Summary:');
  console.log(`   Backend (3001): ${portCheck.running ? '✅ Running' : '❌ Not running'}`);
  console.log(`   Frontend (3000): ${frontendCheck.running ? '✅ Running' : '❌ Not running'}`);
  
  if (portCheck.running && frontendCheck.running) {
    console.log('\n🎉 Both servers are running! You can now test signup at:');
    console.log('   http://localhost:3000/auth/register');
  }
}

checkBackendStatus().catch(console.error);