/**
 * Performance monitoring hook for tracking Core Web Vitals and custom metrics
 * Implements requirement 4.4 for animation performance optimization
 */

import { useEffect, useRef, useCallback } from 'react';
import { PerformanceMonitor } from '../lib/performanceOptimization';

interface PerformanceMetrics {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
}

interface UsePerformanceMonitoringOptions {
  enableWebVitals?: boolean;
  enableCustomMetrics?: boolean;
  reportInterval?: number;
  onMetricUpdate?: (metric: string, value: number) => void;
}

export function usePerformanceMonitoring(options: UsePerformanceMonitoringOptions = {}) {
  const {
    enableWebVitals = true,
    enableCustomMetrics = true,
    reportInterval = 30000, // 30 seconds
    onMetricUpdate,
  } = options;

  const performanceMonitor = useRef(PerformanceMonitor.getInstance());
  const metricsRef = useRef<PerformanceMetrics>({});
  const reportIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start timing for custom metrics
  const startTiming = useCallback((label: string) => {
    if (enableCustomMetrics) {
      performanceMonitor.current.startTiming(label);
    }
  }, [enableCustomMetrics]);

  // End timing for custom metrics
  const endTiming = useCallback((label: string) => {
    if (enableCustomMetrics) {
      const duration = performanceMonitor.current.endTiming(label);
      onMetricUpdate?.(label, duration);
      return duration;
    }
    return 0;
  }, [enableCustomMetrics, onMetricUpdate]);

  // Get all metrics
  const getMetrics = useCallback(() => {
    return {
      ...metricsRef.current,
      ...performanceMonitor.current.getAllMetrics(),
    };
  }, []);

  // Report metrics to console or analytics service
  const reportMetrics = useCallback(() => {
    const metrics = getMetrics();
    console.log('Performance Metrics:', metrics);
    
    // Here you could send metrics to an analytics service
    // analytics.track('performance_metrics', metrics);
  }, [getMetrics]);

  useEffect(() => {
    if (!enableWebVitals || typeof window === 'undefined') return;

    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      if (lastEntry) {
        metricsRef.current.lcp = lastEntry.startTime;
        onMetricUpdate?.('lcp', lastEntry.startTime);
      }
    });

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        const fid = entry.processingStart - entry.startTime;
        metricsRef.current.fid = fid;
        onMetricUpdate?.('fid', fid);
      });
    });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          metricsRef.current.cls = clsValue;
          onMetricUpdate?.('cls', clsValue);
        }
      });
    });

    // First Contentful Paint (FCP)
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (entry.name === 'first-contentful-paint') {
          metricsRef.current.fcp = entry.startTime;
          onMetricUpdate?.('fcp', entry.startTime);
        }
      });
    });

    // Navigation timing for TTFB
    const navigationObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (entry.entryType === 'navigation') {
          const ttfb = entry.responseStart - entry.requestStart;
          metricsRef.current.ttfb = ttfb;
          onMetricUpdate?.('ttfb', ttfb);
        }
      });
    });

    try {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      fidObserver.observe({ entryTypes: ['first-input'] });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      fcpObserver.observe({ entryTypes: ['paint'] });
      navigationObserver.observe({ entryTypes: ['navigation'] });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }

    return () => {
      lcpObserver.disconnect();
      fidObserver.disconnect();
      clsObserver.disconnect();
      fcpObserver.disconnect();
      navigationObserver.disconnect();
    };
  }, [enableWebVitals, onMetricUpdate]);

  // Set up periodic reporting
  useEffect(() => {
    if (reportInterval > 0) {
      reportIntervalRef.current = setInterval(reportMetrics, reportInterval);
      
      return () => {
        if (reportIntervalRef.current) {
          clearInterval(reportIntervalRef.current);
        }
      };
    }
  }, [reportInterval, reportMetrics]);

  return {
    startTiming,
    endTiming,
    getMetrics,
    reportMetrics,
    metrics: metricsRef.current,
  };
}

/**
 * Hook for monitoring animation performance
 */
export function useAnimationPerformance() {
  const frameTimeRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const startMonitoring = useCallback(() => {
    let lastTime = performance.now();
    
    const measureFrame = (currentTime: number) => {
      const frameTime = currentTime - lastTime;
      frameTimeRef.current.push(frameTime);
      
      // Keep only last 60 frames (1 second at 60fps)
      if (frameTimeRef.current.length > 60) {
        frameTimeRef.current.shift();
      }
      
      lastTime = currentTime;
      animationFrameRef.current = requestAnimationFrame(measureFrame);
    };
    
    animationFrameRef.current = requestAnimationFrame(measureFrame);
  }, []);

  const stopMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const getFrameRate = useCallback(() => {
    if (frameTimeRef.current.length === 0) return 0;
    
    const avgFrameTime = frameTimeRef.current.reduce((sum, time) => sum + time, 0) / frameTimeRef.current.length;
    return Math.round(1000 / avgFrameTime);
  }, []);

  const getFrameStats = useCallback(() => {
    if (frameTimeRef.current.length === 0) {
      return { fps: 0, avgFrameTime: 0, minFrameTime: 0, maxFrameTime: 0 };
    }

    const frameTimes = frameTimeRef.current;
    const avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
    const minFrameTime = Math.min(...frameTimes);
    const maxFrameTime = Math.max(...frameTimes);
    const fps = Math.round(1000 / avgFrameTime);

    return {
      fps,
      avgFrameTime: Math.round(avgFrameTime * 100) / 100,
      minFrameTime: Math.round(minFrameTime * 100) / 100,
      maxFrameTime: Math.round(maxFrameTime * 100) / 100,
    };
  }, []);

  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    startMonitoring,
    stopMonitoring,
    getFrameRate,
    getFrameStats,
  };
}

/**
 * Hook for monitoring resource loading performance
 */
export function useResourcePerformance() {
  const resourceTimings = useRef<PerformanceResourceTiming[]>([]);

  const getResourceTimings = useCallback(() => {
    if (typeof performance === 'undefined') return [];
    
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    resourceTimings.current = entries;
    return entries;
  }, []);

  const getSlowResources = useCallback((threshold = 1000) => {
    const timings = getResourceTimings();
    return timings.filter(entry => entry.duration > threshold);
  }, [getResourceTimings]);

  const getResourcesByType = useCallback((type: string) => {
    const timings = getResourceTimings();
    return timings.filter(entry => entry.name.includes(type));
  }, [getResourceTimings]);

  const getResourceStats = useCallback(() => {
    const timings = getResourceTimings();
    
    if (timings.length === 0) {
      return { total: 0, avgDuration: 0, totalSize: 0 };
    }

    const totalDuration = timings.reduce((sum, entry) => sum + entry.duration, 0);
    const avgDuration = totalDuration / timings.length;
    const totalSize = timings.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);

    return {
      total: timings.length,
      avgDuration: Math.round(avgDuration * 100) / 100,
      totalSize: Math.round(totalSize / 1024), // KB
    };
  }, [getResourceTimings]);

  return {
    getResourceTimings,
    getSlowResources,
    getResourcesByType,
    getResourceStats,
  };
}