import { PricingProtectionService } from '../security/pricing-protection.service';
import { SubscriptionService } from '../billing/subscription.service';
import { SubscriptionTier, TierLimits } from '../shared/types';
import pool from '../config/database';
import redisClient from '../config/redis';

export interface PricingPlan {
  id: string;
  tier: SubscriptionTier;
  name: string;
  description: string;
  priceInr: number;
  priceUsd?: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  limits: TierLimits;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingValidationRequest {
  planId: string;
  amount: number;
  currency: string;
  userId?: string;
  tenantId?: string;
}

export interface PricingValidationResult {
  isValid: boolean;
  validatedAmount?: number;
  validatedCurrency?: string;
  plan?: PricingPlan;
  error?: string;
  errorCode?: string;
}

export interface CachedPricingData {
  plans: PricingPlan[];
  lastUpdated: Date;
  version: string;
}

/**
 * PricingValidationService - Comprehensive server-side pricing validation
 * Implements Requirements 4.1, 4.2, 4.3 from system-stability-fixes spec
 */
export class PricingValidationService {
  private readonly pricingProtection: PricingProtectionService;
  private readonly subscriptionService: SubscriptionService;
  private readonly cacheKey = 'pricing:validated_plans';
  private readonly cacheExpiry = 300; // 5 minutes

  constructor() {
    this.pricingProtection = new PricingProtectionService();
    this.subscriptionService = new SubscriptionService();
  }

