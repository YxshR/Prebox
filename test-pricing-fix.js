const axios = require('axios');

async function testPricingEndpoints() {
  console.log('🔍 Testing Pricing Endpoints...\n');
  
  const baseUrl = 'http://localhost:3001/api';
  
  // Test 1: Check if backend is running
  try {
    console.log('1. Checking if backend is running...');
    const response = await axios.get('http://localhost:3001/health', { timeout: 5000 });
    console.log(`✅ Backend is running: ${response.status}`);
  } catch (error) {
    console.error('❌ Backend is not running:', error.code);
    console.log('   Please start the backend server first');
    return;
  }
  
  // Test 2: Check pricing validation endpoint
  try {
    console.log('\n2. Testing pricing validation endpoint...');
    const response = await axios.get(`${baseUrl}/pricing/validation/plans`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`✅ Pricing validation endpoint works: ${response.status}`);
    console.log(`   Found ${response.data.data?.plans?.length || 0} pricing plans`);
    
    if (response.data.data?.plans?.length > 0) {
      console.log('   Sample plan:', {
        id: response.data.data.plans[0].id,
        name: response.data.data.plans[0].name,
        price: response.data.data.plans[0].price
      });
    }
    
  } catch (error) {
    console.log(`⚠️ Pricing validation endpoint failed: ${error.response?.status || error.code}`);
    console.log('   Trying regular pricing endpoint...');
    
    // Test 3: Check regular pricing endpoint
    try {
      const response = await axios.get(`${baseUrl}/pricing/plans`, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log(`✅ Regular pricing endpoint works: ${response.status}`);
      console.log(`   Found ${response.data.data?.plans?.length || 0} pricing plans`);
      
      if (response.data.data?.plans?.length === 0) {
        console.log('\n💡 No pricing plans found. Attempting to seed default plans...');
        await seedDefaultPlans(baseUrl);
      }
      
    } catch (regularError) {
      console.log(`❌ Regular pricing endpoint also failed: ${regularError.response?.status || regularError.code}`);
      
      if (regularError.response?.data) {
        console.log('   Error details:', regularError.response.data);
      }
    }
  }
  
  // Test 4: Check pricing health
  try {
    console.log('\n4. Testing pricing service health...');
    const response = await axios.get(`${baseUrl}/pricing/health`, {
      timeout: 5000
    });
    
    console.log(`✅ Pricing health check: ${response.status}`);
    console.log(`   Status: ${response.data.data?.status}`);
    console.log(`   Plan count: ${response.data.data?.planCount}`);
    
  } catch (error) {
    console.log(`⚠️ Pricing health check failed: ${error.response?.status || error.code}`);
  }
  
  // Test 5: Test frontend pricing API
  try {
    console.log('\n5. Testing frontend can access pricing...');
    
    // Simulate what the frontend does
    const response = await axios.get(`${baseUrl}/pricing/validation/plans`, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log(`✅ Frontend pricing access works: ${response.status}`);
    
    if (response.data.success && response.data.data?.plans?.length > 0) {
      console.log('✅ Pricing data is available for frontend');
      console.log(`   Plans available: ${response.data.data.plans.map(p => p.name).join(', ')}`);
    } else {
      console.log('⚠️ No pricing data available for frontend');
    }
    
  } catch (error) {
    console.log(`❌ Frontend pricing access failed: ${error.response?.status || error.code}`);
    console.log('   This is why prices are not showing on the frontend');
  }
}

async function seedDefaultPlans(baseUrl) {
  try {
    // First, try to seed without authentication (if endpoint allows)
    const response = await axios.post(`${baseUrl}/pricing/seed`, {}, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Successfully seeded default pricing plans');
    return true;
    
  } catch (error) {
    console.log('⚠️ Could not seed pricing plans (may require admin authentication)');
    console.log('   You can manually create pricing plans through the admin interface');
    return false;
  }
}

async function fixPricingIssue() {
  console.log('🔧 Pricing Fix Diagnostic Tool\n');
  
  await testPricingEndpoints();
  
  console.log('\n📋 Summary and Recommendations:');
  console.log('1. Make sure the backend server is running on port 3001');
  console.log('2. Check if pricing plans exist in the database');
  console.log('3. If no plans exist, seed them using admin interface or database');
  console.log('4. Verify the frontend can access the pricing endpoints');
  console.log('5. Check browser console for any CORS or network errors');
  
  console.log('\n💡 Quick fixes:');
  console.log('- Restart backend server: npm run dev (in backend directory)');
  console.log('- Check backend logs for database connection errors');
  console.log('- Verify DEMO_MODE=true is set in backend/.env for testing');
}

fixPricingIssue().catch(console.error);