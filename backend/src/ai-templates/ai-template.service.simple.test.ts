import { AITemplateService } from './ai-template.service';
import { SubscriptionService } from '../billing/subscription.service';
import { SubscriptionTier } from '../shared/types';

// Simple test without complex mocking
describe('AITemplateService - Simple Tests', () => {
  let aiTemplateService: AITemplateService;
  let mockSubscriptionService: any;

  beforeEach(() => {
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    // Create a simple mock
    mockSubscriptionService = {
      getSubscriptionByTenantId: jest.fn().mockResolvedValue({
        id: 'sub_123',
        tenantId: 'tenant_123',
        planId: 'free_plan',
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
      })
    };
    
    aiTemplateService = new AITemplateService(mockSubscriptionService);
  });

  describe('getTierLimits', () => {
    it('should return correct limits for FREE tier', () => {
      const limits = (aiTemplateService as any).getTierLimits(SubscriptionTier.FREE);
      
      expect(limits.dailyLimit).toBe(1);
      expect(limits.monthlyLimit).toBe(30);
      expect(limits.hasUnlimitedAccess).toBe(false);
    });

    it('should return correct limits for PAID_STANDARD tier', () => {
      const limits = (aiTemplateService as any).getTierLimits(SubscriptionTier.PAID_STANDARD);
      
      expect(limits.dailyLimit).toBe(10);
      expect(limits.monthlyLimit).toBe(300);
      expect(limits.hasUnlimitedAccess).toBe(false);
    });

    it('should return unlimited access for PREMIUM tier', () => {
      const limits = (aiTemplateService as any).getTierLimits(SubscriptionTier.PREMIUM);
      
      expect(limits.dailyLimit).toBe(-1);
      expect(limits.monthlyLimit).toBe(-1);
      expect(limits.hasUnlimitedAccess).toBe(true);
    });

    it('should return unlimited access for ENTERPRISE tier', () => {
      const limits = (aiTemplateService as any).getTierLimits(SubscriptionTier.ENTERPRISE);
      
      expect(limits.dailyLimit).toBe(-1);
      expect(limits.monthlyLimit).toBe(-1);
      expect(limits.hasUnlimitedAccess).toBe(true);
    });
  });

  describe('getAvailableTemplateTypes', () => {
    it('should return array of template types', async () => {
      const types = await aiTemplateService.getAvailableTemplateTypes();
      
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain('promotional');
      expect(types).toContain('welcome');
      expect(types).toContain('newsletter');
      expect(types).toContain('custom');
    });
  });

  describe('getTemplateSuggestions', () => {
    it('should return template suggestions without industry', async () => {
      const suggestions = await aiTemplateService.getTemplateSuggestions();
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      const firstSuggestion = suggestions[0];
      expect(firstSuggestion).toHaveProperty('type');
      expect(firstSuggestion).toHaveProperty('title');
      expect(firstSuggestion).toHaveProperty('description');
      expect(firstSuggestion).toHaveProperty('samplePrompt');
    });

    it('should include industry-specific suggestions when industry provided', async () => {
      const suggestions = await aiTemplateService.getTemplateSuggestions('healthcare');
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Should include the industry-specific suggestion
      const industrySpecific = suggestions.find(s => s.title.includes('healthcare'));
      expect(industrySpecific).toBeDefined();
    });
  });

  describe('generateTemplateName', () => {
    it('should generate name with brand name', () => {
      const request = {
        tenantId: 'tenant_123',
        prompt: 'Test prompt',
        templateType: 'welcome' as const,
        brandName: 'TestBrand'
      };
      
      const name = (aiTemplateService as any).generateTemplateName(request);
      expect(name).toContain('TestBrand');
      expect(name).toContain('welcome');
    });

    it('should generate name without brand name', () => {
      const request = {
        tenantId: 'tenant_123',
        prompt: 'Test prompt',
        templateType: 'promotional' as const
      };
      
      const name = (aiTemplateService as any).generateTemplateName(request);
      expect(name).toContain('AI promotional template');
    });
  });

  describe('estimateTokenUsage', () => {
    it('should estimate token usage correctly', () => {
      const prompt = 'This is a test prompt';
      const content = 'This is generated content that is longer than the prompt';
      
      const tokens = (aiTemplateService as any).estimateTokenUsage(prompt, content);
      
      expect(typeof tokens).toBe('number');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeGreaterThan(prompt.length / 4); // Should be more than just prompt
    });
  });

  describe('getTemplateUsage', () => {
    it('should return usage for new tenant', async () => {
      const usage = await aiTemplateService.getTemplateUsage('tenant_123');
      
      expect(usage.tenantId).toBe('tenant_123');
      expect(usage.dailyUsage).toBe(0);
      expect(usage.monthlyUsage).toBe(0);
      expect(usage.limits).toBeDefined();
      expect(usage.limits.dailyLimit).toBe(1); // FREE tier
    });
  });

  describe('trackTemplateUsage', () => {
    it('should increment usage counters', async () => {
      // Get initial usage
      const initialUsage = await aiTemplateService.getTemplateUsage('tenant_123');
      expect(initialUsage.dailyUsage).toBe(0);
      
      // Track usage
      await aiTemplateService.trackTemplateUsage('tenant_123');
      
      // Check updated usage
      const updatedUsage = await aiTemplateService.getTemplateUsage('tenant_123');
      expect(updatedUsage.dailyUsage).toBe(1);
      expect(updatedUsage.monthlyUsage).toBe(1);
    });
  });

  describe('validateTemplateQuota', () => {
    it('should return true for new tenant within limits', async () => {
      const canGenerate = await aiTemplateService.validateTemplateQuota('tenant_123');
      expect(canGenerate).toBe(true);
    });

    it('should return false when daily limit exceeded', async () => {
      // Track usage to reach limit (FREE tier has limit of 1)
      await aiTemplateService.trackTemplateUsage('tenant_123');
      
      // Should now be at limit
      const canGenerate = await aiTemplateService.validateTemplateQuota('tenant_123');
      expect(canGenerate).toBe(false);
    });
  });
});