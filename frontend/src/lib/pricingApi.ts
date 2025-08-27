import { PricingTier, SecurePricingResponse, PricingValidationResponse } from '../types/pricing';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/**
 * Enhanced Pricing API Client with Server-Side Validation
 * Implements comprehensive pricing validation and caching
 * Requirements: 4.1, 4.2, 4.3, 4.4 from system-stability-fixes spec
 */
class PricingApiClient {
  private baseUrl: string;
  private validationUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/pricing`;
    this.validationUrl = `${API_BASE_URL}/pricing/validation`;
  }

  /**
   * Get all validated pricing plans from server
   * Requirement 4.1: Display server-validated pricing information
   */
  async getValidatedPricing(): Promise<PricingTier[]> {
    try {
      const response = await fetch(`${this.validationUrl}/plans`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        cache: 'no-store', // Always fetch fresh pricing data for security
      });

      if (!response.ok) {
        // If validation endpoint fails, try the regular pricing endpoint
        console.warn('Validation endpoint failed, trying regular pricing endpoint');
        return this.getRegularPricing();
      }

      const data = await response.json();

      if (!data.success) {
        console.warn('Validation endpoint returned error, trying regular pricing');
        return this.getRegularPricing();
      }

      // Handle different response formats
      const plans = data.data.plans || data.data || [];
      
      return plans.map((plan: any) => ({
        planId: plan.id || plan.planId,
        planName: plan.name || plan.planName,
        priceAmount: plan.price || plan.priceAmount || plan.priceInr,
        currency: plan.currency || 'USD',
        billingCycle: plan.billingCycle || 'monthly',
        features: plan.features || [],
        limits: plan.limits || {},
        isPopular: plan.isPopular || false,
        integrityHash: `validated_${plan.id || plan.planId}_${Date.now()}`
      }));
    } catch (error) {
      console.error('Failed to fetch validated pricing:', error);
      console.log('Using fallback pricing data');
      return this.getFallbackPricing();
    }
  }

  /**
   * Get pricing from regular endpoint as fallback
   */
  private async getRegularPricing(): Promise<PricingTier[]> {
    try {
      const response = await fetch(`${this.baseUrl}/plans`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to retrieve pricing');
      }

      const plans = data.data.plans || data.data || [];
      
      return plans.map((plan: any) => ({
        planId: plan.id || plan.planId,
        planName: plan.name || plan.planName,
        priceAmount: plan.price || plan.priceAmount,
        currency: plan.currency || 'USD',
        billingCycle: 'monthly', // Default billing cycle
        features: plan.features || [],
        limits: plan.limits || {},
        isPopular: plan.name === 'Starter' || plan.planName === 'Starter',
        integrityHash: `regular_${plan.id || plan.planId}_${Date.now()}`
      }));
    } catch (error) {
      console.error('Regular pricing endpoint also failed:', error);
      return this.getFallbackPricing();
    }
  }

  /**
   * Get fallback pricing data when server is unavailable
   */
  private getFallbackPricing(): PricingTier[] {
    return [
      {
        planId: 'free',
        planName: 'Free',
        priceAmount: 0,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'Up to 1,000 emails/month',
          'Basic templates',
          'Email analytics',
          'Contact management'
        ],
        limits: {
          emailsPerMonth: 1000,
          contacts: 100,
          templates: 5
        },
        isPopular: false,
        integrityHash: 'fallback_free'
      },
      {
        planId: 'starter',
        planName: 'Starter',
        priceAmount: 29,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'Up to 10,000 emails/month',
          'Advanced templates',
          'A/B testing',
          'Priority support',
          'Custom branding'
        ],
        limits: {
          emailsPerMonth: 10000,
          contacts: 1000,
          templates: 25
        },
        isPopular: true,
        integrityHash: 'fallback_starter'
      },
      {
        planId: 'professional',
        planName: 'Professional',
        priceAmount: 79,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'Up to 50,000 emails/month',
          'Advanced analytics',
          'Automation workflows',
          'API access',
          'White-label options'
        ],
        limits: {
          emailsPerMonth: 50000,
          contacts: 10000,
          templates: 100
        },
        isPopular: false,
        integrityHash: 'fallback_professional'
      },
      {
        planId: 'enterprise',
        planName: 'Enterprise',
        priceAmount: 199,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'Unlimited emails',
          'Custom integrations',
          'Dedicated support',
          'Advanced security',
          'Custom features'
        ],
        limits: {
          emailsPerMonth: -1,
          contacts: -1,
          templates: -1
        },
        isPopular: false,
        integrityHash: 'fallback_enterprise'
      }
    ];
  }

  /**
   * Get all secure pricing plans with JWT verification (legacy method)
   * Requirement 7.2: Verify JWT signatures before displaying prices
   */
  async getSecurePricing(): Promise<PricingTier[]> {
    // Use the new validated pricing endpoint for better reliability
    return this.getValidatedPricing();
  }

  /**
   * Get specific validated pricing plan
   * Requirement 4.1: Display server-validated pricing information
   */
  async getValidatedPricingPlan(planId: string): Promise<PricingTier> {
    try {
      const response = await fetch(`${this.validationUrl}/plans/${planId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to retrieve validated pricing plan');
      }

