'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';

interface OfflineCapableProps {
  children: ReactNode;
  offlineContent?: ReactNode;
  syncOnReconnect?: boolean;
  showOfflineIndicator?: boolean;
  className?: string;
}

/**
 * Component that provides offline-capable UI with sync capabilities
 */
export function OfflineCapable({
  children,
  offlineContent,
  syncOnReconnect = true,
  showOfflineIndicator = true,
  className = ''
}: OfflineCapableProps) {
  const { status } = useConnectionStatus();
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Handle reconnection and sync
  useEffect(() => {
    if (status.isOnline && status.isConnected && pendingActions.length > 0 && syncOnReconnect) {
      syncPendingActions();
    }
  }, [status.isOnline, status.isConnected, pendingActions.length, syncOnReconnect]);

  const syncPendingActions = async () => {
    if (pendingActions.length === 0) return;

    setIsSyncing(true);
    try {
      // Process pending actions
      for (const action of pendingActions) {
        // Here you would implement actual sync logic
        console.log('Syncing action:', action);
      }
      
      setPendingActions([]);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const addPendingAction = (action: any) => {
    setPendingActions(prev => [...prev, { ...action, timestamp: new Date() }]);
  };

  const defaultOfflineContent = (
    <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-blue-800">
            Offline Mode
          </h3>
          <div className="mt-1 text-sm text-blue-700">
            <p>You're currently offline. Some features may be limited, but you can still browse cached content.</p>
            {pendingActions.length > 0 && (
              <p className="mt-2">
                {pendingActions.length} action(s) will be synced when you reconnect.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={className}>
      {/* Offline indicator */}
      {showOfflineIndicator && (
        <AnimatePresence>
          {!status.isOnline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4"
            >
              {offlineContent || defaultOfflineContent}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Sync indicator */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg"
          >
            <div className="flex items-center">
              <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin mr-2" />
              <span className="text-sm text-green-800">Syncing changes...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div>
        {React.cloneElement(children as React.ReactElement, {
          isOffline: !status.isOnline,
          addPendingAction,
          pendingActionsCount: pendingActions.length
        })}
      </div>

      {/* Last sync time */}
      {lastSyncTime && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Last synced: {lastSyncTime.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

/**
 * Hook for managing offline state and pending actions
 */
export function useOfflineState() {
  const { status } = useConnectionStatus();
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [cachedData, setCachedData] = useState<Record<string, any>>({});

  const addPendingAction = (action: any) => {
    setPendingActions(prev => [...prev, { ...action, timestamp: new Date() }]);
  };

  const cacheData = (key: string, data: any) => {
    setCachedData(prev => ({ ...prev, [key]: data }));
    // Also store in localStorage for persistence
    try {
      localStorage.setItem(`offline_cache_${key}`, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to cache data to localStorage:', error);
    }
  };

  const getCachedData = (key: string) => {
    // First check in-memory cache
    if (cachedData[key]) {
      return cachedData[key];
    }

    // Then check localStorage
    try {
      const cached = localStorage.getItem(`offline_cache_${key}`);
      if (cached) {
        const data = JSON.parse(cached);
        setCachedData(prev => ({ ...prev, [key]: data }));
        return data;
      }
    } catch (error) {
      console.warn('Failed to retrieve cached data from localStorage:', error);
    }

    return null;
  };

  const clearCache = (key?: string) => {
    if (key) {
      setCachedData(prev => {
        const newCache = { ...prev };
        delete newCache[key];
        return newCache;
      });
      try {
        localStorage.removeItem(`offline_cache_${key}`);
      } catch (error) {
        console.warn('Failed to clear cached data from localStorage:', error);
      }
    } else {
      setCachedData({});
      // Clear all offline cache from localStorage
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('offline_cache_')) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('Failed to clear all cached data from localStorage:', error);
      }
    }
  };

  return {
    isOnline: status.isOnline && status.isConnected,
    pendingActions,
    addPendingAction,
    cacheData,
    getCachedData,
    clearCache,
    connectionStatus: status
  };
}

/**
 * Offline-capable form component
 */
export function OfflineCapableForm({
  children,
  onSubmit,
  className = ''
}: {
  children: ReactNode;
  onSubmit: (data: any) => Promise<void>;
  className?: string;
}) {
  const { isOnline, addPendingAction } = useOfflineState();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    
    try {
      if (isOnline) {
        await onSubmit(data);
      } else {
        // Queue for later submission
        addPendingAction({
          type: 'form_submission',
          data,
          formId: Math.random().toString(36).substr(2, 9)
        });
        
        // Show success message even when offline
        console.log('Form queued for submission when online');
      }
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={className}>
      {!isOnline && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-yellow-800 text-sm">
              You're offline. Form data will be submitted when connection is restored.
            </span>
          </div>
        </div>
      )}
      
      {React.cloneElement(children as React.ReactElement, {
        onSubmit: handleSubmit,
        isSubmitting,
        isOffline: !isOnline
      })}
    </div>
  );
}

/**
 * Offline-capable data display component
 */
export function OfflineCapableData({
  children,
  cacheKey,
  fallbackData,
  className = ''
}: {
  children: (data: any, isStale: boolean) => ReactNode;
  cacheKey: string;
  fallbackData?: any;
  className?: string;
}) {
  const { isOnline, getCachedData, cacheData } = useOfflineState();
  const [data, setData] = useState(fallbackData);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (isOnline) {
      // Fetch fresh data when online
      // This would be replaced with actual API call
      setIsStale(false);
    } else {
      // Use cached data when offline
      const cached = getCachedData(cacheKey);
      if (cached) {
        setData(cached);
        setIsStale(true);
      }
    }
  }, [isOnline, cacheKey, getCachedData]);

  return (
    <div className={className}>
      {isStale && (
        <div className="mb-2 text-xs text-gray-500 flex items-center">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          Showing cached data
        </div>
      )}
      {children(data, isStale)}
    </div>
  );
}