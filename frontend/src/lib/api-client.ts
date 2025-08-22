import { fetchWithRetry, retryApiCall, apiCircuitBreaker } from './retry';
import { mockApiService, MockApiResponse } from './mock-api';

/**
 * API response interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * API client configuration
 */
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * Enhanced API client with retry logic and error handling
 */
export class ApiClient {
  private baseURL: string;
  private timeout: number;
  private retries: number;
  private defaultHeaders: Record<string, string>;

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers
    };
  }

  /**
   * Make HTTP request with retry logic and enhanced error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      return await apiCircuitBreaker.execute(async () => {
        const response = await fetchWithRetry(url, {
          ...options,
          headers: {
            ...this.defaultHeaders,
            ...options.headers
          }
        }, {
          maxAttempts: this.retries,
          onRetry: (attempt, error) => {
            console.warn(`API request retry ${attempt}/${this.retries} for ${endpoint}:`, {
              error: error.message,
              status: error.response?.status,
              code: error.code
            });
          }
        });

        const data = await response.json();
        return data as ApiResponse<T>;
      });
    } catch (error: any) {
      console.error(`API request failed for ${endpoint}:`, {
        error: error.message,
        status: error.response?.status,
        code: error.code,
        circuitBreakerState: apiCircuitBreaker.getState()
      });
      
      // Return standardized error response with enhanced details
      return {
        success: false,
        error: {
          code: error.code || 'NETWORK_ERROR',
          message: error.message || 'Network request failed',
          details: {
            endpoint,
            status: error.response?.status,
            circuitBreakerState: apiCircuitBreaker.getState(),
            timestamp: new Date().toISOString(),
            retryAttempts: this.retries
          }
        }
      };
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = endpoint;
    
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`;
      }
    }

    return this.request<T>(url, {
      method: 'GET'
    });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE'
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * Set authorization header
   */
  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Set API key header
   */
  setApiKey(apiKey: string): void {
    this.defaultHeaders['X-API-Key'] = apiKey;
  }

  /**
   * Remove authorization
   */
  clearAuth(): void {
    delete this.defaultHeaders['Authorization'];
    delete this.defaultHeaders['X-API-Key'];
  }

  /**
   * Health check endpoint with fallback to mock service
   */
  async healthCheck(): Promise<ApiResponse<any>> {
    try {
      // Try the API health endpoint first
      return await this.get('/health');
    } catch (error) {
      console.warn('API health check failed, trying direct health endpoint:', error);
      try {
        // Try direct health endpoint
        const response = await fetch('/api/health');
        const data = await response.json();
        return data;
      } catch (fallbackError) {
        console.warn('All health checks failed, using mock service:', fallbackError);
        return await mockApiService.healthCheck();
      }
    }
  }

  /**
   * Detailed health check
   */
  async detailedHealthCheck(): Promise<ApiResponse<any>> {
    return this.get('/health/detailed');
  }
}

/**
 * Create default API client instance
 */
export const createApiClient = (config?: Partial<ApiClientConfig>): ApiClient => {
  const baseURL = config?.baseURL || 
                  process.env.NEXT_PUBLIC_API_URL || 
                  'http://localhost:8000/api';

  return new ApiClient({
    baseURL,
    timeout: 30000,
    retries: 3,
    ...config
  });
};

/**
 * Default API client instance
 */
export const apiClient = createApiClient();

/**
 * Connection status checker
 */
export class ConnectionMonitor {
  private isOnline = true;
  private listeners: Array<(online: boolean) => void> = [];
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(private apiClient: ApiClient) {
    this.startMonitoring();
  }

  /**
   * Start monitoring connection status
   */
  startMonitoring(): void {
    // Check connection every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkConnection();
    }, 30000);

    // Listen to browser online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.setOnlineStatus(true));
      window.addEventListener('offline', () => this.setOnlineStatus(false));
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check API connection
   */
  private async checkConnection(): Promise<void> {
    try {
      const response = await this.apiClient.healthCheck();
      this.setOnlineStatus(response.success);
    } catch (error) {
      this.setOnlineStatus(false);
    }
  }

  /**
   * Set online status and notify listeners
   */
  private setOnlineStatus(online: boolean): void {
    if (this.isOnline !== online) {
      this.isOnline = online;
      this.listeners.forEach(listener => listener(online));
      
      console.log(`Connection status changed: ${online ? 'ONLINE' : 'OFFLINE'}`);
    }
  }

  /**
   * Add connection status listener
   */
  onStatusChange(listener: (online: boolean) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current connection status
   */
  getStatus(): boolean {
    return this.isOnline;
  }
}

/**
 * Global connection monitor instance
 */
export const connectionMonitor = new ConnectionMonitor(apiClient);