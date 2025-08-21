import axios from 'axios';
import { AIProvider } from './ai-template.types';

export interface ConnectivityStatus {
  isOnline: boolean;
  hasInternetAccess: boolean;
  aiServiceStatus: 'available' | 'unavailable' | 'error';
  lastChecked: Date;
  responseTime?: number;
  errorMessage?: string;
}

export interface AIServiceValidation {
  hasValidApiKey: boolean;
  service: 'openrouter' | 'openai' | 'none';
  isConfigured: boolean;
  errorMessage?: string;
}

export class AIConnectivityService {
  private static instance: AIConnectivityService;
  private lastConnectivityCheck: ConnectivityStatus | null = null;
  private lastValidationCheck: AIServiceValidation | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start periodic connectivity checks
    this.startPeriodicChecks();
  }

  public static getInstance(): AIConnectivityService {
    if (!AIConnectivityService.instance) {
      AIConnectivityService.instance = new AIConnectivityService();
    }
    return AIConnectivityService.instance;
  }

  /**
   * Check internet connectivity by testing multiple reliable endpoints
   */
  async checkInternetConnectivity(): Promise<boolean> {
    const testUrls = [
      'https://www.google.com',
      'https://www.cloudflare.com',
      'https://httpbin.org/status/200'
    ];

    let successCount = 0;
    const promises = testUrls.map(async (url) => {
      try {
        const response = await axios.get(url, {
          timeout: 5000,
          headers: { 'User-Agent': 'Bulk-Email-Platform-Connectivity-Check' }
        });
        return response.status === 200;
      } catch (error) {
        return false;
      }
    });

    const results = await Promise.allSettled(promises);
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        successCount++;
      }
    });

    // Consider connected if at least 2 out of 3 endpoints respond
    return successCount >= 2;
  }

  /**
   * Validate AI service API keys and connectivity
   */
  async validateAIServiceKeys(): Promise<AIServiceValidation> {
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openrouterKey && !openaiKey) {
      return {
        hasValidApiKey: false,
        service: 'none',
        isConfigured: false,
        errorMessage: 'No AI service API keys configured'
      };
    }

    // Test OpenRouter first (preferred)
    if (openrouterKey) {
      try {
        const isValid = await this.testOpenRouterKey(openrouterKey);
        if (isValid) {
          return {
            hasValidApiKey: true,
            service: 'openrouter',
            isConfigured: true
          };
        }
      } catch (error) {
        console.warn('OpenRouter validation failed:', error);
      }
    }

    // Test OpenAI as fallback
    if (openaiKey) {
      try {
        const isValid = await this.testOpenAIKey(openaiKey);
        if (isValid) {
          return {
            hasValidApiKey: true,
            service: 'openai',
            isConfigured: true
          };
        }
      } catch (error) {
        console.warn('OpenAI validation failed:', error);
      }
    }

    return {
      hasValidApiKey: false,
      service: openrouterKey ? 'openrouter' : 'openai',
      isConfigured: true,
      errorMessage: 'API key validation failed - keys may be invalid or services unavailable'
    };
  }

  /**
   * Test OpenRouter API key validity
   */
  private async testOpenRouterKey(apiKey: string): Promise<boolean> {
    try {
      const response = await axios.get('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:8000',
          'X-Title': process.env.OPENROUTER_SITE_NAME || 'Bulk Email Platform'
        },
        timeout: 10000
      });

      return response.status === 200 && Array.isArray(response.data.data);
    } catch (error) {
      console.error('OpenRouter key validation failed:', error);
      return false;
    }
  }

  /**
   * Test OpenAI API key validity
   */
  private async testOpenAIKey(apiKey: string): Promise<boolean> {
    try {
      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'Bulk-Email-Platform-Connectivity-Check'
        },
        timeout: 10000
      });

      return response.status === 200 && Array.isArray(response.data.data);
    } catch (error) {
      console.error('OpenAI key validation failed:', error);
      return false;
    }
  }

  /**
   * Comprehensive connectivity and AI service status check
   */
  async checkAIServiceStatus(): Promise<ConnectivityStatus> {
    const startTime = Date.now();
    
    try {
      // Check internet connectivity
      const hasInternetAccess = await this.checkInternetConnectivity();
      
      if (!hasInternetAccess) {
        const status: ConnectivityStatus = {
          isOnline: false,
          hasInternetAccess: false,
          aiServiceStatus: 'unavailable',
          lastChecked: new Date(),
          responseTime: Date.now() - startTime,
          errorMessage: 'No internet connectivity detected'
        };
        this.lastConnectivityCheck = status;
        return status;
      }

      // Validate AI service keys
      const validation = await this.validateAIServiceKeys();
      
      if (!validation.hasValidApiKey) {
        const status: ConnectivityStatus = {
          isOnline: true,
          hasInternetAccess: true,
          aiServiceStatus: 'error',
          lastChecked: new Date(),
          responseTime: Date.now() - startTime,
          errorMessage: validation.errorMessage || 'AI service configuration error'
        };
        this.lastConnectivityCheck = status;
        return status;
      }

      // All checks passed
      const status: ConnectivityStatus = {
        isOnline: true,
        hasInternetAccess: true,
        aiServiceStatus: 'available',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime
      };
      
      this.lastConnectivityCheck = status;
      return status;

    } catch (error) {
      const status: ConnectivityStatus = {
        isOnline: false,
        hasInternetAccess: false,
        aiServiceStatus: 'error',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown connectivity error'
      };
      
      this.lastConnectivityCheck = status;
      return status;
    }
  }

  /**
   * Get cached connectivity status (if available and recent)
   */
  getCachedStatus(): ConnectivityStatus | null {
    if (!this.lastConnectivityCheck) {
      return null;
    }

    // Return cached status if it's less than 30 seconds old
    const cacheAge = Date.now() - this.lastConnectivityCheck.lastChecked.getTime();
    if (cacheAge < 30000) {
      return this.lastConnectivityCheck;
    }

    return null;
  }

  /**
   * Get connectivity status (cached or fresh)
   */
  async getConnectivityStatus(useCache: boolean = true): Promise<ConnectivityStatus> {
    if (useCache) {
      const cached = this.getCachedStatus();
      if (cached) {
        return cached;
      }
    }

    return await this.checkAIServiceStatus();
  }

  /**
   * Start periodic connectivity checks
   */
  private startPeriodicChecks(): void {
    // Check every 2 minutes
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkAIServiceStatus();
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
   * Check if AI features should be available based on current status
   */
  async areAIFeaturesAvailable(): Promise<boolean> {
    const status = await this.getConnectivityStatus();
    return status.aiServiceStatus === 'available';
  }

  /**
   * Get user-friendly status message
   */
  getStatusMessage(status: ConnectivityStatus): string {
    if (!status.hasInternetAccess) {
      return 'No internet connection detected. AI features require an active internet connection.';
    }

    if (status.aiServiceStatus === 'error') {
      return status.errorMessage || 'AI service configuration error. Please check your API keys.';
    }

    if (status.aiServiceStatus === 'unavailable') {
      return 'AI services are currently unavailable. Please try again later.';
    }

    return 'AI features are available and ready to use.';
  }
}