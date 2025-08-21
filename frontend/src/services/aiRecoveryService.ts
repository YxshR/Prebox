import { aiConnectivityService } from './aiConnectivityService';
import { aiFeatureManager } from './aiFeatureManager';

export interface RecoveryAttempt {
  id: string;
  timestamp: Date;
  feature: string;
  operation: string;
  success: boolean;
  error?: string;
  retryCount: number;
}

export interface RecoveryConfig {
  maxRetries: number;
  retryInterval: number; // milliseconds
  backoffMultiplier: number;
  maxRetryInterval: number; // milliseconds
  enableAutoRecovery: boolean;
}

export class AIRecoveryService {
  private static instance: AIRecoveryService;
  private recoveryAttempts: Map<string, RecoveryAttempt[]> = new Map();
  private activeRecoveries: Map<string, NodeJS.Timeout> = new Map();
  private config: RecoveryConfig;
  private recoveryListeners: ((attempt: RecoveryAttempt) => void)[] = [];

  private constructor() {
    this.config = {
      maxRetries: 5,
      retryInterval: 30000, // 30 seconds
      backoffMultiplier: 1.5,
      maxRetryInterval: 300000, // 5 minutes
      enableAutoRecovery: true
    };

    // Subscribe to connectivity changes for automatic recovery
    aiConnectivityService.onStatusChange((status) => {
      if (status.featuresAvailable && this.config.enableAutoRecovery) {
        this.attemptAutoRecovery();
      }
    });
  }

  public static getInstance(): AIRecoveryService {
    if (!AIRecoveryService.instance) {
      AIRecoveryService.instance = new AIRecoveryService();
    }
    return AIRecoveryService.instance;
  }

  /**
   * Register a failed operation for potential recovery
   */
  registerFailure(
    feature: string,
    operation: string,
    error: string,
    recoveryCallback?: () => Promise<boolean>
  ): string {
    const attemptId = this.generateId();
    const attempt: RecoveryAttempt = {
      id: attemptId,
      timestamp: new Date(),
      feature,
      operation,
      success: false,
      error,
      retryCount: 0
    };

    // Store the attempt
    const featureAttempts = this.recoveryAttempts.get(feature) || [];
    featureAttempts.push(attempt);
    this.recoveryAttempts.set(feature, featureAttempts);

    // Schedule recovery if enabled and callback provided
    if (this.config.enableAutoRecovery && recoveryCallback) {
      this.scheduleRecovery(attemptId, feature, recoveryCallback);
    }

    // Notify listeners
    this.notifyRecoveryListeners(attempt);

    return attemptId;
  }

  /**
   * Manually trigger recovery for a specific attempt
   */
  async triggerRecovery(
    attemptId: string,
    recoveryCallback: () => Promise<boolean>
  ): Promise<boolean> {
    const attempt = this.findAttempt(attemptId);
    if (!attempt) {
      console.warn(`Recovery attempt ${attemptId} not found`);
      return false;
    }

    // Cancel any scheduled recovery
    this.cancelScheduledRecovery(attemptId);

    try {
      console.log(`Attempting manual recovery for ${attempt.feature}:${attempt.operation}`);
      
      const success = await recoveryCallback();
      
      // Update attempt
      attempt.success = success;
      attempt.retryCount += 1;
      
      if (success) {
        console.log(`✅ Recovery successful for ${attempt.feature}:${attempt.operation}`);
        this.removeAttempt(attemptId);
      } else {
        console.log(`❌ Recovery failed for ${attempt.feature}:${attempt.operation}`);
        
        // Schedule next retry if within limits
        if (attempt.retryCount < this.config.maxRetries) {
          this.scheduleRecovery(attemptId, attempt.feature, recoveryCallback);
        } else {
          console.log(`Max retries exceeded for ${attempt.feature}:${attempt.operation}`);
          this.removeAttempt(attemptId);
        }
      }

      // Notify listeners
      this.notifyRecoveryListeners(attempt);
      
      return success;

    } catch (error) {
      console.error(`Recovery attempt failed:`, error);
      attempt.retryCount += 1;
      attempt.error = error instanceof Error ? error.message : 'Recovery failed';
      
      // Notify listeners
      this.notifyRecoveryListeners(attempt);
      
      return false;
    }
  }