  /**
   * Get all validated pricing plans with server-side verification
   * Requirement 4.1: Display server-validated pricing information
   */
  async getValidatedPricingPlans(): Promise<PricingPlan[]> {
    try {
      // Try to get from cache first
      const cached = await this.getCachedPricing();
      if (cached) {
        return cached.plans;
      }

      // Get subscription plans from billing service
      const subscriptionPlans = this.subscriptionService.getAllSubscriptionPlans();
      
      // Convert to pricing plans with validation
      const pricingPlans: PricingPlan[] = subscriptionPlans.map(plan => ({
        id: plan.id,
        tier: plan.tier,
        name: plan.name,
        description: plan.description,
        priceInr: plan.priceInr,
        priceUsd: this.convertToUsd(plan.priceInr),
        currency: 'INR',
        billingCycle: 'monthly',
        limits: plan.limits,
        features: plan.features,
        isPopular: plan.tier === SubscriptionTier.PAID_STANDARD,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Validate each plan with pricing protection service
      const validatedPlans: PricingPlan[] = [];
      for (const plan of pricingPlans) {
        try {
          // Create secure pricing data for validation
          const securePricingData = {
            planId: plan.id,
            planName: plan.name,
            priceAmount: plan.priceInr,
            currency: plan.currency,
            billingCycle: plan.billingCycle,
            features: plan.features,
            limits: plan.limits,
            isPopular: plan.isPopular
          };

          // Generate JWT signature for integrity
          const signature = this.pricingProtection.signPricingData(securePricingData);
          
          // Verify the signature immediately to ensure integrity
          const isValid = this.pricingProtection.verifyPricingSignature(
            plan.id,
            plan.priceInr,
            plan.currency,
            plan.billingCycle,
            signature
          );

          if (isValid) {
            validatedPlans.push(plan);
          } else {
            console.error(`Failed to validate pricing plan: ${plan.id}`);
          }
        } catch (error) {
          console.error(`Error validating plan ${plan.id}:`, error);
        }
      }

      // Cache the validated plans
      await this.cachePricing(validatedPlans);

      return validatedPlans;
    } catch (error) {
      console.error('Failed to get validated pricing plans:', error);
      throw new Error('Pricing validation service unavailable');
    }
  }

  /**
   * Validate specific pricing request against server data
   * Requirement 4.2: Fetch current prices from backend with validation
   */
  async validatePricingRequest(request: PricingValidationRequest): Promise<PricingValidationResult> {
    try {
      const { planId, amount, currency, userId, tenantId } = request;

      // Get validated pricing plans
      const plans = await this.getValidatedPricingPlans();
      const plan = plans.find(p => p.id === planId);

      if (!plan) {
        return {
          isValid: false,
          error: 'Pricing plan not found',
          errorCode: 'PLAN_NOT_FOUND'
        };
      }

      if (!plan.isActive) {
        return {
          isValid: false,
          error: 'Pricing plan is not active',
          errorCode: 'PLAN_INACTIVE'
        };
      }

      // Validate currency
      const normalizedCurrency = currency.toUpperCase();
      if (normalizedCurrency !== plan.currency) {
        return {
          isValid: false,
          error: `Invalid currency. Expected ${plan.currency}, got ${normalizedCurrency}`,
          errorCode: 'INVALID_CURRENCY'
        };
      }

      // Validate amount with tolerance for floating point precision
      const tolerance = 0.01;
      const expectedAmount = normalizedCurrency === 'INR' ? plan.priceInr : (plan.priceUsd || 0);
      const amountDifference = Math.abs(amount - expectedAmount);

      if (amountDifference > tolerance) {
        // Log potential tampering attempt
        console.warn('Pricing validation failed - amount mismatch:', {
          planId,
          expectedAmount,
          providedAmount: amount,
          difference: amountDifference,
          userId,
          tenantId,
          timestamp: new Date().toISOString()
        });

        return {
          isValid: false,
          error: `Invalid amount. Expected ${expectedAmount}, got ${amount}`,
          errorCode: 'INVALID_AMOUNT'
        };
      }

      // Use pricing protection service for additional validation
      const protectionValidation = await this.pricingProtection.validatePricing(
        planId,
        expectedAmount,
        normalizedCurrency
      );

      if (!protectionValidation.isValid) {
        return {
          isValid: false,
          error: protectionValidation.error || 'Security validation failed',
          errorCode: 'SECURITY_VALIDATION_FAILED'
        };
      }

      return {
        isValid: true,
        validatedAmount: expectedAmount,
        validatedCurrency: normalizedCurrency,
        plan
      };
    } catch (error) {
      console.error('Pricing validation error:', error);
      return {
        isValid: false,
        error: 'Pricing validation service error',
        errorCode: 'VALIDATION_SERVICE_ERROR'
      };
    }
  }

  /**
   * Get specific pricing plan with validation
   * Requirement 4.1: Display server-validated pricing information
   */
  async getValidatedPricingPlan(planId: string): Promise<PricingPlan | null> {
    try {
      const plans = await this.getValidatedPricingPlans();
      return plans.find(plan => plan.id === planId) || null;
    } catch (error) {
      console.error(`Failed to get validated pricing plan ${planId}:`, error);
      return null;
    }
  }

  /**
   * Validate purchase request with comprehensive checks
   * Requirement 4.3: Ensure data integrity and accuracy
   */
  async validatePurchaseRequest(
    planId: string,
    amount: number,
    currency: string = 'INR',
    userId?: string,
    tenantId?: string
  ): Promise<PricingValidationResult> {
    try {
      // First validate the basic pricing request
      const basicValidation = await this.validatePricingRequest({
        planId,
        amount,
        currency,
        userId,
        tenantId
      });

      if (!basicValidation.isValid) {
        return basicValidation;
      }

      // Additional purchase-specific validations
      const plan = basicValidation.plan!;

      // Check if user can upgrade to this tier (if user context provided)
      if (userId && tenantId) {
        const canUpgrade = await this.validateTierUpgrade(tenantId, plan.tier);
        if (!canUpgrade.allowed) {
          return {
            isValid: false,
            error: canUpgrade.reason || 'Tier upgrade not allowed',
            errorCode: 'UPGRADE_NOT_ALLOWED'
          };
        }
      }

      // Use pricing protection service for purchase validation
      const purchaseValidation = await this.pricingProtection.validatePurchaseRequest(
        planId,
        amount,
        userId
      );

      if (!purchaseValidation.isValid) {
        return {
          isValid: false,
          error: purchaseValidation.error || 'Purchase validation failed',
          errorCode: 'PURCHASE_VALIDATION_FAILED'
        };
      }

      return {
        isValid: true,
        validatedAmount: purchaseValidation.serverAmount,
        validatedCurrency: currency.toUpperCase(),
        plan
      };
    } catch (error) {
      console.error('Purchase validation error:', error);
      return {
        isValid: false,
        error: 'Purchase validation service error',
        errorCode: 'PURCHASE_VALIDATION_ERROR'
      };
    }
  }

  /**
   * Refresh pricing cache
   * Requirement 4.2: Add caching mechanism for pricing data
   */
  async refreshPricingCache(): Promise<void> {
    try {
      // Clear existing cache
      await redisClient.del(this.cacheKey);
      
      // Reload pricing plans
      await this.getValidatedPricingPlans();
      
      console.log('Pricing cache refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh pricing cache:', error);
      throw error;
    }
  }

  /**
   * Get pricing cache statistics
   */
  async getCacheStatistics(): Promise<{
    isCached: boolean;
    lastUpdated?: Date;
    version?: string;
    planCount?: number;
  }> {
    try {
      const cached = await this.getCachedPricing();
      
      if (cached) {
        return {
          isCached: true,
          lastUpdated: cached.lastUpdated,
          version: cached.version,
          planCount: cached.plans.length
        };
      }

      return { isCached: false };
    } catch (error) {
      console.error('Failed to get cache statistics:', error);
      return { isCached: false };
    }
  }

  // Private helper methods

  private async getCachedPricing(): Promise<CachedPricingData | null> {
    try {
      const cached = await redisClient.get(this.cacheKey);
      if (cached) {
        const data = JSON.parse(cached) as CachedPricingData;
        // Check if cache is still valid (not expired)
        const cacheAge = Date.now() - new Date(data.lastUpdated).getTime();
        if (cacheAge < this.cacheExpiry * 1000) {
          return data;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached pricing:', error);
      return null;
    }
  }

  private async cachePricing(plans: PricingPlan[]): Promise<void> {
    try {
      const cacheData: CachedPricingData = {
        plans,
        lastUpdated: new Date(),
        version: this.generateCacheVersion()
      };

      await redisClient.setex(
        this.cacheKey,
        this.cacheExpiry,
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.error('Failed to cache pricing:', error);
      // Don't throw error to avoid disrupting main flow
    }
  }

  private generateCacheVersion(): string {
    return `v${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private convertToUsd(inrAmount: number): number {
    // Simple conversion rate - in production, this should use real-time rates
    const usdToInrRate = 83; // Approximate rate
    return Math.round((inrAmount / usdToInrRate) * 100) / 100;
  }

  private async validateTierUpgrade(
    tenantId: string,
    targetTier: SubscriptionTier
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Get current subscription
      const subscription = await this.subscriptionService.getSubscriptionByTenantId(tenantId);
      
      if (!subscription) {
        return { allowed: true }; // New subscription
      }

      // Get current plan
      const currentPlan = this.subscriptionService.getSubscriptionPlan(subscription.limits as any);
      
      if (!currentPlan) {
        return { allowed: true }; // No current plan found
      }

      // Check if it's actually an upgrade
      const tierOrder = [
        SubscriptionTier.FREE,
        SubscriptionTier.PAID_STANDARD,
        SubscriptionTier.PREMIUM,
        SubscriptionTier.ENTERPRISE
      ];

      const currentIndex = tierOrder.indexOf(currentPlan.tier);
      const targetIndex = tierOrder.indexOf(targetTier);

      if (targetIndex <= currentIndex && targetTier !== SubscriptionTier.FREE) {
        return {
          allowed: false,
          reason: 'Cannot downgrade to a lower tier. Please contact support.'
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Failed to validate tier upgrade:', error);
      return { allowed: true }; // Allow by default on error
    }
  }
}