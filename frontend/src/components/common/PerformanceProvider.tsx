/**
 * Performance Provider component for managing performance optimizations
 * Implements requirements 2.3 and 4.4 for performance optimization
 */

'use client';

import { useEffect, useState } from 'react';
import { useServiceWorker } from '../../lib/serviceWorker';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { addResourceHints } from '../../lib/performanceOptimization';
import { cacheManager } from '../../lib/caching';

interface PerformanceProviderProps {
  children: React.ReactNode;
}

export function PerformanceProvider({ children }: PerformanceProviderProps) {
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  // Service Worker management
  const {
    register: registerSW,
    skipWaiting,
    getCacheStats,
    isSupported: swSupported,
  } = useServiceWorker({
    onSuccess: () => {
      console.log('Service Worker registered successfully');
      setIsServiceWorkerReady(true);
    },
    onUpdate: () => {
      console.log('New content available');
      setShowUpdateBanner(true);
    },
    onError: (error) => {
      console.error('Service Worker registration failed:', error);
    },
  });

  // Performance monitoring
  const { startTiming, endTiming, reportMetrics } = usePerformanceMonitoring({
    enableWebVitals: true,
    enableCustomMetrics: true,
    reportInterval: 30000, // Report every 30 seconds
    onMetricUpdate: (metric, value) => {
      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Performance metric - ${metric}:`, value);
      }
    },
  });

  useEffect(() => {
    // Initialize performance optimizations
    const initPerformance = async () => {
      // Start timing for initial load
      startTiming('initial-load');

      // Add resource hints for better loading
      addResourceHints();

      // Register service worker if supported
      if (swSupported) {
        await registerSW();
      }

      // Preload critical resources
      preloadCriticalAssets();

      // End timing for initial load
      setTimeout(() => {
        endTiming('initial-load');
      }, 100);
    };

    initPerformance();
  }, [registerSW, swSupported, startTiming, endTiming]);

  // Preload critical assets
  const preloadCriticalAssets = () => {
    // Preload hero images and videos
    const criticalAssets = [
      '/images/hero-bg.jpg',
      '/videos/hero-video.mp4',
      // Add other critical assets
    ];

    criticalAssets.forEach(asset => {
      if (asset.includes('video')) {
        // Preload video metadata
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = asset;
      } else {
        // Preload images
        const img = new Image();
        img.src = asset;
      }
    });
  };

  // Handle service worker update
  const handleUpdate = () => {
    skipWaiting();
    setShowUpdateBanner(false);
    window.location.reload();
  };

  // Performance debugging in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Add performance debugging tools
      (window as any).performanceDebug = {
        getCacheStats,
        reportMetrics,
        clearCache: () => cacheManager.clearAll(),
        cacheManager,
      };

      console.log('Performance debugging tools available at window.performanceDebug');
    }
  }, [getCacheStats, reportMetrics]);

  return (
    <>
      {children}
      
      {/* Service Worker Update Banner */}
      {showUpdateBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white p-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium">
                New content is available. Refresh to get the latest updates.
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleUpdate}
                className="px-3 py-1 bg-white text-blue-600 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={() => setShowUpdateBanner(false)}
                className="p-1 hover:bg-blue-700 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Performance Monitor (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <PerformanceMonitor />
      )}
    </>
  );
}

/**
 * Performance Monitor component for development
 */
function PerformanceMonitor() {
  const [isVisible, setIsVisible] = useState(false);
  const [stats, setStats] = useState<any>({});

  const { getCacheStats } = useServiceWorker();
  const { getMetrics } = usePerformanceMonitoring();

  useEffect(() => {
    const updateStats = async () => {
      const cacheStats = await getCacheStats();
      const performanceMetrics = getMetrics();
      
      setStats({
        cache: cacheStats,
        performance: performanceMetrics,
        memory: (performance as any).memory ? {
          used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024),
        } : null,
      });
    };

    if (isVisible) {
      updateStats();
      const interval = setInterval(updateStats, 2000);
      return () => clearInterval(interval);
    }
  }, [isVisible, getCacheStats, getMetrics]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 p-2 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="Show Performance Monitor"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white p-4 rounded-lg shadow-xl max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Performance Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        {/* Cache Stats */}
        <div>
          <div className="font-medium text-blue-300">Cache</div>
          <div>Caches: {stats.cache?.caches || 0}</div>
          <div>Size: {stats.cache?.totalSizeFormatted || '0 B'}</div>
        </div>

        {/* Performance Metrics */}
        <div>
          <div className="font-medium text-green-300">Performance</div>
          {stats.performance?.lcp && (
            <div>LCP: {Math.round(stats.performance.lcp)}ms</div>
          )}
          {stats.performance?.fid && (
            <div>FID: {Math.round(stats.performance.fid)}ms</div>
          )}
          {stats.performance?.cls && (
            <div>CLS: {stats.performance.cls.toFixed(3)}</div>
          )}
        </div>

        {/* Memory Usage */}
        {stats.memory && (
          <div>
            <div className="font-medium text-yellow-300">Memory</div>
            <div>Used: {stats.memory.used}MB</div>
            <div>Total: {stats.memory.total}MB</div>
          </div>
        )}
      </div>
    </div>
  );
}