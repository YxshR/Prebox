export interface PricingTier {
  planId: string;
  planName: string;
  priceAmount: number;
  currency: string;
  billingCycle: string;
  features: string[];
  limits: Record<string, any>;
  isPopular?: boolean;
  isActive?: boolean;
  integrityHash: string;
  tier?: string;
  description?: string;
}

export interface SecurePricingResponse {
  success: boolean;
  data: {
    plans: PricingTier[];
    timestamp: string;
    count: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface PricingValidationResponse {
  success: boolean;
  data?: {
    planId: string;
    validatedAmount?: number;
    validatedCurrency?: string;
    plan?: PricingTier;
    timestamp: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface PricingServiceHealth {
  isHealthy: boolean;
  status: string;
  service: string;
  planCount?: number;
  cacheStatus?: string;
  timestamp: string;
}

export interface PricingLoadingState {
  data?: PricingTier[];
  loading: boolean;
  error?: string;
}

export interface PricingCacheResponse {
  success: boolean;
  data?: {
    message: string;
    timestamp: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface PricingFeature {
  name: string;
  included: boolean;
  limit?: string | number;
  description?: string;
}

export interface PricingComparison {
  feature: string;
  free: string | boolean;
  standard: string | boolean;
  premium: string | boolean;
  enterprise: string | boolean;
}