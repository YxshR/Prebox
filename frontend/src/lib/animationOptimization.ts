'use client';

import React from 'react';

/**
 * Animation Performance Optimization Utilities
 * Requirement 4.4: Optimize animations for 60fps performance on target devices
 */

interface PerformanceConfig {
  targetFPS: number;
  enableGPUAcceleration: boolean;
  enableWillChange: boolean;
  enableTransform3D: boolean;
  maxConcurrentAnimations: number;
}

interface AnimationMetrics {
  fps: number;
  frameDrops: number;
  averageFrameTime: number;
  isPerformant: boolean;
}

class AnimationPerformanceManager {
  private config: PerformanceConfig;
  private activeAnimations: Set<string> = new Set();
  private frameMetrics: number[] = [];
  private lastFrameTime: number = 0;
  private frameDropCount: number = 0;
  private rafId: number | null = null;
  private isMonitoring: boolean = false;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      targetFPS: 60,
      enableGPUAcceleration: true,
      enableWillChange: true,
      enableTransform3D: true,
      maxConcurrentAnimations: 10,
      ...config
    };
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.lastFrameTime = performance.now();
    this.monitorFrame();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Monitor frame performance
   */
  private monitorFrame = (): void => {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const frameTime = currentTime - this.lastFrameTime;
    
    // Calculate FPS
    const fps = 1000 / frameTime;
    
    // Track frame drops (frames that take longer than 16.67ms for 60fps)
    const targetFrameTime = 1000 / this.config.targetFPS;
    if (frameTime > targetFrameTime * 1.5) {
      this.frameDropCount++;
    }
    
    // Store metrics (keep last 60 frames)
    this.frameMetrics.push(frameTime);
    if (this.frameMetrics.length > 60) {
      this.frameMetrics.shift();
    }
    
    this.lastFrameTime = currentTime;
    this.rafId = requestAnimationFrame(this.monitorFrame);
  };

  /**
   * Get current performance metrics
   */
  getMetrics(): AnimationMetrics {
    if (this.frameMetrics.length === 0) {
      return {
        fps: 0,
        frameDrops: 0,
        averageFrameTime: 0,
        isPerformant: true
      };
    }

    const averageFrameTime = this.frameMetrics.reduce((a, b) => a + b, 0) / this.frameMetrics.length;
    const fps = 1000 / averageFrameTime;
    const isPerformant = fps >= this.config.targetFPS * 0.9; // 90% of target FPS

    return {
      fps: Math.round(fps),
      frameDrops: this.frameDropCount,
      averageFrameTime: Math.round(averageFrameTime * 100) / 100,
      isPerformant
    };
  }

  /**
   * Register an active animation
   */
  registerAnimation(id: string): boolean {
    if (this.activeAnimations.size >= this.config.maxConcurrentAnimations) {
      console.warn(`Animation limit reached (${this.config.maxConcurrentAnimations}). Skipping animation: ${id}`);
      return false;
    }
    
    this.activeAnimations.add(id);
    return true;
  }

  /**
   * Unregister an animation
   */
  unregisterAnimation(id: string): void {
    this.activeAnimations.delete(id);
  }

  /**
   * Get optimized animation config based on current performance
   */
  getOptimizedConfig(): {
    shouldReduceAnimations: boolean;
    recommendedDuration: number;
    shouldUseGPU: boolean;
    maxConcurrent: number;
  } {
    const metrics = this.getMetrics();
    const shouldReduceAnimations = !metrics.isPerformant || metrics.fps < 45;
    
    return {
      shouldReduceAnimations,
      recommendedDuration: shouldReduceAnimations ? 0.3 : 0.6,
      shouldUseGPU: this.config.enableGPUAcceleration && metrics.isPerformant,
      maxConcurrent: shouldReduceAnimations ? 5 : this.config.maxConcurrentAnimations
    };
  }

  /**
   * Apply performance optimizations to an element
   */
  optimizeElement(element: HTMLElement, animationType: 'transform' | 'opacity' | 'filter' = 'transform'): void {
    if (!this.config.enableGPUAcceleration) return;

    const style = element.style;
    
    // Enable GPU acceleration
    if (this.config.enableTransform3D) {
      style.transform = style.transform || 'translateZ(0)';
    }
    
    // Set will-change property
    if (this.config.enableWillChange) {
      const willChangeProps = [];
      
      switch (animationType) {
        case 'transform':
          willChangeProps.push('transform');
          break;
        case 'opacity':
          willChangeProps.push('opacity');
          break;
        case 'filter':
          willChangeProps.push('filter');
          break;
      }
      
      style.willChange = willChangeProps.join(', ');
    }
    
    // Enable hardware acceleration hints
    style.backfaceVisibility = 'hidden';
    style.perspective = '1000px';
  }

  /**
   * Clean up optimizations from an element
   */
  cleanupElement(element: HTMLElement): void {
    const style = element.style;
    style.willChange = 'auto';
    style.backfaceVisibility = '';
    style.perspective = '';
  }

  /**
   * Get CSS properties for optimized animations
   */
  getOptimizedCSS(animationType: 'transform' | 'opacity' | 'filter' = 'transform'): Record<string, string> {
    const css: Record<string, string> = {};
    
    if (this.config.enableGPUAcceleration) {
      css.backfaceVisibility = 'hidden';
      css.perspective = '1000px';
      
      if (this.config.enableTransform3D) {
        css.transform = 'translateZ(0)';
      }
    }
    
    if (this.config.enableWillChange) {
      switch (animationType) {
        case 'transform':
          css.willChange = 'transform';
          break;
        case 'opacity':
          css.willChange = 'opacity';
          break;
        case 'filter':
          css.willChange = 'filter';
          break;
      }
    }
    
    return css;
  }

  /**
   * Throttle animation updates based on performance
   */
  throttleAnimation<T extends (...args: any[]) => void>(
    callback: T,
    delay: number = 16.67 // 60fps
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeoutId: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      const now = performance.now();
      const timeSinceLastCall = now - lastCall;
      
      if (timeSinceLastCall >= delay) {
        lastCall = now;
        callback(...args);
      } else {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastCall = performance.now();
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    };
  }

  /**
   * Debounce animation updates
   */
  debounceAnimation<T extends (...args: any[]) => void>(
    callback: T,
    delay: number = 100
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => callback(...args), delay);
    };
  }

  /**
   * Check if device supports hardware acceleration
   */
  supportsHardwareAcceleration(): boolean {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  }

  /**
   * Detect device performance tier
   */
  getDevicePerformanceTier(): 'low' | 'medium' | 'high' {
    // Check hardware concurrency (CPU cores)
    const cores = navigator.hardwareConcurrency || 2;
    
    // Check memory (if available)
    const memory = (navigator as any).deviceMemory || 4;
    
    // Check GPU support
    const hasGPU = this.supportsHardwareAcceleration();
    
    // Simple heuristic for performance tier
    if (cores >= 8 && memory >= 8 && hasGPU) {
      return 'high';
    } else if (cores >= 4 && memory >= 4 && hasGPU) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get recommended animation settings based on device
   */
  getDeviceOptimizedSettings(): {
    enableComplexAnimations: boolean;
    maxAnimationDuration: number;
    enableParallax: boolean;
    enableBlur: boolean;
    staggerDelay: number;
  } {
    const tier = this.getDevicePerformanceTier();
    const metrics = this.getMetrics();
    
    switch (tier) {
      case 'high':
        return {
          enableComplexAnimations: metrics.isPerformant,
          maxAnimationDuration: 1.0,
          enableParallax: true,
          enableBlur: true,
          staggerDelay: 0.1
        };
      
      case 'medium':
        return {
          enableComplexAnimations: metrics.isPerformant,
          maxAnimationDuration: 0.6,
          enableParallax: metrics.isPerformant,
          enableBlur: false,
          staggerDelay: 0.05
        };
      
      case 'low':
      default:
        return {
          enableComplexAnimations: false,
          maxAnimationDuration: 0.3,
          enableParallax: false,
          enableBlur: false,
          staggerDelay: 0
        };
    }
  }
}

