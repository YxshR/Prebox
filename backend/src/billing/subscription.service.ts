import { SubscriptionTier, Subscription, UsageMetrics, TierLimits, BillingSubscriptionStatus } from '../shared/types';

export interface SubscriptionPlan {
  id: string;
  tier: SubscriptionTier;
  name: string;
  description: string;
  priceInr: number;
  limits: TierLimits;
  features: string[];
  rechargeOptions?: {
    min: number;
    max: number;
  };
}

export interface UsageTrackingData {
  userId: string;
  tenantId: string;
  emailsSent: number;
  recipientsReached: number;
  templatesCreated: number;
  customDomainsUsed: number;
  timestamp: Date;
}

export interface TierUpgradeRequest {
  userId: string;
  currentTier: SubscriptionTier;
  targetTier: SubscriptionTier;
  paymentMethod?: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  quotaType: 'daily_emails' | 'monthly_emails' | 'monthly_recipients' | 'templates' | 'custom_domains';
  currentUsage: number;
  limit: number;
  resetDate?: Date;
}

export class SubscriptionService {
  private subscriptionPlans: Map<SubscriptionTier, SubscriptionPlan>;

  constructor() {
    this.subscriptionPlans = new Map();
    this.initializeSubscriptionPlans();
  }

  /**
   * Initialize subscription plans with tier-specific limits based on requirements
   */
  private initializeSubscriptionPlans(): void {
    // Free Tier - Requirements 11.1
    this.subscriptionPlans.set(SubscriptionTier.FREE, {
      id: 'free-tier',
      tier: SubscriptionTier.FREE,
      name: 'Free',
      description: 'Basic email sending with ads and branding',
      priceInr: 0,
      limits: {
        dailyEmailLimit: 100,
        monthlyRecipientLimit: 300,
        monthlyEmailLimit: 2000,
        templateLimit: 1, // 1 AI template daily
        customDomainLimit: 0,
        hasLogoCustomization: false,
        hasCustomDomains: false,
        hasAdvancedAnalytics: false
      },
      features: [
        '100 emails per day',
        '300 recipients per month',
        '2000 emails per month',
        '1 AI template daily',
        'Ads included in emails',
        'Website branding attached',
        '3-day email history storage'
      ]
    });

    // Paid Standard Tier - Requirements 11.2
    this.subscriptionPlans.set(SubscriptionTier.PAID_STANDARD, {
      id: 'paid-standard-tier',
      tier: SubscriptionTier.PAID_STANDARD,
      name: 'Paid Standard',
      description: 'Enhanced features with logo customization',
      priceInr: 59, // ₹39-59 + GST (using max value)
      limits: {
        dailyEmailLimit: 1000,
        monthlyRecipientLimit: 5000,
        monthlyEmailLimit: 30000,
        templateLimit: 10, // 10 AI/Custom templates daily
        customDomainLimit: 0,
        hasLogoCustomization: true,
        hasCustomDomains: false,
        hasAdvancedAnalytics: false
      },
      features: [
        '500-1000 emails per day',
        '1500-5000 recipients per month',
        '10000-30000 emails per month',
        '10 AI/Custom templates daily',
        'Logo customization available',
        'Website branding attached',
        'Full email history storage',
        'Recharge: 500 recipients for ₹10'
      ],
      rechargeOptions: {
        min: 50,
        max: 1000
      }
    });

    // Premium Tier - Requirements 11.3
    this.subscriptionPlans.set(SubscriptionTier.PREMIUM, {
      id: 'premium-tier',
      tier: SubscriptionTier.PREMIUM,
      name: 'Premium',
      description: 'Advanced features with custom business emails',
      priceInr: 649, // ₹249-649 + GST (using max value)
      limits: {
        dailyEmailLimit: 5000,
        monthlyRecipientLimit: 25000,
        monthlyEmailLimit: 100000,
        templateLimit: -1, // Unlimited templates
        customDomainLimit: 10, // 2-10 custom business emails
        hasLogoCustomization: true,
        hasCustomDomains: true,
        hasAdvancedAnalytics: true
      },
      features: [
        '2000-5000 emails per day',
        '10000-25000 recipients per month',
        '50000-100000 emails per month',
        'Unlimited AI/Custom templates',
        'Logo customization',
        '2-10 custom business emails',
        'Full subscriber management',
        'Complete email history',
        'Recharge: 500 recipients for ₹10'
      ],
      rechargeOptions: {
        min: 1500,
        max: 10000
      }
    });

    // Enterprise Tier - Requirements 11.4
    this.subscriptionPlans.set(SubscriptionTier.ENTERPRISE, {
      id: 'enterprise-tier',
      tier: SubscriptionTier.ENTERPRISE,
      name: 'Enterprise',
      description: 'Fully customizable with unlimited features',
      priceInr: 0, // Custom pricing
      limits: {
        dailyEmailLimit: -1, // Unlimited
        monthlyRecipientLimit: -1, // Unlimited
        monthlyEmailLimit: -1, // Unlimited
        templateLimit: -1, // Unlimited
        customDomainLimit: -1, // Unlimited
        hasLogoCustomization: true,
        hasCustomDomains: true,
        hasAdvancedAnalytics: true
      },
      features: [
        'Customizable email limits per day',
        'Customizable recipients per month',
        'Customizable email quotas',
        'Unlimited templates',
        'Full customization options',
        'Unlimited custom business emails',
        'Advanced subscriber management',
        'Complete feature access',
        'Dedicated support'
      ]
    });
  }

