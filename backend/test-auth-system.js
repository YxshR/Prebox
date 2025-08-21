const http = require('http');

function testAuthEndpoints() {
  console.log('🧪 Testing Authentication System...');
  
  // Test 1: Register a new user
  const registerData = JSON.stringify({
    email: 'test@example.com',
    password: 'testpassword123',
    phone: '+919876543210',
    firstName: 'Test',
    lastName: 'User',
    registrationMethod: 'phone_google'
  });

  const registerOptions = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(registerData)
    }
  };

  console.log('📝 Testing user registration...');

  const registerReq = http.request(registerOptions, (res) => {
    console.log(`✅ Registration Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('📧 Registration Response:');
        console.log('Success:', response.success);
        
        if (response.success) {
          console.log('User ID:', response.data.user.id);
          console.log('Email Verified:', response.data.user.isEmailVerified);
          console.log('Phone Verified:', response.data.user.isPhoneVerified);
          console.log('OTP ID:', response.data.otpId);
          
          if (response.data.otpId) {
            console.log('📱 Phone verification OTP should be sent to +919876543210');
            console.log('🎯 Check your phone for the OTP code!');
          }
        } else {
          console.log('Error:', response.error);
        }
      } catch (error) {
        console.error('❌ Failed to parse registration response:', data);
      }
    });
  });

  registerReq.on('error', (error) => {
    console.error('❌ Registration request failed:', error.message);
  });

  registerReq.write(registerData);
  registerReq.end();

  // Test 2: Check Google OAuth endpoint
  setTimeout(() => {
    console.log('\n🔍 Testing Google OAuth endpoint...');
    
    const googleOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/google',
      method: 'GET'
    };

    const googleReq = http.request(googleOptions, (res) => {
      console.log(`✅ Google OAuth Status: ${res.statusCode}`);
      
      if (res.statusCode === 302) {
        console.log('🔗 Google OAuth redirect working - should redirect to Google');
        console.log('Location:', res.headers.location);
      }
    });

    googleReq.on('error', (error) => {
      console.error('❌ Google OAuth request failed:', error.message);
    });

    googleReq.end();
  }, 2000);
}

testAuthEndpoints();