// Global performance manager instance
export const animationPerformanceManager = new AnimationPerformanceManager();

/**
 * Hook for performance-optimized animations
 */
export function useAnimationPerformance() {
  const [metrics, setMetrics] = React.useState<AnimationMetrics>({
    fps: 60,
    frameDrops: 0,
    averageFrameTime: 16.67,
    isPerformant: true
  });

  React.useEffect(() => {
    animationPerformanceManager.startMonitoring();
    
    const interval = setInterval(() => {
      setMetrics(animationPerformanceManager.getMetrics());
    }, 1000);
    
    return () => {
      clearInterval(interval);
      animationPerformanceManager.stopMonitoring();
    };
  }, []);

  return {
    metrics,
    optimizedConfig: animationPerformanceManager.getOptimizedConfig(),
    deviceSettings: animationPerformanceManager.getDeviceOptimizedSettings(),
    registerAnimation: animationPerformanceManager.registerAnimation.bind(animationPerformanceManager),
    unregisterAnimation: animationPerformanceManager.unregisterAnimation.bind(animationPerformanceManager),
    optimizeElement: animationPerformanceManager.optimizeElement.bind(animationPerformanceManager),
    cleanupElement: animationPerformanceManager.cleanupElement.bind(animationPerformanceManager)
  };
}

/**
 * Performance-optimized animation variants
 */
export const performanceOptimizedVariants = {
  // GPU-accelerated transforms
  slideUp: {
    hidden: { 
      opacity: 0, 
      y: 30,
      transform: 'translateZ(0)' // Force GPU layer
    },
    visible: { 
      opacity: 1, 
      y: 0,
      transform: 'translateZ(0)',
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  },
  
  // Optimized scale animation
  scale: {
    hidden: { 
      opacity: 0, 
      scale: 0.95,
      transform: 'translateZ(0) scale(0.95)'
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      transform: 'translateZ(0) scale(1)',
      transition: {
        duration: 0.4,
        ease: 'easeOut'
      }
    }
  },
  
  // Optimized fade animation
  fade: {
    hidden: { 
      opacity: 0,
      transform: 'translateZ(0)'
    },
    visible: { 
      opacity: 1,
      transform: 'translateZ(0)',
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    }
  }
};

export default AnimationPerformanceManager;