  /**
   * Get subscription plan by tier
   */
  getSubscriptionPlan(tier: SubscriptionTier): SubscriptionPlan | null {
    return this.subscriptionPlans.get(tier) || null;
  }

  /**
   * Get all available subscription plans
   */
  getAllSubscriptionPlans(): SubscriptionPlan[] {
    return Array.from(this.subscriptionPlans.values());
  }

  /**
   * Create a new subscription for a user
   */
  async createSubscription(
    tenantId: string,
    tier: SubscriptionTier = SubscriptionTier.FREE
  ): Promise<Subscription> {
    const plan = this.getSubscriptionPlan(tier);
    if (!plan) {
      throw new Error(`Invalid subscription tier: ${tier}`);
    }

    const now = new Date();
    const subscription: Subscription = {
      id: this.generateSubscriptionId(),
      tenantId,
      planId: plan.id,
      status: BillingSubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: this.calculatePeriodEnd(now),
      usage: this.initializeUsageMetrics(),
      limits: plan.limits,
      rechargeBalance: 0
    };

    // TODO: Save to database
    return subscription;
  }

  /**
   * Track usage for emails, recipients, and templates
   */
  async trackUsage(data: UsageTrackingData): Promise<void> {
    // TODO: Implement database operations
    // This would typically:
    // 1. Get current subscription for tenant
    // 2. Update usage metrics
    // 3. Check if daily/monthly limits need reset
    // 4. Save updated usage to database
    
    console.log('Tracking usage:', data);
  }

  /**
   * Check if user can perform an action based on quota limits
   */
  async checkQuota(
    tenantId: string,
    quotaType: 'daily_emails' | 'monthly_emails' | 'monthly_recipients' | 'templates' | 'custom_domains',
    requestedAmount: number = 1
  ): Promise<QuotaCheckResult> {
    // TODO: Get subscription from database
    // For now, using mock data
    const subscription = await this.getSubscriptionByTenantId(tenantId);
    
    if (!subscription) {
      return {
        allowed: false,
        quotaType,
        currentUsage: 0,
        limit: 0
      };
    }

    const { usage, limits } = subscription;
    let currentUsage: number;
    let limit: number;
    let resetDate: Date | undefined;

    switch (quotaType) {
      case 'daily_emails':
        currentUsage = usage.dailyEmailsSent;
        limit = limits.dailyEmailLimit;
        resetDate = this.getNextDayReset();
        break;
      case 'monthly_emails':
        currentUsage = usage.monthlyEmailsSent;
        limit = limits.monthlyEmailLimit;
        resetDate = this.getNextMonthReset();
        break;
      case 'monthly_recipients':
        currentUsage = usage.uniqueRecipients;
        limit = limits.monthlyRecipientLimit;
        resetDate = this.getNextMonthReset();
        break;
      case 'templates':
        currentUsage = usage.templatesCreated;
        limit = limits.templateLimit;
        resetDate = this.getNextDayReset(); // Templates reset daily
        break;
      case 'custom_domains':
        currentUsage = usage.customDomainsUsed;
        limit = limits.customDomainLimit;
        break;
      default:
        throw new Error(`Invalid quota type: ${quotaType}`);
    }

    // -1 means unlimited
    const allowed = limit === -1 || (currentUsage + requestedAmount) <= limit;

    return {
      allowed,
      quotaType,
      currentUsage,
      limit,
      resetDate
    };
  }

