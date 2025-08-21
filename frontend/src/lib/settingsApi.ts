import api from './api';

export interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  key?: string; // Only present when creating new key
}

export interface ApiKeyCreateRequest {
  name: string;
  scopes: string[];
  expiresAt?: Date;
}

export interface ApiKeyUsage {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  dataTransferred: number;
  uniqueEndpoints: number;
  lastUsed?: Date;
}

export interface ApiKeyLimits {
  maxKeys: number;
  rateLimits: {
    hourly: number;
    daily: number;
    monthly: number;
  };
}

export interface AvailableScopes {
  availableScopes: string[];
  limits: ApiKeyLimits;
  currentTier: string;
}

export interface UserSettings {
  emailNotifications: boolean;
  webhookUrl?: string;
  timezone: string;
  language: string;
}

export class SettingsApi {
  // API Key Management
  async createApiKey(request: ApiKeyCreateRequest): Promise<ApiKey> {
    const response = await api.post('/auth/api-keys', request);
    return response.data.data;
  }

  async listApiKeys(): Promise<ApiKey[]> {
    const response = await api.get('/auth/api-keys');
    return response.data.data.apiKeys;
  }

  async getApiKeyUsage(keyId: string, days: number = 30): Promise<ApiKeyUsage> {
    const response = await api.get(`/auth/api-keys/${keyId}/usage?days=${days}`);
    return response.data.data;
  }

  async updateApiKey(keyId: string, updates: Partial<ApiKeyCreateRequest>): Promise<void> {
    await api.put(`/auth/api-keys/${keyId}`, updates);
  }

  async revokeApiKey(keyId: string): Promise<void> {
    await api.delete(`/auth/api-keys/${keyId}`);
  }

  async getAvailableScopes(): Promise<AvailableScopes> {
    const response = await api.get('/auth/api-keys/scopes');
    return response.data.data;
  }

  async testApiKey(): Promise<any> {
    const response = await api.get('/auth/api-keys/test');
    return response.data.data;
  }

  // User Settings
  async getUserSettings(): Promise<UserSettings> {
    const response = await api.get('/settings');
    return response.data.data;
  }

  async updateUserSettings(settings: Partial<UserSettings>): Promise<void> {
    await api.put('/settings', settings);
  }

  // Subscription and Billing Info
  async getSubscriptionInfo(): Promise<any> {
    const response = await api.get('/billing/subscription');
    return response.data;
  }

  async getUsageStats(period: string = '30d'): Promise<any> {
    const response = await api.get(`/billing/usage?period=${period}`);
    return response.data;
  }

  async getBillingHistory(params: { type?: string; limit?: number; offset?: number } = {}): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params.type) queryParams.append('type', params.type);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());
    
    const response = await api.get(`/billing/history?${queryParams.toString()}`);
    return response.data;
  }

  async getAnalytics(period: string = '30d'): Promise<any> {
    const response = await api.get(`/billing/analytics?period=${period}`);
    return response.data;
  }

  async processRecharge(data: { amount: number; paymentMethodId?: string; provider?: string }): Promise<any> {
    const response = await api.post('/billing/recharge', data);
    return response.data;
  }
}

export const settingsApi = new SettingsApi();