  /**
   * Get recovery attempts for a specific feature
   */
  getRecoveryAttempts(feature?: string): RecoveryAttempt[] {
    if (feature) {
      return this.recoveryAttempts.get(feature) || [];
    }

    // Return all attempts
    const allAttempts: RecoveryAttempt[] = [];
    this.recoveryAttempts.forEach(attempts => {
      allAttempts.push(...attempts);
    });

    return allAttempts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear recovery attempts for a feature
   */
  clearRecoveryAttempts(feature: string): void {
    // Cancel any active recoveries
    const attempts = this.recoveryAttempts.get(feature) || [];
    attempts.forEach(attempt => {
      this.cancelScheduledRecovery(attempt.id);
    });

    // Clear attempts
    this.recoveryAttempts.delete(feature);
  }

  /**
   * Update recovery configuration
   */
  updateConfig(config: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current recovery configuration
   */
  getConfig(): RecoveryConfig {
    return { ...this.config };
  }

  /**
   * Subscribe to recovery attempt notifications
   */
  onRecoveryAttempt(callback: (attempt: RecoveryAttempt) => void): () => void {
    this.recoveryListeners.push(callback);
    
    return () => {
      const index = this.recoveryListeners.indexOf(callback);
      if (index > -1) {
        this.recoveryListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalAttempts: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    activeRecoveries: number;
    successRate: number;
  } {
    const allAttempts = this.getRecoveryAttempts();
    const totalAttempts = allAttempts.length;
    const successfulRecoveries = allAttempts.filter(a => a.success).length;
    const failedRecoveries = allAttempts.filter(a => !a.success && a.retryCount >= this.config.maxRetries).length;
    const activeRecoveries = this.activeRecoveries.size;
    const successRate = totalAttempts > 0 ? (successfulRecoveries / totalAttempts) * 100 : 0;

    return {
      totalAttempts,
      successfulRecoveries,
      failedRecoveries,
      activeRecoveries,
      successRate
    };
  }

  /**
   * Schedule automatic recovery
   */
  private scheduleRecovery(
    attemptId: string,
    feature: string,
    recoveryCallback: () => Promise<boolean>
  ): void {
    const attempt = this.findAttempt(attemptId);
    if (!attempt) return;

    // Calculate delay with exponential backoff
    const baseDelay = this.config.retryInterval;
    const delay = Math.min(
      baseDelay * Math.pow(this.config.backoffMultiplier, attempt.retryCount),
      this.config.maxRetryInterval
    );

    console.log(`Scheduling recovery for ${feature}:${attempt.operation} in ${delay}ms`);

    const timeout = setTimeout(async () => {
      this.activeRecoveries.delete(attemptId);
      await this.triggerRecovery(attemptId, recoveryCallback);
    }, delay);

    this.activeRecoveries.set(attemptId, timeout);
  }

  /**
   * Cancel scheduled recovery
   */
  private cancelScheduledRecovery(attemptId: string): void {
    const timeout = this.activeRecoveries.get(attemptId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeRecoveries.delete(attemptId);
    }
  }

  /**
   * Attempt automatic recovery for all failed operations
   */
  private async attemptAutoRecovery(): Promise<void> {
    console.log('Attempting automatic recovery for failed AI operations');

    const allAttempts = this.getRecoveryAttempts();
    const failedAttempts = allAttempts.filter(a => !a.success && a.retryCount < this.config.maxRetries);

    console.log(`Found ${failedAttempts.length} failed attempts eligible for recovery`);

    // Note: We can't automatically retry without the original callback
    // This method mainly serves to clean up and notify about recovery opportunities
    failedAttempts.forEach(attempt => {
      console.log(`Recovery opportunity: ${attempt.feature}:${attempt.operation}`);
    });
  }

  /**
   * Find attempt by ID
   */
  private findAttempt(attemptId: string): RecoveryAttempt | null {
    for (const attempts of this.recoveryAttempts.values()) {
      const attempt = attempts.find(a => a.id === attemptId);
      if (attempt) return attempt;
    }
    return null;
  }

  /**
   * Remove attempt by ID
   */
  private removeAttempt(attemptId: string): void {
    for (const [feature, attempts] of this.recoveryAttempts.entries()) {
      const index = attempts.findIndex(a => a.id === attemptId);
      if (index > -1) {
        attempts.splice(index, 1);
        if (attempts.length === 0) {
          this.recoveryAttempts.delete(feature);
        }
        break;
      }
    }

    // Cancel any scheduled recovery
    this.cancelScheduledRecovery(attemptId);
  }

  /**
   * Notify recovery listeners
   */
  private notifyRecoveryListeners(attempt: RecoveryAttempt): void {
    this.recoveryListeners.forEach(callback => {
      try {
        callback(attempt);
      } catch (error) {
        console.error('Error in recovery listener:', error);
      }
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Cancel all active recoveries
    this.activeRecoveries.forEach(timeout => clearTimeout(timeout));
    this.activeRecoveries.clear();
    
    // Clear all attempts
    this.recoveryAttempts.clear();
    
    // Clear listeners
    this.recoveryListeners = [];
  }
}

// Export singleton instance
export const aiRecoveryService = AIRecoveryService.getInstance();