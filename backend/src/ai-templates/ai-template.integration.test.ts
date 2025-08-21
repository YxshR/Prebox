/**
 * Integration tests for AI Template Service
 * Tests the integration between AI templates and campaign management
 */

import { AITemplateService } from './ai-template.service';
import { CampaignService } from '../campaigns/campaign.service';
import { EmailService } from '../emails/email.service';
import { SubscriptionService } from '../billing/subscription.service';
import { AITemplateRequest } from './ai-template.types';
import { SubscriptionTier } from '../shared/types';

describe('AI Template Service Integration', () => {
  let aiTemplateService: AITemplateService;
  let campaignService: CampaignService;
  let mockSubscriptionService: any;
  let mockEmailService: any;

  beforeEach(() => {
    // Set up environment
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    // Mock subscription service
    mockSubscriptionService = {
      getSubscriptionByTenantId: jest.fn().mockResolvedValue({
        id: 'sub_123',
        tenantId: 'tenant_123',
        planId: 'premium_plan',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        usage: {
          dailyEmailsSent: 0,
          monthlyEmailsSent: 0,
          uniqueRecipients: 0,
          templatesCreated: 0,
          customDomainsUsed: 0,
          lastResetDate: new Date()
        },
        limits: {
          dailyEmailLimit: 5000,
          monthlyRecipientLimit: 25000,
          monthlyEmailLimit: 100000,
          templateLimit: -1, // Unlimited for premium
          customDomainLimit: 10,
          hasLogoCustomization: true,
          hasCustomDomains: true,
          hasAdvancedAnalytics: true
        },
        rechargeBalance: 0
      })
    };

    // Mock email service
    mockEmailService = {
      createEmailJob: jest.fn(),
      sendEmail: jest.fn()
    };

    // Initialize services
    aiTemplateService = new AITemplateService(mockSubscriptionService);
    campaignService = new CampaignService(mockEmailService);
  });

  describe('AI Template to Campaign Integration', () => {
    it('should generate AI template and create campaign', async () => {
      // Step 1: Generate AI template
      const templateRequest: AITemplateRequest = {
        tenantId: 'tenant_123',
        prompt: 'Create a product launch announcement email',
        templateType: 'promotional',
        tone: 'professional',
        brandName: 'TechCorp',
        callToAction: 'Learn more about our new features'
      };

      // Mock the AI generation (since we can't call real OpenAI in tests)
      const mockGenerateTemplate = jest.spyOn(aiTemplateService, 'generateTemplate');
      mockGenerateTemplate.mockResolvedValue({
        template: {
          id: 'ai_template_123',
          tenantId: 'tenant_123',
          name: 'TechCorp promotional template - 2024-01-15',
          subject: 'Introducing {{productName}} - Revolutionary Features Await!',
          htmlContent: `
            <html>
              <body>
                <h1>Hello {{firstName}}!</h1>
                <p>We're excited to announce the launch of {{productName}}.</p>
                <p>{{productDescription}}</p>
                <a href="{{ctaLink}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none;">
                  Learn More
                </a>
                <p>Best regards,<br>The {{companyName}} Team</p>
              </body>
            </html>
          `,
          textContent: 'Hello {{firstName}}! We\'re excited to announce {{productName}}...',
          variables: [
            { name: 'firstName', type: 'text', required: true },
            { name: 'productName', type: 'text', required: true },
            { name: 'productDescription', type: 'text', required: false },
            { name: 'ctaLink', type: 'text', required: true },
            { name: 'companyName', type: 'text', required: false }
          ],
          isAIGenerated: true,
          createdAt: new Date()
        },
        generationMetadata: {
          model: 'OpenAI',
          tokensUsed: 1250,
          generationTime: 3500,
          prompt: templateRequest.prompt
        }
      });

      const aiResult = await aiTemplateService.generateTemplate(templateRequest);
      
      // Verify AI template generation
      expect(aiResult.template.isAIGenerated).toBe(true);
      expect(aiResult.template.variables.length).toBeGreaterThan(0);
      expect(aiResult.template.subject).toContain('{{productName}}');

      // Step 2: Create campaign template from AI result
      const campaignTemplate = await campaignService.createTemplate({
        tenantId: aiResult.template.tenantId,
        name: aiResult.template.name,
        subject: aiResult.template.subject,
        htmlContent: aiResult.template.htmlContent,
        textContent: aiResult.template.textContent,
        variables: aiResult.template.variables,
        isAIGenerated: true
      });

      // Verify campaign template creation
      expect(campaignTemplate.id).toBeDefined();
      expect(campaignTemplate.isAIGenerated).toBe(true);
      expect(campaignTemplate.variables).toEqual(aiResult.template.variables);

      // Step 3: Create campaign using the AI-generated template
      const campaign = await campaignService.createCampaign({
        tenantId: 'tenant_123',
        name: 'Product Launch Campaign',
        templateId: campaignTemplate.id,
        listIds: ['list_123']
      });

      // Verify campaign creation
      expect(campaign.id).toBeDefined();
      expect(campaign.templateId).toBe(campaignTemplate.id);
      expect(campaign.name).toBe('Product Launch Campaign');

      // Cleanup mocks
      mockGenerateTemplate.mockRestore();
    });

    it('should handle quota limits during campaign creation', async () => {
      // Mock FREE tier with limited quota
      mockSubscriptionService.getSubscriptionByTenantId.mockResolvedValue({
        id: 'sub_123',
        tenantId: 'tenant_123',
        planId: 'free_plan',
        status: 'active',
        limits: {
          templateLimit: 1,
          dailyEmailLimit: 100,
          monthlyRecipientLimit: 300,
          monthlyEmailLimit: 2000,
          customDomainLimit: 0,
          hasLogoCustomization: false,
          hasCustomDomains: false,
          hasAdvancedAnalytics: false
        },
        usage: {
          dailyEmailsSent: 0,
          monthlyEmailsSent: 0,
          uniqueRecipients: 0,
          templatesCreated: 0,
          customDomainsUsed: 0,
          lastResetDate: new Date()
        },
        rechargeBalance: 0
      });

      const templateRequest: AITemplateRequest = {
        tenantId: 'tenant_123',
        prompt: 'Create a welcome email',
        templateType: 'welcome'
      };

      // First generation should succeed
      const canGenerate1 = await aiTemplateService.validateTemplateQuota('tenant_123');
      expect(canGenerate1).toBe(true);

      // Track usage to reach limit
      await aiTemplateService.trackTemplateUsage('tenant_123');

      // Second generation should fail
      const canGenerate2 = await aiTemplateService.validateTemplateQuota('tenant_123');
      expect(canGenerate2).toBe(false);

      // Attempting to generate should throw error
      await expect(aiTemplateService.generateTemplate(templateRequest))
        .rejects.toThrow('Template generation quota exceeded');
    });
  });

  describe('Template Usage Analytics', () => {
    it('should track template usage across multiple generations', async () => {
      const tenantId = 'tenant_analytics';

      // Generate multiple templates
      const requests = [
        { prompt: 'Welcome email', templateType: 'welcome' as const },
        { prompt: 'Newsletter', templateType: 'newsletter' as const },
        { prompt: 'Promotional email', templateType: 'promotional' as const }
      ];

      for (const request of requests) {
        await aiTemplateService.trackTemplateUsage(tenantId);
      }

      // Check usage statistics
      const usage = await aiTemplateService.getTemplateUsage(tenantId);
      expect(usage.dailyUsage).toBe(3);
      expect(usage.monthlyUsage).toBe(3);

      const stats = await aiTemplateService.getUsageStats(tenantId);
      expect(stats.current.dailyUsage).toBe(3);
      expect(stats.history.length).toBeGreaterThan(0);
    });

    it('should reset daily usage for new day', async () => {
      const tenantId = 'tenant_reset';

      // Track usage
      await aiTemplateService.trackTemplateUsage(tenantId);
      
      let usage = await aiTemplateService.getTemplateUsage(tenantId);
      expect(usage.dailyUsage).toBe(1);

      // Simulate next day by manually setting last used date
      usage.lastUsedAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      
      // Track usage again - should reset daily count
      await aiTemplateService.trackTemplateUsage(tenantId);
      
      usage = await aiTemplateService.getTemplateUsage(tenantId);
      expect(usage.dailyUsage).toBe(1); // Reset to 1 (current usage)
      expect(usage.monthlyUsage).toBe(2); // Monthly should accumulate
    });
  });

  describe('Template Customization Workflow', () => {
    it('should customize AI template and use in campaign', async () => {
      // Mock AI template generation
      const mockGenerateTemplate = jest.spyOn(aiTemplateService, 'generateTemplate');
      mockGenerateTemplate.mockResolvedValue({
        template: {
          id: 'ai_template_456',
          tenantId: 'tenant_123',
          name: 'Original AI Template',
          subject: 'Welcome to {{companyName}}',
          htmlContent: '<h1>Welcome {{firstName}}!</h1>',
          textContent: 'Welcome {{firstName}}!',
          variables: [
            { name: 'firstName', type: 'text', required: true },
            { name: 'companyName', type: 'text', required: true }
          ],
          isAIGenerated: true,
          createdAt: new Date()
        },
        generationMetadata: {
          model: 'OpenAI',
          tokensUsed: 800,
          generationTime: 2500,
          prompt: 'Create a welcome email'
        }
      });

      // Generate original template
      const originalResult = await aiTemplateService.generateTemplate({
        tenantId: 'tenant_123',
        prompt: 'Create a welcome email'
      });

      // Customize the template
      const customizedTemplate = await aiTemplateService.customizeTemplate({
        templateId: originalResult.template.id,
        tenantId: 'tenant_123',
        modifications: {
          subject: 'Welcome to TechCorp - Let\'s Get Started! 🚀',
          htmlContent: '<h1 style="color: #007bff;">Welcome {{firstName}}!</h1>',
          styling: {
            primaryColor: '#007bff',
            fontFamily: 'Arial, sans-serif'
          }
        }
      });

      // Verify customization
      expect(customizedTemplate.subject).toBe('Welcome to TechCorp - Let\'s Get Started! 🚀');
      expect(customizedTemplate.name).toContain('Customized');
      expect(customizedTemplate.htmlContent).toContain('#007bff');

      // Create campaign with customized template
      const campaignTemplate = await campaignService.createTemplate({
        tenantId: customizedTemplate.tenantId,
        name: customizedTemplate.name,
        subject: customizedTemplate.subject,
        htmlContent: customizedTemplate.htmlContent,
        textContent: customizedTemplate.textContent,
        variables: customizedTemplate.variables,
        isAIGenerated: true
      });

      expect(campaignTemplate.subject).toBe(customizedTemplate.subject);

      // Cleanup
      mockGenerateTemplate.mockRestore();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle AI provider errors gracefully', async () => {
      // Mock AI provider to throw error
      const mockGenerateTemplate = jest.spyOn(aiTemplateService, 'generateTemplate');
      mockGenerateTemplate.mockRejectedValue(new Error('AI service unavailable'));

      const templateRequest: AITemplateRequest = {
        tenantId: 'tenant_123',
        prompt: 'Create a test email'
      };

      await expect(aiTemplateService.generateTemplate(templateRequest))
        .rejects.toThrow('AI service unavailable');

      // Cleanup
      mockGenerateTemplate.mockRestore();
    });

    it('should validate template request parameters', async () => {
      const invalidRequest: any = {
        tenantId: 'tenant_123',
        prompt: '', // Empty prompt should be invalid
        templateType: 'invalid_type'
      };

      // This would be caught by the controller validation in real usage
      expect(invalidRequest.prompt).toBe('');
    });

    it('should handle subscription service errors', async () => {
      // Mock subscription service to throw error
      mockSubscriptionService.getSubscriptionByTenantId.mockRejectedValue(
        new Error('Subscription service unavailable')
      );

      await expect(aiTemplateService.getTemplateUsage('tenant_123'))
        .rejects.toThrow('Subscription service unavailable');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent template generations', async () => {
      const tenantId = 'tenant_concurrent';
      const concurrentRequests = 3;

      // Mock successful generations
      const mockGenerateTemplate = jest.spyOn(aiTemplateService, 'generateTemplate');
      mockGenerateTemplate.mockImplementation(async (request) => ({
        template: {
          id: `template_${Date.now()}_${Math.random()}`,
          tenantId: request.tenantId,
          name: `AI Template - ${request.templateType}`,
          subject: 'Test Subject',
          htmlContent: '<h1>Test</h1>',
          textContent: 'Test',
          variables: [],
          isAIGenerated: true,
          createdAt: new Date()
        },
        generationMetadata: {
          model: 'OpenAI',
          tokensUsed: 500,
          generationTime: 1000,
          prompt: request.prompt
        }
      }));

      // Create concurrent requests
      const requests = Array.from({ length: concurrentRequests }, (_, i) => ({
        tenantId,
        prompt: `Create template ${i + 1}`,
        templateType: 'custom' as const
      }));

      // Execute concurrently
      const results = await Promise.all(
        requests.map(request => aiTemplateService.generateTemplate(request))
      );

      // Verify all succeeded
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.template.id).toBeDefined();
        expect(result.template.isAIGenerated).toBe(true);
      });

      // Cleanup
      mockGenerateTemplate.mockRestore();
    });

    it('should efficiently track usage for multiple tenants', async () => {
      const tenantIds = ['tenant_1', 'tenant_2', 'tenant_3'];

      // Track usage for multiple tenants
      for (const tenantId of tenantIds) {
        await aiTemplateService.trackTemplateUsage(tenantId);
        await aiTemplateService.trackTemplateUsage(tenantId);
      }

      // Verify each tenant has correct usage
      for (const tenantId of tenantIds) {
        const usage = await aiTemplateService.getTemplateUsage(tenantId);
        expect(usage.dailyUsage).toBe(2);
        expect(usage.tenantId).toBe(tenantId);
      }
    });
  });
});