  /**
   * Upgrade or downgrade subscription tier
   */
  async changeTier(request: TierUpgradeRequest): Promise<Subscription> {
    const { userId, currentTier, targetTier } = request;
    
    // Validate tier change
    if (currentTier === targetTier) {
      throw new Error('Target tier is the same as current tier');
    }

    const targetPlan = this.getSubscriptionPlan(targetTier);
    if (!targetPlan) {
      throw new Error(`Invalid target tier: ${targetTier}`);
    }

    // TODO: Get subscription from database
    const subscription = await this.getSubscriptionByUserId(userId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Handle payment for upgrades (except to Free tier)
    if (targetTier !== SubscriptionTier.FREE && targetPlan.priceInr > 0) {
      await this.processPayment(userId, targetPlan.priceInr, request.paymentMethod);
    }

    // Update subscription
    subscription.planId = targetPlan.id;
    subscription.limits = targetPlan.limits;
    
    // Reset usage if downgrading to ensure compliance with new limits
    if (this.isDowngrade(currentTier, targetTier)) {
      subscription.usage = this.initializeUsageMetrics();
    }

    // TODO: Save to database
    return subscription;
  }

  /**
   * Add recharge balance to subscription
   */
  async addRechargeBalance(tenantId: string, amount: number): Promise<Subscription> {
    const subscription = await this.getSubscriptionByTenantId(tenantId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const plan = this.getSubscriptionPlan(subscription.limits as any);
    if (!plan?.rechargeOptions) {
      throw new Error('Recharge not available for this tier');
    }

    if (amount < plan.rechargeOptions.min || amount > plan.rechargeOptions.max) {
      throw new Error(`Recharge amount must be between ₹${plan.rechargeOptions.min} and ₹${plan.rechargeOptions.max}`);
    }

    subscription.rechargeBalance += amount;
    
    // TODO: Save to database
    return subscription;
  }

  /**
   * Calculate recipients for recharge amount
   * Standard pricing: 500 recipients for ₹10
   */
  calculateRechargeRecipients(amount: number): number {
    const recipientsPerRupee = 500 / 10; // 50 recipients per rupee
    return Math.floor(amount * recipientsPerRupee);
  }

  /**
   * Calculate cost for recipients
   * Standard pricing: 500 recipients for ₹10
   */
  calculateRecipientCost(recipients: number): number {
    const costPerRecipient = 10 / 500; // ₹0.02 per recipient
    return recipients * costPerRecipient;
  }

  /**
   * Get recharge pricing information
   */
  getRechargeInfo(): {
    standardRate: { recipients: number; cost: number };
    minimumRecharge: number;
    description: string;
  } {
    return {
      standardRate: {
        recipients: 500,
        cost: 10
      },
      minimumRecharge: 10,
      description: 'All users get 500 recipients for ₹10. Available for both subscription and recharge users.'
    };
  }

  // Helper methods
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculatePeriodEnd(start: Date): Date {
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return end;
  }

  private initializeUsageMetrics(): UsageMetrics {
    return {
      dailyEmailsSent: 0,
      monthlyEmailsSent: 0,
      uniqueRecipients: 0,
      templatesCreated: 0,
      customDomainsUsed: 0,
      lastResetDate: new Date()
    };
  }

  private getNextDayReset(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private getNextMonthReset(): Date {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }

  private isDowngrade(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
    const tierOrder = [
      SubscriptionTier.FREE,
      SubscriptionTier.PAID_STANDARD,
      SubscriptionTier.PREMIUM,
      SubscriptionTier.ENTERPRISE
    ];
    
    const currentIndex = tierOrder.indexOf(currentTier);
    const targetIndex = tierOrder.indexOf(targetTier);
    
    return targetIndex < currentIndex;
  }

  private async processPayment(userId: string, amount: number, paymentMethod?: string): Promise<void> {
    // TODO: Integrate with Stripe/Razorpay
    console.log(`Processing payment of ₹${amount} for user ${userId} using ${paymentMethod}`);
  }

  // Public methods for external access
  async getSubscriptionByTenantId(tenantId: string): Promise<Subscription | null> {
    // TODO: Implement database query
    return null;
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    // TODO: Implement database query
    return null;
  }
}