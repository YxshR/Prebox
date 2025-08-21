import { aiConnectivityService, ConnectivityStatus } from './aiConnectivityService';

export interface AIFeature {
  id: string;
  name: string;
  description: string;
  isAvailable: boolean;
  requiresInternet: boolean;
  requiresApiKey: boolean;
  fallbackAvailable: boolean;
  lastChecked: Date;
  errorMessage?: string;
}

export interface AIFeatureStatus {
  templateGeneration: AIFeature;
  templateCustomization: AIFeature;
  contentSuggestions: AIFeature;
  overall: {
    available: number;
    total: number;
    status: 'all_available' | 'partial_available' | 'none_available';
  };
}

export class AIFeatureManager {
  private static instance: AIFeatureManager;
  private featureStatus: AIFeatureStatus | null = null;
  private statusListeners: ((status: AIFeatureStatus) => void)[] = [];
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Initialize feature status
    this.initializeFeatures();
    
    // Subscribe to connectivity changes
    aiConnectivityService.onStatusChange((status) => {
      this.updateFeatureStatus(status);
    });

    // Start periodic checks
    this.startPeriodicChecks();
  }

  public static getInstance(): AIFeatureManager {
    if (!AIFeatureManager.instance) {
      AIFeatureManager.instance = new AIFeatureManager();
    }
    return AIFeatureManager.instance;
  }

  /**
   * Get current feature status
   */
  getFeatureStatus(): AIFeatureStatus | null {
    return this.featureStatus;
  }

  /**
   * Check if a specific feature is available
   */
  isFeatureAvailable(featureId: keyof Omit<AIFeatureStatus, 'overall'>): boolean {
    if (!this.featureStatus) {
      return false;
    }
    return this.featureStatus[featureId].isAvailable;
  }

  /**
   * Get feature by ID
   */
  getFeature(featureId: keyof Omit<AIFeatureStatus, 'overall'>): AIFeature | null {
    if (!this.featureStatus) {
      return null;
    }
    return this.featureStatus[featureId];
  }

  /**
   * Force refresh of all feature statuses
   */
  async refreshFeatureStatus(): Promise<AIFeatureStatus> {
    const connectivityStatus = await aiConnectivityService.checkConnectivity();
    this.updateFeatureStatus(connectivityStatus);
    return this.featureStatus!;
  }

  /**
   * Subscribe to feature status changes
   */
  onStatusChange(callback: (status: AIFeatureStatus) => void): () => void {
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
   * Get user-friendly status message for a feature
   */
  getFeatureStatusMessage(featureId: keyof Omit<AIFeatureStatus, 'overall'>): string {
    const feature = this.getFeature(featureId);
    if (!feature) {
      return 'Feature status unknown';
    }

    if (feature.isAvailable) {
      return `${feature.name} is available and ready to use.`;
    }

    if (feature.fallbackAvailable) {
      return `${feature.name} is using fallback mode. Limited functionality available.`;
    }

    return feature.errorMessage || `${feature.name} is currently unavailable.`;
  }

  /**
   * Get recommended action for unavailable features
   */
  getRecommendedAction(featureId: keyof Omit<AIFeatureStatus, 'overall'>): string {
    const feature = this.getFeature(featureId);
    if (!feature || feature.isAvailable) {
      return '';
    }

    if (!feature.requiresInternet) {
      return 'Check your internet connection and try again.';
    }

    if (!feature.requiresApiKey) {
      return 'AI service configuration issue. Please contact support.';
    }

    if (feature.fallbackAvailable) {
      return 'You can continue with limited functionality, or wait for full service to be restored.';
    }

    return 'Please try again later or contact support if the issue persists.';
  }

  /**
   * Initialize feature definitions
   */
  private initializeFeatures(): void {
    const now = new Date();
    
    this.featureStatus = {
      templateGeneration: {
        id: 'template_generation',
        name: 'AI Template Generation',
        description: 'Generate email templates using AI',
        isAvailable: false,
        requiresInternet: true,
        requiresApiKey: true,
        fallbackAvailable: true,
        lastChecked: now
      },
      templateCustomization: {
        id: 'template_customization',
        name: 'AI Template Customization',
        description: 'Customize existing templates with AI assistance',
        isAvailable: false,
        requiresInternet: true,
        requiresApiKey: true,
        fallbackAvailable: false,
        lastChecked: now
      },
      contentSuggestions: {
        id: 'content_suggestions',
        name: 'AI Content Suggestions',
        description: 'Get AI-powered content suggestions and improvements',
        isAvailable: false,
        requiresInternet: true,
        requiresApiKey: true,
        fallbackAvailable: false,
        lastChecked: now
      },
      overall: {
        available: 0,
        total: 3,
        status: 'none_available'
      }
    };
  }

  /**
   * Update feature status based on connectivity
   */
  private updateFeatureStatus(connectivityStatus: ConnectivityStatus): void {
    if (!this.featureStatus) {
      this.initializeFeatures();
    }

    const now = new Date();
    const isConnected = connectivityStatus.hasInternetAccess;
    const aiAvailable = connectivityStatus.aiServiceStatus === 'available';

    // Update individual features
    const features = ['templateGeneration', 'templateCustomization', 'contentSuggestions'] as const;
    
    features.forEach(featureId => {
      const feature = this.featureStatus![featureId];
      
      // Determine availability
      let isAvailable = true;
      let errorMessage: string | undefined;

      if (feature.requiresInternet && !isConnected) {
        isAvailable = false;
        errorMessage = 'No internet connection';
      } else if (feature.requiresApiKey && !aiAvailable) {
        isAvailable = false;
        errorMessage = connectivityStatus.errorMessage || 'AI service unavailable';
      }

      // Update feature
      this.featureStatus![featureId] = {
        ...feature,
        isAvailable,
        errorMessage,
        lastChecked: now
      };
    });

    // Update overall status
    const availableCount = features.filter(id => this.featureStatus![id].isAvailable).length;
    const totalCount = features.length;

    this.featureStatus!.overall = {
      available: availableCount,
      total: totalCount,
      status: availableCount === totalCount ? 'all_available' :
              availableCount > 0 ? 'partial_available' : 'none_available'
    };

    // Notify listeners
    this.notifyStatusListeners(this.featureStatus!);
  }

  /**
   * Start periodic feature status checks
   */
  private startPeriodicChecks(): void {
    // Check every 5 minutes
    this.checkInterval = setInterval(async () => {
      try {
        await this.refreshFeatureStatus();
      } catch (error) {
        console.error('Periodic feature status check failed:', error);
      }
    }, 300000);
  }

  /**
   * Stop periodic checks
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
  private notifyStatusListeners(status: AIFeatureStatus): void {
    this.statusListeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in feature status listener:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPeriodicChecks();
    this.statusListeners = [];
    this.featureStatus = null;
  }
}

// Export singleton instance
export const aiFeatureManager = AIFeatureManager.getInstance();