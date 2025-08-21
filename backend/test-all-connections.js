const { Pool } = require('pg');
const { createClient } = require('redis');
const axios = require('axios');
require('dotenv').config();

async function testAllConnections() {
  console.log('🧪 Testing All Service Connections...\n');
  
  const results = {
    database: false,
    redis: false,
    sendgrid: false,
    openrouter: false,
    gemini: false,
    twilio: false,
    razorpay: false
  };

  // 1. Test PostgreSQL Database
  console.log('1️⃣ Testing PostgreSQL Database...');
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
    });
    
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database: Connected successfully');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    results.database = true;
    await pool.end();
  } catch (error) {
    console.error('❌ Database: Connection failed -', error.message);
  }

  // 2. Test Redis
  console.log('\n2️⃣ Testing Redis...');
  try {
    const redis = createClient({
      url: process.env.REDIS_URL
    });
    
    await redis.connect();
    await redis.set('test_key', 'test_value');
    const value = await redis.get('test_key');
    await redis.del('test_key');
    await redis.quit();
    
    console.log('✅ Redis: Connected successfully');
    console.log(`   Test value: ${value}`);
    results.redis = true;
  } catch (error) {
    console.error('❌ Redis: Connection failed -', error.message);
  }

  // 3. Test SendGrid
  console.log('\n3️⃣ Testing SendGrid...');
  try {
    const response = await axios.get('https://api.sendgrid.com/v3/user/profile', {
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`
      }
    });
    
    console.log('✅ SendGrid: API key valid');
    console.log(`   Account: ${response.data.username}`);
    results.sendgrid = true;
  } catch (error) {
    console.error('❌ SendGrid: API test failed -', error.response?.data?.errors?.[0]?.message || error.message);
  }

  // 4. Test OpenRouter
  console.log('\n4️⃣ Testing OpenRouter...');
  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'openai/gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL,
        'X-Title': process.env.OPENROUTER_SITE_NAME
      }
    });
    
    console.log('✅ OpenRouter: API key valid');
    console.log(`   Response: ${response.data.choices[0].message.content}`);
    results.openrouter = true;
  } catch (error) {
    console.error('❌ OpenRouter: API test failed -', error.response?.data?.error?.message || error.message);
  }

  // 5. Test Gemini
  console.log('\n5️⃣ Testing Gemini...');
  try {
    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{
        parts: [{ text: 'Hello' }]
      }]
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Gemini: API key valid');
    console.log(`   Response: ${response.data.candidates[0].content.parts[0].text.substring(0, 50)}...`);
    results.gemini = true;
  } catch (error) {
    console.error('❌ Gemini: API test failed -', error.response?.data?.error?.message || error.message);
  }

  // 6. Test Twilio
  console.log('\n6️⃣ Testing Twilio...');
  try {
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const response = await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    console.log('✅ Twilio: Credentials valid');
    console.log(`   Account: ${response.data.friendly_name}`);
    results.twilio = true;
  } catch (error) {
    console.error('❌ Twilio: API test failed -', error.response?.data?.message || error.message);
  }

  // 7. Test Razorpay
  console.log('\n7️⃣ Testing Razorpay...');
  try {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await axios.get('https://api.razorpay.com/v1/payments', {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    console.log('✅ Razorpay: Credentials valid');
    console.log(`   API accessible`);
    results.razorpay = true;
  } catch (error) {
    console.error('❌ Razorpay: API test failed -', error.response?.data?.error?.description || error.message);
  }

  // Summary
  console.log('\n📊 Connection Test Summary:');
  console.log('================================');
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  
  Object.entries(results).forEach(([service, status]) => {
    console.log(`${status ? '✅' : '❌'} ${service.toUpperCase()}: ${status ? 'CONNECTED' : 'FAILED'}`);
  });
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} services connected (${Math.round(passedTests/totalTests*100)}%)`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All services are ready for production!');
  } else {
    console.log('⚠️  Some services need attention before production deployment.');
  }
}

testAllConnections().catch(console.error);