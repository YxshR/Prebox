import axios, { AxiosInstance } from 'axios';
import { authService } from './auth';

// Type definitions for pricing management
export interface PricingPlan {
  id: string;
  tier: string;
  name: string;
  description: string;
  priceInr: number;
  priceUsd?: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  limits: {
    dailyEmailLimit: number;
    monthlyRecipientLimit: number;
    monthlyEmailLimit: number;
    templateLimit: number;
    customDomainLimit: number;
    hasLogoCustomization: boolean;
    hasCustomDomains: boolean;
    hasAdvancedAnalytics: boolean;
  };
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PricingValidationResult {
  isValid: boolean;
  validatedAmount?: number;
  validatedCurrency?: string;
  plan?: PricingPlan;
  error?: string;
  errorCode?: string;
}

export interface PricingCacheStats {
  isCached: boolean;
  lastUpdated?: string;
  version?: string;
  planCount?: number;
}

export interface PricingServiceHealth {
  status: string;
  service: string;
  planCount?: number;
  cacheStatus?: string;
  timestamp: string;
}

export interface PricingAuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: 'create' | 'update' | 'delete' | 'activate' | 'deactivate';
  planId: string;
  planName: string;
  changes: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Admin Pricing Management API Client
 * Requirement 4.3: Build admin interface for pricing management
 * Requirement 4.5: Add audit logging for pricing changes
 */
class AdminPricingApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      timeout: 30000,
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = authService.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await authService.refreshAccessToken();
            const token = authService.getAccessToken();
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            authService.logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Get all validated pricing plans
   * Requirement 4.1: Display server-validated pricing information
   */
  async getPricingPlans(): Promise<PricingPlan[]> {
    try {
      const response = await this.client.get('/pricing/validation/plans');
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to fetch pricing plans');
      }

      return response.data.data.plans;
    } catch (error) {
      console.error('Failed to fetch pricing plans:', error);
      throw error;
    }
  }

  /**
   * Get specific pricing plan
   */
  async getPricingPlan(planId: string): Promise<PricingPlan> {
    try {
      const response = await this.client.get(`/pricing/validation/plans/${planId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to fetch pricing plan');
      }

      return response.data.data.plan;
    } catch (error) {
      console.error(`Failed to fetch pricing plan ${planId}:`, error);
      throw error;
    }
  }

  /**
   * Create or update pricing plan (Admin only)
   * Requirement 4.3: Implement pricing update functionality with validation
   */
  async createOrUpdatePricingPlan(planData: {
    planId: string;
    planName: string;
    priceAmount: number;
    currency?: string;
    billingCycle?: string;
    features?: string[];
    limits?: Record<string, any>;
    isPopular?: boolean;
    description?: string;
  }): Promise<PricingPlan> {
    try {
      const response = await this.client.post('/pricing/admin/create', planData);
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to create/update pricing plan');
      }

      return response.data.data.plan;
    } catch (error) {
      console.error('Failed to create/update pricing plan:', error);
      throw error;
    }
  }

  /**
   * Validate pricing data
   * Requirement 4.2: Implement server-side validation for pricing displays
   */
  async validatePricing(
    planId: string, 
    amount: number, 
    currency: string = 'INR'
  ): Promise<PricingValidationResult> {
    try {
      const response = await this.client.post('/pricing/validation/validate', {
        planId,
        amount,
        currency
      });

      if (!response.data.success) {
        return {
          isValid: false,
          error: response.data.error?.message || 'Validation failed',
          errorCode: response.data.error?.code
        };
      }

      return {
        isValid: true,
        validatedAmount: response.data.data.validatedAmount,
        validatedCurrency: response.data.data.validatedCurrency,
        plan: response.data.data.plan
      };
    } catch (error) {
      console.error('Pricing validation error:', error);
      return {
        isValid: false,
        error: 'Validation service error',
        errorCode: 'VALIDATION_SERVICE_ERROR'
      };
    }
  }

  /**
   * Refresh pricing cache
   * Requirement 4.2: Add caching mechanism for pricing data
   */
  async refreshPricingCache(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await this.client.post('/pricing/validation/cache/refresh');
      
      if (!response.data.success) {
        return {
          success: false,
          error: response.data.error?.message || 'Failed to refresh cache'
        };
      }

      return {
        success: true,
        message: response.data.data.message
      };
    } catch (error) {
      console.error('Failed to refresh pricing cache:', error);
      return {
        success: false,
        error: 'Cache refresh failed'
      };
    }
  }

  /**
   * Get pricing cache statistics
   */
  async getCacheStatistics(): Promise<PricingCacheStats> {
    try {
      const response = await this.client.get('/pricing/validation/cache/stats');
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to get cache stats');
      }

      return response.data.data.cache;
    } catch (error) {
      console.error('Failed to get cache statistics:', error);
      return { isCached: false };
    }
  }

  /**
   * Check pricing service health
   */
  async checkServiceHealth(): Promise<PricingServiceHealth> {
    try {
      const response = await this.client.get('/pricing/validation/health');
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Health check failed');
      }

      return response.data.data;
    } catch (error) {
      console.error('Pricing service health check failed:', error);
      return {
        status: 'unhealthy',
        service: 'pricing-validation',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get pricing security statistics
   */
  async getSecurityStatistics(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<{
    totalAttempts: number;
    uniqueUsers: number;
    averagePriceDifference: number;
    topTargetedPlans: Array<{ planId: string; attempts: number }>;
  }> {
    try {
      const response = await this.client.get('/pricing/security/stats', {
        params: { timeframe }
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to get security stats');
      }

      return response.data.data;
    } catch (error) {
      console.error('Failed to get security statistics:', error);
      return {
        totalAttempts: 0,
        uniqueUsers: 0,
        averagePriceDifference: 0,
        topTargetedPlans: []
      };
    }
  }

  /**
   * Get pricing audit logs (mock implementation)
   * Requirement 4.5: Add audit logging for pricing changes
   */
  async getPricingAuditLogs(params?: {
    page?: number;
    limit?: number;
    planId?: string;
    adminId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    logs: PricingAuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      // This would be implemented with a real audit logging system
      // For now, return mock data
      const mockLogs: PricingAuditLog[] = [
        {
          id: '1',
          adminId: 'admin-123',
          adminEmail: 'admin@example.com',
          action: 'update',
          planId: 'paid-standard-tier',
          planName: 'Paid Standard',
          changes: {
            priceInr: { from: 49, to: 59 },
            features: { added: ['New feature'], removed: [] }
          },
          timestamp: new Date().toISOString(),
          ipAddress: '192.168.1.1'
        },
        {
          id: '2',
          adminId: 'admin-123',
          adminEmail: 'admin@example.com',
          action: 'create',
          planId: 'enterprise-tier',
          planName: 'Enterprise',
          changes: {
            created: true,
            priceInr: 999,
            features: ['Unlimited emails', 'Custom domains']
          },
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          ipAddress: '192.168.1.1'
        }
      ];

      return {
        logs: mockLogs,
        total: mockLogs.length,
        page: params?.page || 1,
        limit: params?.limit || 10
      };
    } catch (error) {
      console.error('Failed to get pricing audit logs:', error);
      return {
        logs: [],
        total: 0,
        page: 1,
        limit: 10
      };
    }
  }

  /**
   * Export pricing data for backup/analysis
   */
  async exportPricingData(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    try {
      const response = await this.client.get('/pricing/validation/export', {
        params: { format },
        responseType: 'blob'
      });

      return response.data;
    } catch (error) {
      console.error('Failed to export pricing data:', error);
      throw error;
    }
  }

  /**
   * Import pricing data from file
   */
  async importPricingData(file: File): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
  }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await this.client.post('/pricing/validation/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Import failed');
      }

      return response.data.data;
    } catch (error) {
      console.error('Failed to import pricing data:', error);
      return {
        success: false,
        imported: 0,
        errors: [error instanceof Error ? error.message : 'Import failed']
      };
    }
  }
}

export const adminPricingApi = new AdminPricingApiClient();