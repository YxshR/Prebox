/**
 * Service Worker registration and management utilities
 * Implements caching strategies for better performance
 */

export interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager;
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig = {};

  static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager();
    }
    return ServiceWorkerManager.instance;
  }

  async register(config: ServiceWorkerConfig = {}): Promise<void> {
    this.config = config;

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      this.registration = registration;

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New content is available
                this.config.onUpdate?.(registration);
              } else {
                // Content is cached for the first time
                this.config.onSuccess?.(registration);
              }
            }
          });
        }
      });

      // Check if there's an existing service worker
      if (registration.waiting) {
        this.config.onUpdate?.(registration);
      }

      console.log('Service Worker registered successfully');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      this.config.onError?.(error as Error);
    }
  }

  async unregister(): Promise<boolean> {
    if (this.registration) {
      const result = await this.registration.unregister();
      this.registration = null;
      return result;
    }
    return false;
  }

  async update(): Promise<void> {
    if (this.registration) {
      await this.registration.update();
    }
  }

  skipWaiting(): void {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  async clearCache(): Promise<void> {
    if (this.registration?.active) {
      this.registration.active.postMessage({ type: 'CLEAR_CACHE' });
    }
  }

  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator;
  }

  async getCacheSize(): Promise<number> {
    if (!('caches' in window)) return 0;

    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Error calculating cache size:', error);
      return 0;
    }
  }

  async getCacheStats(): Promise<{
    caches: number;
    totalSize: number;
    totalSizeFormatted: string;
  }> {
    if (!('caches' in window)) {
      return { caches: 0, totalSize: 0, totalSizeFormatted: '0 B' };
    }

    try {
      const cacheNames = await caches.keys();
      const totalSize = await this.getCacheSize();

      return {
        caches: cacheNames.length,
        totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { caches: 0, totalSize: 0, totalSizeFormatted: '0 B' };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Hook for using service worker in React components
export function useServiceWorker(config: ServiceWorkerConfig = {}) {
  const swManager = ServiceWorkerManager.getInstance();

  const register = async () => {
    await swManager.register(config);
  };

  const unregister = async () => {
    return await swManager.unregister();
  };

  const update = async () => {
    await swManager.update();
  };

  const skipWaiting = () => {
    swManager.skipWaiting();
  };

  const clearCache = async () => {
    await swManager.clearCache();
  };

  const getCacheStats = async () => {
    return await swManager.getCacheStats();
  };

  return {
    register,
    unregister,
    update,
    skipWaiting,
    clearCache,
    getCacheStats,
    isSupported: swManager.isSupported(),
    registration: swManager.getRegistration(),
  };
}

// Preload critical resources
export function preloadCriticalResources(): void {
  if (typeof window === 'undefined') return;

  const criticalResources = [
    // Add critical CSS and JS files
    '/_next/static/css/app.css',
    '/_next/static/chunks/main.js',
    // Add other critical resources
  ];

  criticalResources.forEach((resource) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    
    if (resource.endsWith('.css')) {
      link.as = 'style';
    } else if (resource.endsWith('.js')) {
      link.as = 'script';
    } else if (resource.match(/\.(woff|woff2|ttf|eot)$/)) {
      link.as = 'font';
      link.crossOrigin = 'anonymous';
    }
    
    link.href = resource;
    document.head.appendChild(link);
  });
}

// Prefetch non-critical resources
export function prefetchResources(resources: string[]): void {
  if (typeof window === 'undefined') return;

  resources.forEach((resource) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = resource;
    document.head.appendChild(link);
  });
}

// Export singleton instance
export const serviceWorkerManager = ServiceWorkerManager.getInstance();