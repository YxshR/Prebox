import { useState, useEffect, useCallback } from 'react';
import { aiFeatureManager, AIFeatureStatus, AIFeature } from '../services/aiFeatureManager';

export interface UseAIFeaturesReturn {
  status: AIFeatureStatus | null;
  isLoading: boolean;
  isFeatureAvailable: (featureId: keyof Omit<AIFeatureStatus, 'overall'>) => boolean;
  getFeature: (featureId: keyof Omit<AIFeatureStatus, 'overall'>) => AIFeature | null;
  getStatusMessage: (featureId: keyof Omit<AIFeatureStatus, 'overall'>) => string;
  getRecommendedAction: (featureId: keyof Omit<AIFeatureStatus, 'overall'>) => string;
  refresh: () => Promise<void>;
}

export function useAIFeatures(): UseAIFeaturesReturn {
  const [status, setStatus] = useState<AIFeatureStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const newStatus = await aiFeatureManager.refreshFeatureStatus();
      setStatus(newStatus);
    } catch (error) {
      console.error('Failed to refresh AI feature status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isFeatureAvailable = useCallback((featureId: keyof Omit<AIFeatureStatus, 'overall'>) => {
    return aiFeatureManager.isFeatureAvailable(featureId);
  }, []);

  const getFeature = useCallback((featureId: keyof Omit<AIFeatureStatus, 'overall'>) => {
    return aiFeatureManager.getFeature(featureId);
  }, []);

  const getStatusMessage = useCallback((featureId: keyof Omit<AIFeatureStatus, 'overall'>) => {
    return aiFeatureManager.getFeatureStatusMessage(featureId);
  }, []);

  const getRecommendedAction = useCallback((featureId: keyof Omit<AIFeatureStatus, 'overall'>) => {
    return aiFeatureManager.getRecommendedAction(featureId);
  }, []);

  useEffect(() => {
    // Get initial status
    const initialStatus = aiFeatureManager.getFeatureStatus();
    if (initialStatus) {
      setStatus(initialStatus);
      setIsLoading(false);
    } else {
      // Trigger initial refresh
      refresh();
    }

    // Subscribe to status changes
    const unsubscribe = aiFeatureManager.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [refresh]);

  return {
    status,
    isLoading,
    isFeatureAvailable,
    getFeature,
    getStatusMessage,
    getRecommendedAction,
    refresh
  };
}

export default useAIFeatures;