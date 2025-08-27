const axios = require('axios');

const demoPlans = [
  {
    name: 'Free',
    price: 0,
    currency: 'USD',
    features: [
      'Up to 1,000 emails/month',
      'Basic templates',
      'Email analytics',
      'Contact management'
    ],
    limits: {
      emailsPerMonth: 1000,
      contacts: 100,
      templates: 5
    },
    active: true
  },
  {
    name: 'Starter',
    price: 29,
    currency: 'USD',
    features: [
      'Up to 10,000 emails/month',
      'Advanced templates',
      'A/B testing',
      'Priority support',
      'Custom branding'
    ],
    limits: {
      emailsPerMonth: 10000,
      contacts: 1000,
      templates: 25
    },
    active: true
  },
  {
    name: 'Professional',
    price: 79,
    currency: 'USD',
    features: [
      'Up to 50,000 emails/month',
      'Advanced analytics',
      'Automation workflows',
      'API access',
      'White-label options'
    ],
    limits: {
      emailsPerMonth: 50000,
      contacts: 10000,
      templates: 100
    },
    active: true
  },
  {
    name: 'Enterprise',
    price: 199,
    currency: 'USD',
    features: [
      'Unlimited emails',
      'Custom integrations',
      'Dedicated support',
      'Advanced security',
      'Custom features'
    ],
    limits: {
      emailsPerMonth: -1,
      contacts: -1,
      templates: -1
    },
    active: true
  }
];

async function seedDemoPricing() {
  console.log('🌱 Seeding Demo Pricing Data...\n');
  
  const baseUrl = 'http://localhost:3001/api';
  
  // Check if backend is running
  try {
    await axios.get('http://localhost:3001/health', { timeout: 5000 });
    console.log('✅ Backend is running');
  } catch (error) {
    console.error('❌ Backend is not running. Please start it first.');
    return;
  }
  
  // Check if plans already exist
  try {
    const response = await axios.get(`${baseUrl}/pricing/plans`);
    if (response.data.data?.plans?.length > 0) {
      console.log(`ℹ️ Found ${response.data.data.plans.length} existing pricing plans:`);
      response.data.data.plans.forEach(plan => {
        console.log(`   - ${plan.name}: $${plan.price}`);
      });
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Do you want to continue and add more plans? (y/N): ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('Skipping seed operation.');
        return;
      }
    }
  } catch (error) {
    console.log('No existing plans found, proceeding with seed...');
  }
  
  // Try to seed using the seed endpoint first
  try {
    console.log('Attempting to use seed endpoint...');
    const response = await axios.post(`${baseUrl}/pricing/seed`, {});
    console.log('✅ Successfully seeded using seed endpoint');
    return;
  } catch (error) {
    console.log('⚠️ Seed endpoint failed (may require admin auth), trying manual creation...');
  }
  
  // Manually create each plan
  let successCount = 0;
  let errorCount = 0;
  
  for (const plan of demoPlans) {
    try {
      console.log(`Creating plan: ${plan.name}...`);
      
      const response = await axios.post(`${baseUrl}/pricing/plans`, plan, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      console.log(`✅ Created ${plan.name} plan (ID: ${response.data.data?.plan?.id})`);
      successCount++;
      
    } catch (error) {
      console.log(`❌ Failed to create ${plan.name} plan:`, error.response?.data?.error?.message || error.message);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Results:`);
  console.log(`   ✅ Successfully created: ${successCount} plans`);
  console.log(`   ❌ Failed to create: ${errorCount} plans`);
  
  if (successCount > 0) {
    console.log('\n🎉 Pricing data has been seeded! You should now see prices on the frontend.');
    console.log('   Refresh your browser to see the updated pricing.');
  } else {
    console.log('\n⚠️ No plans were created. This might be because:');
    console.log('   1. The endpoint requires admin authentication');
    console.log('   2. There are database connection issues');
    console.log('   3. The pricing table doesn\'t exist');
    console.log('\n💡 Try enabling DEMO_MODE=true in backend/.env for testing');
  }
  
  // Test the final result
  try {
    console.log('\n🔍 Testing final pricing availability...');
    const response = await axios.get(`${baseUrl}/pricing/validation/plans`);
    
    if (response.data.success && response.data.data?.plans?.length > 0) {
      console.log('✅ Pricing validation endpoint now returns data');
      console.log(`   Available plans: ${response.data.data.plans.map(p => p.name).join(', ')}`);
    } else {
      console.log('⚠️ Pricing validation endpoint still returns no data');
    }
  } catch (error) {
    console.log('❌ Could not test pricing validation endpoint');
  }
}

seedDemoPricing().catch(console.error);