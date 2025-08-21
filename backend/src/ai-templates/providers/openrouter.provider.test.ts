import { OpenRouterProvider } from './openrouter.provider';
import { AITemplateRequest } from '../ai-template.types';

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider;
  const mockApiKey = 'sk-or-v1-test-key';

  beforeEach(() => {
    // Set environment variables for testing
    process.env.OPENROUTER_SITE_URL = 'http://localhost:3001';
    process.env.OPENROUTER_SITE_NAME = 'Bulk Email Platform Test';
    
    provider = new OpenRouterProvider(mockApiKey);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(provider.name).toBe('OpenRouter');
    });

    it('should use default model if not specified', () => {
      const defaultProvider = new OpenRouterProvider(mockApiKey);
      expect(defaultProvider.name).toBe('OpenRouter');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        model: 'openai/gpt-3.5-turbo',
        maxTokens: 1500,
        temperature: 0.5
      };
      
      const customProvider = new OpenRouterProvider(mockApiKey, customConfig);
      expect(customProvider.name).toBe('OpenRouter');
    });
  });

  describe('generateTemplate', () => {
    const mockRequest: AITemplateRequest = {
      tenantId: 'test-tenant',
      prompt: 'Create a welcome email for new customers',
      templateType: 'welcome',
      tone: 'friendly',
      brandName: 'Test Company',
      industry: 'SaaS',
      targetAudience: 'Small business owners',
      callToAction: 'Get started today'
    };

    it('should handle successful template generation', async () => {
      // Mock the OpenAI client response
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              subject: 'Welcome to {{companyName}}, {{firstName}}!',
              htmlContent: '<html><body><h1>Welcome {{firstName}}!</h1><p>Thank you for joining {{companyName}}.</p><a href="{{ctaUrl}}">Get Started</a></body></html>',
              textContent: 'Welcome {{firstName}}! Thank you for joining {{companyName}}. Get Started: {{ctaUrl}}'
            })
          }
        }]
      };

      // Mock the client.chat.completions.create method
      jest.spyOn(provider['client'].chat.completions, 'create').mockResolvedValue(mockResponse as any);

      const result = await provider.generateTemplate(mockRequest);

      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('htmlContent');
      expect(result).toHaveProperty('textContent');
      expect(result).toHaveProperty('variables');
      expect(result.subject).toBe('Welcome to {{companyName}}, {{firstName}}!');
      expect(result.variables).toHaveLength(3); // firstName, companyName, ctaUrl
    });

    it('should extract variables correctly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              subject: 'Hello {{firstName}} from {{companyName}}',
              htmlContent: '<html><body><p>Dear {{firstName}},</p><p>Welcome to {{companyName}}!</p></body></html>',
              textContent: 'Dear {{firstName}}, Welcome to {{companyName}}!'
            })
          }
        }]
      };

      jest.spyOn(provider['client'].chat.completions, 'create').mockResolvedValue(mockResponse as any);

      const result = await provider.generateTemplate(mockRequest);

      expect(result.variables).toEqual([
        { name: 'firstName', type: 'text', required: true },
        { name: 'companyName', type: 'text', required: true }
      ]);
    });

    it('should handle API errors gracefully', async () => {
      jest.spyOn(provider['client'].chat.completions, 'create').mockRejectedValue(new Error('API Error'));

      await expect(provider.generateTemplate(mockRequest)).rejects.toThrow('AI template generation failed: API Error');
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null
          }
        }]
      };

      jest.spyOn(provider['client'].chat.completions, 'create').mockResolvedValue(mockResponse as any);

      await expect(provider.generateTemplate(mockRequest)).rejects.toThrow('AI template generation failed: No response from OpenRouter');
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'invalid json'
          }
        }]
      };

      jest.spyOn(provider['client'].chat.completions, 'create').mockResolvedValue(mockResponse as any);

      await expect(provider.generateTemplate(mockRequest)).rejects.toThrow('AI template generation failed:');
    });
  });

  describe('prompt building', () => {
    it('should build comprehensive prompt with all parameters', () => {
      const request: AITemplateRequest = {
        tenantId: 'test-tenant',
        prompt: 'Create a promotional email',
        templateType: 'promotional',
        tone: 'professional',
        brandName: 'TechCorp',
        industry: 'Technology',
        targetAudience: 'Enterprise customers',
        callToAction: 'Learn more',
        additionalContext: 'We are launching a new product'
      };

      // Access private method for testing
      const prompt = (provider as any).buildPrompt(request);

      expect(prompt).toContain('Create a promotional email');
      expect(prompt).toContain('Type: promotional');
      expect(prompt).toContain('Tone: professional');
      expect(prompt).toContain('Brand Name: TechCorp');
      expect(prompt).toContain('Industry: Technology');
      expect(prompt).toContain('Target Audience: Enterprise customers');
      expect(prompt).toContain('Call to Action: Learn more');
      expect(prompt).toContain('Additional Context: We are launching a new product');
    });

    it('should build minimal prompt with required parameters only', () => {
      const request: AITemplateRequest = {
        tenantId: 'test-tenant',
        prompt: 'Create a simple email'
      };

      const prompt = (provider as any).buildPrompt(request);

      expect(prompt).toContain('Create a simple email');
      expect(prompt).toContain('Type: custom');
      expect(prompt).toContain('Tone: professional');
    });
  });

  describe('text extraction', () => {
    it('should extract plain text from HTML', () => {
      const htmlContent = '<html><body><h1>Hello World</h1><p>This is a <strong>test</strong> email.</p></body></html>';
      
      const textContent = (provider as any).extractTextFromHtml(htmlContent);
      
      expect(textContent).toBe('Hello World This is a test email.');
    });

    it('should handle HTML entities', () => {
      const htmlContent = '<p>Hello &amp; welcome to our &quot;amazing&quot; service!</p>';
      
      const textContent = (provider as any).extractTextFromHtml(htmlContent);
      
      expect(textContent).toBe('Hello & welcome to our "amazing" service!');
    });
  });
});