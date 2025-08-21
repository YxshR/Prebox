const OpenAI = require('openai');

async function testOpenRouter() {
  console.log('🚀 Testing OpenRouter API integration...');
  
  const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: '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',
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3001',
      'X-Title': 'Bulk Email Platform',
    },
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'openai/gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email template generator. Create professional email templates in JSON format.'
        },
        {
          role: 'user',
          content: `Generate an email template with the following requirements:

Primary Request: Create a welcome email for new customers

Template Details:
- Type: welcome
- Tone: friendly
- Brand Name: EmailPro
- Industry: SaaS
- Target Audience: Small business owners
- Call to Action: Get started today

Please include template variables using {{variableName}} syntax where appropriate (e.g., {{firstName}}, {{companyName}}).

The response should be a JSON object with the following structure:
{
  "subject": "Email subject line with variables if needed",
  "htmlContent": "Complete HTML email template with proper structure, styling, and variables",
  "textContent": "Plain text version of the email content"
}

Make sure the HTML is responsive, professional, and includes proper email-safe CSS styling.`
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error('No response from OpenRouter');
    }

    const parsedResponse = JSON.parse(response);
    
    console.log('✅ OpenRouter API test successful!');
    console.log('📧 Subject:', parsedResponse.subject);
    console.log('🔤 HTML Content (first 200 chars):', parsedResponse.htmlContent.substring(0, 200) + '...');
    console.log('📄 Text Content (first 200 chars):', parsedResponse.textContent.substring(0, 200) + '...');
    
    // Extract variables
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    const variables = new Set();
    
    let match;
    while ((match = variablePattern.exec(parsedResponse.htmlContent)) !== null) {
      variables.add(match[1]);
    }
    
    variablePattern.lastIndex = 0;
    while ((match = variablePattern.exec(parsedResponse.subject)) !== null) {
      variables.add(match[1]);
    }
    
    console.log('🔤 Variables found:', Array.from(variables));
    
    return parsedResponse;
    
  } catch (error) {
    console.error('❌ OpenRouter API test failed:', error);
    throw error;
  }
}

// Run the test
testOpenRouter()
  .then(() => {
    console.log('🎉 All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });