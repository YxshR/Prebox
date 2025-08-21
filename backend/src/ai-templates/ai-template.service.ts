import { 
  AITemplateRequest, 
  AITemplateResponse, 
  TemplateUsage, 
  TemplateUsageLimits,
  TemplateCustomization,
  TemplateGenerationJob,
  AIProvider
} from './ai-template.types';
import { EmailTemplate, SubscriptionTier, TemplateVariable } from '../shared/types';
import { OpenAIProvider } from './providers/openai.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { SubscriptionService } from '../billing/subscription.service';
import { AIConnectivityService } from './ai-connectivity.service';
import { AIFallbackService } from './ai-fallback.service';

export class AITemplateService {
  private aiProvider: AIProvider;
  private subscriptionService: SubscriptionService;
  private connectivityService: AIConnectivityService;
  private usageTracker: Map<string, TemplateUsage> = new Map();
  private generationJobs: Map<string, TemplateGenerationJob> = new Map();

  constructor(subscriptionService: SubscriptionService) {
    this.subscriptionService = subscriptionService;
    this.connectivityService = AIConnectivityService.getInstance();
    
    // Initialize AI provider based on environment
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (openrouterKey) {
      // Use OpenRouter as primary provider
      this.aiProvider = new OpenRouterProvider(openrouterKey);
    } else if (openaiKey) {
      // Fallback to OpenAI
      this.aiProvider = new OpenAIProvider(openaiKey);
    } else {
      throw new Error('Either OPENROUTER_API_KEY or OPENAI_API_KEY environment variable is required');
    }
  }

  async generateTemplate(request: AITemplateRequest): Promise<AITemplateResponse> {
    // Check AI service connectivity before generation
    const connectivityStatus = await this.connectivityService.getConnectivityStatus();
    if (connectivityStatus.aiServiceStatus !== 'available') {
      // Use fallback template when AI services are unavailable
      console.log('AI service unavailable, using fallback template');
      return this.generateFallbackTemplate(request);
    }

    // Validate quota before generation
    const canGenerate = await this.validateTemplateQuota(request.tenantId);
    if (!canGenerate) {
      throw new Error('Template generation quota exceeded for current subscription tier');
    }

    const startTime = Date.now();
    
    try {
      // Generate template using AI provider
      const generatedContent = await this.aiProvider.generateTemplate(request);
      
      // Create EmailTemplate object
      const template: EmailTemplate = {
        id: this.generateId('ai_template'),
        tenantId: request.tenantId,
        name: this.generateTemplateName(request),
        subject: generatedContent.subject,
        htmlContent: generatedContent.htmlContent,
        textContent: generatedContent.textContent,
        variables: generatedContent.variables,
        isAIGenerated: true,
        createdAt: new Date()
      };

      // Track usage
      await this.trackTemplateUsage(request.tenantId);

      const generationTime = Date.now() - startTime;

      const response: AITemplateResponse = {
        template,
        generationMetadata: {
          model: this.aiProvider.name,
          tokensUsed: this.estimateTokenUsage(request.prompt, generatedContent.htmlContent),
          generationTime,
          prompt: request.prompt
        }
      };

      console.log(`✅ AI template generated: ${template.name} (${template.id}) in ${generationTime}ms`);
      return response;

    } catch (error) {
      console.error('AI template generation failed:', error);
      
      // Try fallback template as last resort
      console.log('Attempting fallback template generation due to AI failure');
      try {
        return this.generateFallbackTemplate(request);
      } catch (fallbackError) {
        console.error('Fallback template generation also failed:', fallbackError);
        throw error; // Throw original error
      }
    }
  }

  /**
   * Generate a fallback template when AI services are unavailable
   */
  private async generateFallbackTemplate(request: AITemplateRequest): Promise<AITemplateResponse> {
    const startTime = Date.now();

    try {
      // Get fallback template
      const fallbackTemplate = AIFallbackService.getFallbackTemplate(request);
      
      // Create EmailTemplate object
      const template: EmailTemplate = AIFallbackService.createEmailTemplate(
        fallbackTemplate,
        request.tenantId,
        this.generateTemplateName(request) + ' (Fallback)'
      );

      // Track usage (fallback templates still count toward quota)
      await this.trackTemplateUsage(request.tenantId);

      const generationTime = Date.now() - startTime;

      const response: AITemplateResponse = {
        template,
        generationMetadata: {
          model: 'Fallback Template',
          tokensUsed: 0,
          generationTime,
          prompt: request.prompt
        }
      };

      console.log(`✅ Fallback template generated: ${template.name} (${template.id}) in ${generationTime}ms`);
      return response;

    } catch (error) {
      console.error('Fallback template generation failed:', error);
      throw new Error('Both AI service and fallback template generation failed. Please try again later.');
    }
  }

  async customizeTemplate(customization: TemplateCustomization): Promise<EmailTemplate> {
    const { templateId, tenantId, modifications } = customization;

    // In production, this would fetch from database
    // For now, we'll create a new template with modifications
    const baseTemplate: EmailTemplate = {
      id: templateId,
      tenantId,
      name: 'Base Template',
      subject: 'Default Subject',
      htmlContent: '<html><body>Default Content</body></html>',
      textContent: 'Default Content',
      variables: [],
      isAIGenerated: true,
      createdAt: new Date()
    };

    const customizedTemplate: EmailTemplate = {
      ...baseTemplate,
      id: this.generateId('customized_template'),
      name: `${baseTemplate.name} (Customized)`,
      subject: modifications.subject || baseTemplate.subject,
      htmlContent: modifications.htmlContent || baseTemplate.htmlContent,
      textContent: modifications.textContent || baseTemplate.textContent,
      variables: modifications.variables || baseTemplate.variables,
      createdAt: new Date()
    };

    // Apply styling modifications if provided
    if (modifications.styling) {
      customizedTemplate.htmlContent = this.applyCustomStyling(
        customizedTemplate.htmlContent,
        modifications.styling
      );
    }

    console.log(`✅ Template customized: ${customizedTemplate.name} (${customizedTemplate.id})`);
    return customizedTemplate;
  }

  async validateTemplateQuota(tenantId: string): Promise<boolean> {
    const usage = await this.getTemplateUsage(tenantId);
    const limits = usage.limits;

    // Check daily limit
    if (!limits.hasUnlimitedAccess && usage.dailyUsage >= limits.dailyLimit) {
      return false;
    }

    // Check monthly limit (if applicable)
    if (!limits.hasUnlimitedAccess && limits.monthlyLimit > 0 && usage.monthlyUsage >= limits.monthlyLimit) {
      return false;
    }

    return true;
  }

  async getTemplateUsage(tenantId: string): Promise<TemplateUsage> {
    let usage = this.usageTracker.get(tenantId);
    
    if (!usage) {
      // Get subscription tier to determine limits
      const subscription = await this.subscriptionService.getSubscriptionByTenantId(tenantId);
      const tier = subscription?.limits ? this.getTierFromLimits(subscription.limits) : SubscriptionTier.FREE;
      
      usage = {
        tenantId,
        dailyUsage: 0,
        monthlyUsage: 0,
        lastUsedAt: new Date(),
        tier,
        limits: this.getTierLimits(tier)
      };
      
      this.usageTracker.set(tenantId, usage);
    }

    return usage;
  }

  async trackTemplateUsage(tenantId: string): Promise<void> {
    const usage = await this.getTemplateUsage(tenantId);
    const now = new Date();
    
    // Reset daily usage if it's a new day
    const lastUsedDate = new Date(usage.lastUsedAt).toDateString();
    const currentDate = now.toDateString();
    
    if (lastUsedDate !== currentDate) {
      usage.dailyUsage = 0;
    }

    // Reset monthly usage if it's a new month
    const lastUsedMonth = usage.lastUsedAt.getMonth();
    const currentMonth = now.getMonth();
    
    if (lastUsedMonth !== currentMonth) {
      usage.monthlyUsage = 0;
    }

    // Increment usage counters
    usage.dailyUsage += 1;
    usage.monthlyUsage += 1;
    usage.lastUsedAt = now;

    this.usageTracker.set(tenantId, usage);
    console.log(`📊 Template usage tracked for ${tenantId}: Daily ${usage.dailyUsage}/${usage.limits.dailyLimit}`);
  }

