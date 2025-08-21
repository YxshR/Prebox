const https = require('https');
const http = require('http');

function testAPI() {
  const postData = JSON.stringify({
    prompt: 'Create a welcome email for new users signing up for our email marketing platform',
    templateType: 'welcome',
    tone: 'friendly',
    brandName: 'EmailPro',
    industry: 'SaaS',
    targetAudience: 'Small business owners',
    callToAction: 'Start your first campaign'
  });

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/ai-templates/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer demo-token',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('🧪 Testing OpenRouter AI Template Generation API...');

  const req = http.request(options, (res) => {
    console.log(`✅ Status Code: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('📧 API Response:');
        console.log('Success:', response.success);
        
        if (response.success && response.data) {
          console.log('Subject:', response.data.template?.subject);
          console.log('Variables:', response.data.template?.variables?.map(v => v.name));
          console.log('Generation Time:', response.data.generationMetadata?.generationTime + 'ms');
          console.log('Model Used:', response.data.generationMetadata?.model);
        } else {
          console.log('Error:', response.error);
        }
      } catch (error) {
        console.error('❌ Failed to parse response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
  });

  req.write(postData);
  req.end();
}

testAPI();