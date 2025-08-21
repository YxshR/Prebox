import { AITemplateService } from './ai-template.service';
import { SubscriptionService } from '../billing/subscription.service';
import { SubscriptionTier } from '../shared/types';
import { AITemplateRequest, TemplateCustomization } from './ai-template.types';

// Mock the SubscriptionService
jest.mock('../billing/subscription.service');
jest.mock('./providers/openai.provider');

describe('AITemplateService', () => {
  let aiTemplateService: AITemplateService;
  let mockSubscriptionService: jest.Mocked<SubscriptionService>;

  beforeEach(() => {
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    mockSubscriptionService = new SubscriptionService() as jest.Mocked<SubscriptionService>;
    // Mock the method we actually use
    mockSubscriptionService.getSubscriptionByTenantId = jest.fn();
    aiTemplateService = new AITemplateService(mockSubscriptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTemplate', () => {
    const mockRequest: AITemplateRequest = {
      tenantId: 'tenant_123',
      prompt: 'Create a welcome email for new customers',
      templateType: 'welcome',
      tone: 'friendly',
      brandName: 'Test Company'
    };

    beforeEach(() => {
      // Mock subscription service to return FREE tier
      mockSubscriptionService.getSubscriptionByTenantId.mockResolvedValue({
        id: 'sub_123',
        tenantId: 'tenant_123',
        planId: 'free_plan',
        status: 'active' as any,
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
          dailyEmailLimit: 100,
          monthlyRecipientLimit: 300,
          monthlyEmailLimit: 2000,
          templateLimit: 1,
          customDomainLimit: 0,
          hasLogoCustomization: false,
          hasCustomDomains: false,
          hasAdvancedAnalytics: false
        },
        rechargeBalance: 0
      });
    });

    it('should generate a template successfully for valid request', async () => {
      const result = await aiTemplateService.generateTemplate(mockRequest);

      expect(result).toHaveProperty('template');
      expect(result).toHaveProperty('generationMetadata');
      expect(result.template.tenantId).toBe(mockRequest.tenantId);
      expect(result.template.isAIGenerated).toBe(true);
      expect(result.generationMetadata.prompt).toBe(mockRequest.prompt);
    });

    it('should track usage after successful generation', async () => {
      await aiTemplateService.generateTemplate(mockRequest);
      
      const usage = await aiTemplateService.getTemplateUsage(mockRequest.tenantId);
      expect(usage.dailyUsage).toBe(1);
      expect(usage.monthlyUsage).toBe(1);
    });

    it('should throw error when quota is exceeded', async () => {
      // Generate one template to reach FREE tier limit
      await aiTemplateService.generateTemplate(mockRequest);
      
      // Try to generate another - should fail
      await expect(aiTemplateService.generateTemplate(mockRequest))
        .rejects.toThrow('Template generation quota exceeded');
    });

    it('should allow unlimited generation for PREMIUM tier', async () => {
      // Mock PREMIUM tier subscription
      mockSubscriptionService.getSubscriptionByTenantId.mockResolvedValue({
        id: 'sub_123',
        tenantId: 'tenant_123',
        planId: 'premium_plan',
        status: 'active' as any,
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
          templateLimit: -1,
          customDomainLimit: 10,
          hasLogoCustomization: true,
          hasCustomDomains: true,
          hasAdvancedAnalytics: true
        },
        rechargeBalance: 0
      });

      // Should be able to generate multiple templates
      await aiTemplateService.generateTemplate(mockRequest);
      await aiTemplateService.generateTemplate(mockRequest);
      await aiTemplateService.generateTemplate(mockRequest);

      const usage = await aiTemplateService.getTemplateUsage(mockRequest.tenantId);
      expect(usage.dailyUsage).toBe(3);
      expect(usage.limits.hasUnlimitedAccess).toBe(true);
    });
  });

  describe('validateTemplateQuota', () => {
    it('should return true for FREE tier within limits', async () => {
      mockSubscriptionService.getSubscriptionByTenantId.mockResolvedValue({
        id: 'sub_123',
        tenantId: 'tenant_123',
        tier: SubscriptionTier.FREE,
        status: 'active' as any,
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
          dailyEmailLimit: 100,
          monthlyRecipientLimit: 300,
          monthlyEmailLimit: 2000,
          templateLimit: 1,
          customDomainLimit: 0,
          hasLogoCustomization: false,
          hasCustomDomains: false,
          hasAdvancedAnalytics: false
        },
        rechargeBalance: 0
      });

      const canGenerate = await aiTemplateService.validateTemplateQuota('tenant_123');
      expect(canGenerate).toBe(true);
    });

    it('should return false for FREE tier when daily limit exceeded', async () => {
      mockSubscriptionService.getSubscriptionByTenantId.mockResolvedValue({
        id: 'sub_123',
        tenantId: 'tenant_123',
        tier: SubscriptionTier.FREE,
        status: 'active' as any,
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
          dailyEmailLimit: 100,
          monthlyRecipientLimit: 300,
          monthlyEmailLimit: 2000,
          templateLimit: 1,
          customDomainLimit: 0,
          hasLogoCustomization: false,
          hasCustomDomains: false,
          hasAdvancedAnalytics: false
        },
        rechargeBalance: 0
      });

      // Simulate usage at limit
      await aiTemplateService.trackTemplateUsage('tenant_123');
      
      const canGenerate = await aiTemplateService.validateTemplateQuota('tenant_123');
      expect(canGenerate).toBe(false);
    });

    it('should return true for PREMIUM tier regardless of usage', async () => {
      mockSubscriptionService.getSubscriptionByTenantId.mockResolvedValue({
        id: 'sub_123',
        tenantId: 'tenant_123',
        tier: SubscriptionTier.PREMIUM,
        status: 'active' as any,
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
          templateLimit: -1,
          customDomainLimit: 10,
          hasLogoCustomization: true,
          hasCustomDomains: true,
          hasAdvancedAnalytics: true
        },
        rechargeBalance: 0
      });

      const canGenerate = await aiTemplateService.validateTemplateQuota('tenant_123');
      expect(canGenerate).toBe(true);
    });
  });

  describe('customizeTemplate', () => {
    const mockCustomization: TemplateCustomization = {
      templateId: 'template_123',
      tenantId: 'tenant_123',
      modifications: {
        subject: 'Updated Subject',
        styling: {
          primaryColor: '#ff0000',
          fontFamily: 'Arial, sans-serif'
        }
      }
    };

    it('should customize template successfully', async () => {
      const result = await aiTemplateService.customizeTemplate(mockCustomization);

      expect(result.subject).toBe('Updated Subject');
      expect(result.tenantId).toBe(mockCustomization.tenantId);
      expect(result.name).toContain('Customized');
    });

    it('should apply styling modifications to HTML content', async () => {
      const customizationWithStyling: TemplateCustomization = {
        ...mockCustomization,
        modifications: {
          htmlContent: '<div style="color: #000000;">Test</div>',
          styling: {
            primaryColor: '#ff0000'
          }
        }
      };

      const result = await aiTemplateService.customizeTemplate(customizationWithStyling);
      expect(result.htmlContent).toContain('#ff0000');
    });
  });

  describe('getTemplateUsage', () => {
    it('should return usage stats for tenant', async () => {
      mockSubscriptionService.getSubscriptionByTenantId.mockResolvedValue({
        id: 'sub_123',
        tenantId: 'tenant_123',
        tier: SubscriptionTier.PAID_STANDARD,
        status: 'active' as any,
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
          dailyEmailLimit: 1000,
          monthlyRecipientLimit: 5000,
          monthlyEmailLimit: 30000,
          templateLimit: 10,
          customDomainLimit: 0,
          hasLogoCustomization: true,
          hasCustomDomains: false,
          hasAdvancedAnalytics: false
        },
        rechargeBalance: 0
      });

      const usage = await aiTemplateService.getTemplateUsage('tenant_123');

      expect(usage.tenantId).toBe('tenant_123');
      expect(usage.tier).toBe(SubscriptionTier.PAID_STANDARD);
      expect(usage.limits.dailyLimit).toBe(10);
      expect(usage.dailyUsage).toBe(0);
    });

    it('should reset daily usage for new day', async () => {
      mockSubscriptionService.getSubscriptionByTenantId.mockResolvedValue({
        id: 'sub_123',
        tenantId: 'tenant_123',
        tier: SubscriptionTier.FREE,
        status: 'active' as any,
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
          dailyEmailLimit: 100,
          monthlyRecipientLimit: 300,
          monthlyEmailLimit: 2000,
          templateLimit: 1,
          customDomainLimit: 0,
          hasLogoCustomization: false,
          hasCustomDomains: false,
          hasAdvancedAnalytics: false
        },
        rechargeBalance: 0
      });

      // Track usage
      await aiTemplateService.trackTemplateUsage('tenant_123');
      
      // Simulate next day by modifying the usage tracker
      const usage = await aiTemplateService.getTemplateUsage('tenant_123');
      usage.lastUsedAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      
      // Track usage again - should reset daily count
      await aiTemplateService.trackTemplateUsage('tenant_123');
      
      const updatedUsage = await aiTemplateService.getTemplateUsage('tenant_123');
      expect(updatedUsage.dailyUsage).toBe(1); // Reset to 1 (current usage)
    });
  });

  describe('getAvailableTemplateTypes', () => {
    it('should return list of available template types', async () => {
      const types = await aiTemplateService.getAvailableTemplateTypes();
      
      expect(Array.isArray(types)).toBe(true);
      expect(types).toContain('promotional');
      expect(types).toContain('welcome');
      expect(types).toContain('newsletter');
    });
  });

  describe('getTemplateSuggestions', () => {
    it('should return template suggestions', async () => {
      const suggestions = await aiTemplateService.getTemplateSuggestions();
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('type');
      expect(suggestions[0]).toHaveProperty('title');
      expect(suggestions[0]).toHaveProperty('description');
      expect(suggestions[0]).toHaveProperty('samplePrompt');
    });

    it('should include industry-specific suggestions when industry provided', async () => {
      const suggestions = await aiTemplateService.getTemplateSuggestions('healthcare');
      
      const industrySpecific = suggestions.find(s => s.title.includes('healthcare'));
      expect(industrySpecific).toBeDefined();
    });
  });

  describe('getUsageStats', () => {
    it('should return current usage and history', async () => {
      mockSubscriptionService.getSubscriptionByTenantId.mockResolvedValue({
        id: 'sub_123',
        tenantId: 'tenant_123',
        tier: SubscriptionTier.FREE,
        status: 'active' as any,
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
          dailyEmailLimit: 100,
          monthlyRecipientLimit: 300,
          monthlyEmailLimit: 2000,
          templateLimit: 1,
          customDomainLimit: 0,
          hasLogoCustomization: false,
          hasCustomDomains: false,
          hasAdvancedAnalytics: false
        },
        rechargeBalance: 0
      });

      const stats = await aiTemplateService.getUsageStats('tenant_123');
      
      expect(stats).toHaveProperty('current');
      expect(stats).toHaveProperty('history');
      expect(Array.isArray(stats.history)).toBe(true);
    });
  });
});