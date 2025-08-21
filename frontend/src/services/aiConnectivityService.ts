import { apiClient } from '../lib/apiClient';

export interface ConnectivityStatus {
  isOnline: boolean;
  hasInternetAccess: boolean;
  aiServiceStatus: 'available' | 'unavailable' | 'error';
  lastChecked: Date;
  responseTime?: number;
  errorMessage?: string;
  message?: string;
  featuresAvailable?: boolean;
}

export interface AIServiceValidation {
  hasValidApiKey: boolean;
  service: 'openrouter' | 'openai' | 'none';
  isConfigured: boolean;
  errorMessage?: string;
}

export class AIConnectivityService {
  private static instance: AIConnectivityService;
  private lastStatus: ConnectivityStatus | null = null;
  private statusListeners: ((status: ConnectivityStatus) => void)[] = [];
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start periodic status checks
    this.startPeriodicChecks();
  }

  public static getInstance(): AIConnectivityService {
    if (!AIConnectivityService.instance) {
      AIConnectivityService.instance = new AIConnectivityService();
    }
    return AIConnectivityService.instance;
  }

  /**
   * Get current connectivity status from backend
   */
  async getConnectivityStatus(useCache: boolean = true): Promise<ConnectivityStatus> {
    try {
      const endpoint = useCache ? '/ai-templates/connectivity/status' : '/ai-templates/connectivity/check';
      const method = useCache ? 'GET' : 'POST';
      
      const response = await apiClient.request(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.success && response.data) {
        const status: ConnectivityStatus = {
          ...response.data,
          lastChecked: new Date(response.data.lastChecked)
        };
        
        this.lastStatus = status;
        this.notifyStatusListeners(status);
        return status;
      }

      throw new Error('Invalid response from connectivity check');

    } catch (error) {
      console.error('Connectivity check failed:', error);
      
      const errorStatus: ConnectivityStatus = {
        isOnline: false,
        hasInternetAccess: false,
        aiServiceStatus: 'error',
        lastChecked: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Connectivity check failed',
        message: 'Unable to check AI service status. Please check your connection.',
        featuresAvailable: false
      };

      this.lastStatus = errorStatus;
      this.notifyStatusListeners(errorStatus);
      return errorStatus;
    }
  }

  /**
   * Force a fresh connectivity check
   */
  async checkConnectivity(): Promise<ConnectivityStatus> {
    return this.getConnectivityStatus(false);
  }

  /**
   * Validate AI service API keys
   */
  async validateApiKeys(): Promise<AIServiceValidation> {
    try {
      const response = await apiClient.request('/ai-templates/connectivity/validate-keys');

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error('Invalid response from API key validation');

    } catch (error) {
      console.error('API key validation failed:', error);
      return {
        hasValidApiKey: false,
        service: 'none',
        isConfigured: false,
        errorMessage: error instanceof Error ? error.message : 'API key validation failed'
      };
    }
  }

  /**
   * Check if AI features are currently available
   */
  async areAIFeaturesAvailable(): Promise<boolean> {
    const status = await this.getConnectivityStatus();
    return status.featuresAvailable === true;
  }

  /**
   * Get cached status if available
   */
  getCachedStatus(): ConnectivityStatus | null {
    return this.lastStatus;
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: ConnectivityStatus) => void): () => void {
    this.statusListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.statusListeners.indexOf(callback);
      if (index > -1) {
        this.statusListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get user-friendly error message for UI display
   */
  getUIErrorMessage(status: ConnectivityStatus): string {
    if (!status.hasInternetAccess) {
      return 'No internet connection. AI features require an active internet connection.';
    }

    if (status.aiServiceStatus === 'error') {
      return status.errorMessage || 'AI service configuration error. Please contact support.';
    }

    if (status.aiServiceStatus === 'unavailable') {
      return 'AI services are temporarily unavailable. Please try again later.';
    }

    return 'AI features are ready to use.';
  }

  /**
   * Get status indicator color for UI
   */
  getStatusColor(status: ConnectivityStatus): 'green' | 'yellow' | 'red' {
    if (status.featuresAvailable) {
      return 'green';
    }

    if (status.hasInternetAccess && status.aiServiceStatus === 'unavailable') {
      return 'yellow';
    }

    return 'red';
  }

  /**
   * Get status text for UI
   */
  getStatusText(status: ConnectivityStatus): string {
    if (status.featuresAvailable) {
      return 'Available';
    }

    if (status.hasInternetAccess && status.aiServiceStatus === 'unavailable') {
      return 'Unavailable';
    }

    return 'Error';
  }

  /**
   * Start periodic connectivity checks
   */
  private startPeriodicChecks(): void {
    // Check every 2 minutes
    this.checkInterval = setInterval(async () => {
      try {
        await this.getConnectivityStatus(true);
      } catch (error) {
        console.error('Periodic connectivity check failed:', error);
      }
    }, 120000);
  }

  /**
   * Stop periodic connectivity checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Notify all status listeners
   */
  private notifyStatusListeners(status: ConnectivityStatus): void {
    this.statusListeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in status listener:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPeriodicChecks();
    this.statusListeners = [];
    this.lastStatus = null;
  }
}

// Export singleton instance
export const aiConnectivityService = AIConnectivityService.getInstance();