  private getTierFromLimits(limits: any): SubscriptionTier {
    // Determine tier based on template limits
    if (limits.templateLimit === 1) return SubscriptionTier.FREE;
    if (limits.templateLimit === 10) return SubscriptionTier.PAID_STANDARD;
    if (limits.templateLimit === -1) return SubscriptionTier.PREMIUM;
    return SubscriptionTier.FREE; // Default fallback
  }

  private getTierLimits(tier: SubscriptionTier): TemplateUsageLimits {
    switch (tier) {
      case SubscriptionTier.FREE:
        return {
          dailyLimit: 1,
          monthlyLimit: 30, // 1 per day max
          hasUnlimitedAccess: false
        };
      
      case SubscriptionTier.PAID_STANDARD:
        return {
          dailyLimit: 10,
          monthlyLimit: 300, // 10 per day max
          hasUnlimitedAccess: false
        };
      
      case SubscriptionTier.PREMIUM:
      case SubscriptionTier.ENTERPRISE:
        return {
          dailyLimit: -1, // Unlimited
          monthlyLimit: -1, // Unlimited
          hasUnlimitedAccess: true
        };
      
      default:
        return {
          dailyLimit: 1,
          monthlyLimit: 30,
          hasUnlimitedAccess: false
        };
    }
  }

  private generateTemplateName(request: AITemplateRequest): string {
    const type = request.templateType || 'custom';
    const timestamp = new Date().toISOString().slice(0, 10);
    
    if (request.brandName) {
      return `${request.brandName} ${type} template - ${timestamp}`;
    }
    
    return `AI ${type} template - ${timestamp}`;
  }

  private applyCustomStyling(htmlContent: string, styling: any): string {
    let styledContent = htmlContent;

    // Apply primary color
    if (styling.primaryColor) {
      styledContent = styledContent.replace(
        /color:\s*#[0-9a-fA-F]{6}/g,
        `color: ${styling.primaryColor}`
      );
    }

    // Apply font family
    if (styling.fontFamily) {
      styledContent = styledContent.replace(
        /font-family:\s*[^;]+/g,
        `font-family: ${styling.fontFamily}`
      );
    }

    // Apply custom CSS if provided
    if (styling.customCss) {
      const styleTag = `<style>${styling.customCss}</style>`;
      styledContent = styledContent.replace('<head>', `<head>${styleTag}`);
    }

    return styledContent;
  }

  private estimateTokenUsage(prompt: string, generatedContent: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    const promptTokens = Math.ceil(prompt.length / 4);
    const responseTokens = Math.ceil(generatedContent.length / 4);
    return promptTokens + responseTokens;
  }

  async getUsageStats(tenantId: string): Promise<{
    current: TemplateUsage;
    history: Array<{ date: string; count: number }>;
  }> {
    const current = await this.getTemplateUsage(tenantId);
    
    // In production, this would fetch historical data from database
    const history = [
      { date: new Date().toISOString().slice(0, 10), count: current.dailyUsage }
    ];

    return { current, history };
  }

  async getAvailableTemplateTypes(): Promise<string[]> {
    return [
      'promotional',
      'transactional', 
      'newsletter',
      'welcome',
      'abandoned_cart',
      'product_announcement',
      'event_invitation',
      'survey_feedback',
      'seasonal_campaign',
      'custom'
    ];
  }

  async getTemplateSuggestions(industry?: string): Promise<Array<{
    type: string;
    title: string;
    description: string;
    samplePrompt: string;
  }>> {
    const suggestions = [
      {
        type: 'welcome',
        title: 'Welcome Email Series',
        description: 'Onboard new customers with a warm welcome message',
        samplePrompt: 'Create a welcome email for new customers signing up for our service'
      },
      {
        type: 'promotional',
        title: 'Product Promotion',
        description: 'Promote products or services with compelling offers',
        samplePrompt: 'Create a promotional email for a 20% discount on our premium features'
      },
      {
        type: 'newsletter',
        title: 'Company Newsletter',
        description: 'Keep customers informed with regular updates',
        samplePrompt: 'Create a monthly newsletter template with company updates and industry news'
      }
    ];

    // Add industry-specific suggestions if provided
    if (industry) {
      suggestions.push({
        type: 'custom',
        title: `${industry} Specific Campaign`,
        description: `Tailored email template for ${industry} businesses`,
        samplePrompt: `Create an email template specifically for ${industry} businesses`
      });
    }

    return suggestions;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}