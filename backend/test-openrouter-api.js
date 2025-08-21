const axios = require('axios');

async function testOpenRouterAPI() {
  try {
    console.log('🧪 Testing OpenRouter AI Template Generation API...');
    
    const response = await axios.post('http://localhost:3001/api/ai-templates/generate', {
      prompt: 'Create a welcome email for new users signing up for our email marketing platform',
      templateType: 'welcome',
      tone: 'friendly',
      brandName: 'EmailPro',
      industry: 'SaaS',
      targetAudience: 'Small business owners',
      callToAction: 'Start your first campaign',
      additionalContext: 'We help businesses send professional email campaigns'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-token'
      }
    });

    console.log('✅ API Response Status:', response.status);
    console.log('📧 Generated Template:');
    console.log('Subject:', response.data.data?.template?.subject);
    console.log('Variables:', response.data.data?.template?.variables?.map(v => v.name));
    console.log('Generation Time:', response.data.data?.generationMetadata?.generationTime + 'ms');
    console.log('Model Used:', response.data.data?.generationMetadata?.model);
    
  } catch (error) {
    console.error('❌ API Test Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testOpenRouterAPI();