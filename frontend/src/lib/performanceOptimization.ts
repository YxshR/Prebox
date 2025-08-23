/**
 * Performance optimization utilities for code splitting and lazy loading
 * Implements requirements 2.3 and 4.4 for optimized loading and animations
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react';
import { motion } from 'framer-motion';

// Cache for lazy-loaded components
const componentCache = new Map<string, LazyExoticComponent<any>>();

/**
 * Enhanced lazy loading with caching and error boundaries
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  cacheKey: string
): LazyExoticComponent<T> {
  if (componentCache.has(cacheKey)) {
    return componentCache.get(cacheKey) as LazyExoticComponent<T>;
  }

  const LazyComponent = lazy(importFn);
  componentCache.set(cacheKey, LazyComponent);
  
  return LazyComponent;
}

/**
 * Preload component for better UX
 */
export function preloadComponent(importFn: () => Promise<any>): void {
  // Start loading the component in the background
  importFn().catch(() => {
    // Silently handle preload failures
  });
}

/**
 * Progressive image loading with blur placeholder
 */
export interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  blurDataURL?: string;
}

/**
 * Intersection Observer for lazy loading
 */
export class LazyLoadObserver {
  private observer: IntersectionObserver | null = null;
  private callbacks = new Map<Element, () => void>();

  constructor(options: IntersectionObserverInit = {}) {
    if (typeof window !== 'undefined') {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const callback = this.callbacks.get(entry.target);
            if (callback) {
              callback();
              this.unobserve(entry.target);
            }
          }
        });
      }, {
        rootMargin: '50px',
        threshold: 0.1,
        ...options,
      });
    }
  }

  observe(element: Element, callback: () => void): void {
    if (this.observer) {
      this.callbacks.set(element, callback);
      this.observer.observe(element);
    }
  }

  unobserve(element: Element): void {
    if (this.observer) {
      this.observer.unobserve(element);
      this.callbacks.delete(element);
    }
  }

  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.callbacks.clear();
    }
  }
}

/**
 * Resource hints for better loading performance
 */
export function addResourceHints(): void {
  if (typeof document === 'undefined') return;

  // Preconnect to external domains
  const preconnectDomains = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ];

  preconnectDomains.forEach((domain) => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

/**
 * Bundle splitting configuration
 */
export const bundleSplitConfig = {
  // Critical components that should be in main bundle
  critical: [
    'HeroSection',
    'ErrorBoundary',
    'LoadingSpinner',
  ],
  
  // Components that can be lazy loaded
  lazy: [
    'MultimediaShowcase',
    'AnimatedPricingSection',
    'MediaGallery',
    'PremiumVideoPlayer',
    'PricingComparison',
  ],
  
  // Third-party libraries that should be split
  vendor: [
    'framer-motion',
    'recharts',
    '@heroicons/react',
  ],
};

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTiming(label: string): void {
    if (typeof performance !== 'undefined') {
      this.metrics.set(`${label}_start`, performance.now());
    }
  }

  endTiming(label: string): number {
    if (typeof performance !== 'undefined') {
      const startTime = this.metrics.get(`${label}_start`);
      if (startTime) {
        const duration = performance.now() - startTime;
        this.metrics.set(label, duration);
        return duration;
      }
    }
    return 0;
  }

  getMetric(label: string): number | undefined {
    return this.metrics.get(label);
  }

  getAllMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  // Report Core Web Vitals
  reportWebVitals(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // LCP (Largest Contentful Paint)
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log('LCP:', lastEntry.startTime);
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // FID (First Input Delay)
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fidEntry = entry as any;
          console.log('FID:', fidEntry.processingStart - fidEntry.startTime);
        });
      }).observe({ entryTypes: ['first-input'] });

      // CLS (Cumulative Layout Shift)
      new PerformanceObserver((list) => {
        let clsValue = 0;
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        console.log('CLS:', clsValue);
      }).observe({ entryTypes: ['layout-shift'] });
    }
  }
}

/**
 * Animation performance optimization
 */
export const optimizedAnimationVariants = {
  // Use transform instead of changing layout properties
  fadeIn: {
    initial: { opacity: 0, transform: 'translateY(20px)' },
    animate: { opacity: 1, transform: 'translateY(0px)' },
    exit: { opacity: 0, transform: 'translateY(-20px)' },
  },
  
  scale: {
    initial: { opacity: 0, transform: 'scale(0.95)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.95)' },
  },
  
  slideIn: {
    initial: { opacity: 0, transform: 'translateX(-20px)' },
    animate: { opacity: 1, transform: 'translateX(0px)' },
    exit: { opacity: 0, transform: 'translateX(20px)' },
  },
};

/**
 * Optimized motion configuration for better performance
 */
export const optimizedMotionConfig = {
  // Reduce motion for users who prefer it
  reducedMotion: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },
  
  // Hardware acceleration hints
  style: {
    willChange: 'transform, opacity',
  },
  
  // Optimized transition settings
  transition: {
    type: 'tween',
    ease: 'easeOut',
    duration: 0.3,
  },
};

/**
 * Media optimization utilities
 */
export const mediaOptimization = {
  // Generate responsive image sizes
  generateSizes: (breakpoints: Record<string, number>) => {
    return Object.entries(breakpoints)
      .map(([key, value]) => `(max-width: ${value}px) ${Math.floor(value * 0.9)}px`)
      .join(', ') + ', 100vw';
  },
  
  // Generate blur placeholder for images
  generateBlurDataURL: (width: number, height: number, color = '#f3f4f6') => {
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${color}"/>
      </svg>
    `;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  },
  
  // Video optimization settings
  videoSettings: {
    preload: 'metadata' as const,
    playsInline: true,
    muted: true,
    controls: false,
    loop: true,
  },
};