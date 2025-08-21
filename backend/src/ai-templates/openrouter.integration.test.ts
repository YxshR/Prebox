import { OpenRouterProvider } from './providers/openrouter.provider';
import { AITemplateRequest } from './ai-template.types';

describe('OpenRouter Integration Test', () => {
  let provider: OpenRouterProvider;

  beforeAll(() => {
    const apiKey = process.env.OPENROUTER_API_KEY || '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';
    
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required for integration tests');
    }

    provider = new OpenRouterProvider(apiKey);
  });

  it('should generate a real template using OpenRouter API', async () => {
    const request: AITemplateRequest = {
      tenantId: 'test-tenant-integration',
      prompt: 'Create a welcome email for new users signing up for our email marketing platform',
      templateType: 'welcome',
      tone: 'friendly',
      brandName: 'EmailPro',
      industry: 'SaaS',
      targetAudience: 'Small business owners',
      callToAction: 'Start your first campaign',
      additionalContext: 'We help businesses send professional email campaigns'
    };

    console.log('🚀 Testing OpenRouter integration...');
    console.log('Request:', JSON.stringify(request, null, 2));

    const startTime = Date.now();
    
    try {
      const result = await provider.generateTemplate(request);
      const endTime = Date.now();

      console.log('✅ Template generated successfully!');
      console.log(`⏱️  Generation time: ${endTime - startTime}ms`);
      console.log('📧 Subject:', result.subject);
      console.log('🔤 Variables found:', result.variables.map(v => v.name));
      console.log('📝 HTML Content (first 200 chars):', result.htmlContent.substring(0, 200) + '...');
      console.log('📄 Text Content (first 200 chars):', result.textContent.substring(0, 200) + '...');

      // Assertions
      expect(result).toBeDefined();
      expect(result.subject).toBeTruthy();
      expect(result.htmlContent).toBeTruthy();
      expect(result.textContent).toBeTruthy();
      expect(result.variables).toBeInstanceOf(Array);
      
      // Check that HTML contains basic structure
      expect(result.htmlContent).toMatch(/<html.*?>.*<\/html>/s);
      expect(result.htmlContent).toMatch(/<body.*?>.*<\/body>/s);
      
      // Check that variables are properly formatted
      result.variables.forEach(variable => {
        expect(variable).toHaveProperty('name');
        expect(variable).toHaveProperty('type');
        expect(variable).toHaveProperty('required');
        expect(typeof variable.name).toBe('string');
        expect(typeof variable.required).toBe('boolean');
      });

      // Check that the content includes the brand name
      expect(result.htmlContent.toLowerCase()).toContain('emailpro');
      
    } catch (error) {
      console.error('❌ OpenRouter integration test failed:', error);
      throw error;
    }
  }, 30000); // 30 second timeout for API call

  it('should handle different template types', async () => {
    const request: AITemplateRequest = {
      tenantId: 'test-tenant-promotional',
      prompt: 'Create a promotional email for a 50% discount sale',
      templateType: 'promotional',
      tone: 'persuasive',
      brandName: 'ShopNow',
      callToAction: 'Shop the sale now'
    };

    console.log('🛍️  Testing promotional template generation...');

    const result = await provider.generateTemplate(request);

    expect(result).toBeDefined();
    expect(result.subject).toBeTruthy();
    expect(result.htmlContent).toBeTruthy();
    
    // Should contain promotional elements
    const content = result.htmlContent.toLowerCase();
    expect(content).toMatch(/(sale|discount|offer|deal|save)/);
    
    console.log('✅ Promotional template generated successfully!');
    console.log('📧 Subject:', result.subject);
    
  }, 30000);

  it('should extract variables correctly from generated content', async () => {
    const request: AITemplateRequest = {
      tenantId: 'test-tenant-variables',
      prompt: 'Create a personalized newsletter with customer name and company name',
      templateType: 'newsletter',
      tone: 'professional'
    };

    console.log('🔤 Testing variable extraction...');

    const result = await provider.generateTemplate(request);

    expect(result.variables).toBeDefined();
    expect(result.variables.length).toBeGreaterThan(0);
    
    // Check that common variables are marked as required
    const firstNameVar = result.variables.find(v => v.name === 'firstName');
    if (firstNameVar) {
      expect(firstNameVar.required).toBe(true);
    }

    console.log('✅ Variables extracted:', result.variables.map(v => `${v.name} (${v.required ? 'required' : 'optional'})`));
    
  }, 30000);
});