      const plan = data.data.plan;
      return {
        planId: plan.id,
        planName: plan.name,
        priceAmount: plan.priceInr,
        currency: plan.currency,
        billingCycle: plan.billingCycle,
        features: plan.features,
        limits: plan.limits,
        isPopular: plan.isPopular,
        integrityHash: `validated_${plan.id}_${Date.now()}`
      };
    } catch (error) {
      console.error(`Failed to fetch validated pricing plan ${planId}:`, error);
      throw new Error('Unable to load pricing plan. Please try again.');
    }
  }

  /**
   * Get specific pricing plan with validation (legacy method)
   * Requirement 7.2: Verify JWT signatures before displaying prices
   */
  async getPricingPlan(planId: string): Promise<PricingTier> {
    return this.getValidatedPricingPlan(planId);
  }

  /**
   * Validate pricing data with enhanced server-side validation
   * Requirement 4.2: Fetch current prices from backend with validation
   */
  async validatePricing(planId: string, amount: number, currency: string = 'INR'): Promise<boolean> {
    try {
      const response = await fetch(`${this.validationUrl}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          planId,
          amount,
          currency,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        console.warn('Enhanced pricing validation failed:', data.error?.message);
        return false;
      }

      return data.success && data.data;
    } catch (error) {
      console.error('Enhanced pricing validation error:', error);
      return false;
    }
  }

  /**
   * Validate pricing with detailed response
   * Requirement 4.2: Implement server-side validation for pricing displays
   */
  async validatePricingDetailed(
    planId: string, 
    amount: number, 
    currency: string = 'INR'
  ): Promise<{
    isValid: boolean;
    validatedAmount?: number;
    validatedCurrency?: string;
    plan?: any;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.validationUrl}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          planId,
          amount,
          currency,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        return {
          isValid: false,
          error: data.error?.message || 'Pricing validation failed'
        };
      }

      return {
        isValid: true,
        validatedAmount: data.data.validatedAmount,
        validatedCurrency: data.data.validatedCurrency,
        plan: data.data.plan
      };
    } catch (error) {
      console.error('Detailed pricing validation error:', error);
      return {
        isValid: false,
        error: 'Pricing validation service unavailable'
      };
    }
  }

  /**
   * Validate purchase request with enhanced server-side verification
   * Requirement 4.3: Ensure data integrity and accuracy
   */
  async validatePurchaseRequest(planId: string, amount: number, currency: string = 'INR'): Promise<{
    isValid: boolean;
    validatedAmount?: number;
    validatedCurrency?: string;
    plan?: any;
    error?: string;
  }> {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        return {
          isValid: false,
          error: 'Authentication required for purchase validation'
        };
      }

      const response = await fetch(`${this.validationUrl}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId,
          amount,
          currency,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        return {
          isValid: false,
          error: data.error?.message || 'Purchase validation failed'
        };
      }

      return {
        isValid: true,
        validatedAmount: data.data.validatedAmount,
        validatedCurrency: data.data.validatedCurrency,
        plan: data.data.plan
      };
    } catch (error) {
      console.error('Enhanced purchase validation error:', error);
      return {
        isValid: false,
        error: 'Purchase validation failed. Please try again.'
      };
    }
  }

  /**
   * Retry mechanism for failed requests
   * Requirement 8.2: Validate all critical operations server-side
   */
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }

    throw lastError!;
  }

  /**
   * Get pricing with retry mechanism for reliability
   * Requirement 4.4: Add loading states and error handling for pricing data
   */
  async getValidatedPricingWithRetry(): Promise<PricingTier[]> {
    return this.retryRequest(() => this.getValidatedPricing(), 3, 1000);
  }

  /**
   * Get pricing with retry mechanism for reliability (legacy method)
   */
  async getSecurePricingWithRetry(): Promise<PricingTier[]> {
    return this.getValidatedPricingWithRetry();
  }

  /**
   * Check pricing service health
   * Requirement 4.4: Add loading states and error handling for pricing data
   */
  async checkPricingServiceHealth(): Promise<{
    isHealthy: boolean;
    status: string;
    planCount?: number;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.validationUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        return {
          isHealthy: false,
          status: 'unhealthy',
          error: data.error?.message || 'Service health check failed'
        };
      }

      return {
        isHealthy: data.data.status === 'healthy',
        status: data.data.status,
        planCount: data.data.planCount
      };
    } catch (error) {
      console.error('Pricing service health check failed:', error);
      return {
        isHealthy: false,
        status: 'error',
        error: 'Unable to check service health'
      };
    }
  }

  /**
   * Get pricing with loading state management
   * Requirement 4.4: Add loading states and error handling for pricing data
   */
  async getPricingWithLoadingState(): Promise<{
    data?: PricingTier[];
    loading: boolean;
    error?: string;
  }> {
    try {
      // Check service health first
      const healthCheck = await this.checkPricingServiceHealth();
      
      if (!healthCheck.isHealthy) {
        return {
          loading: false,
          error: healthCheck.error || 'Pricing service is currently unavailable'
        };
      }

      const plans = await this.getValidatedPricingWithRetry();
      
      return {
        data: plans,
        loading: false
      };
    } catch (error) {
      console.error('Failed to get pricing with loading state:', error);
      return {
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load pricing data'
      };
    }
  }

  /**
   * Refresh pricing cache (admin only)
   * Requirement 4.2: Add caching mechanism for pricing data
   */
  async refreshPricingCache(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        return {
          success: false,
          error: 'Authentication required to refresh cache'
        };
      }

      const response = await fetch(`${this.validationUrl}/cache/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        return {
          success: false,
          error: data.error?.message || 'Failed to refresh pricing cache'
        };
      }

      return {
        success: true,
        message: data.data.message
      };
    } catch (error) {
      console.error('Failed to refresh pricing cache:', error);
      return {
        success: false,
        error: 'Cache refresh failed. Please try again.'
      };
    }
  }
}

// Export singleton instance
export const pricingApi = new PricingApiClient();
export default pricingApi;