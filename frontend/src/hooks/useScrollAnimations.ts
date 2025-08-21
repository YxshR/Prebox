'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useScroll, useTransform, useSpring, MotionValue } from 'framer-motion';
import { useResponsiveMedia } from './useResponsiveMedia';

interface ScrollAnimationConfig {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  staggerDelay?: number;
  enableParallax?: boolean;
  parallaxSpeed?: number;
}

interface ScrollAnimationState {
  isVisible: boolean;
  progress: number;
  direction: 'up' | 'down';
  velocity: number;
}

/**
 * Hook for scroll-triggered animations with performance optimization
 * Requirement 4.1: Scroll-triggered animations for content sections
 */
export function useScrollAnimations(config: ScrollAnimationConfig = {}) {
  const {
    threshold = 0.1,
    rootMargin = '-50px',
    triggerOnce = true,
    staggerDelay = 0.1,
    enableParallax = false,
    parallaxSpeed = 0.5
  } = config;

  const { reducedMotion, canUseHeavyAnimations, isMobile } = useResponsiveMedia();
  const [state, setState] = useState<ScrollAnimationState>({
    isVisible: false,
    progress: 0,
    direction: 'down',
    velocity: 0
  });

  const elementRef = useRef<HTMLElement>(null);
  const { scrollY, scrollYProgress } = useScroll();
  const [lastScrollY, setLastScrollY] = useState(0);

  // Smooth spring animation for scroll progress
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Parallax transform
  const parallaxY = useTransform(
    scrollY,
    [0, 1000],
    [0, enableParallax ? 1000 * parallaxSpeed : 0]
  );

  // Intersection Observer for visibility detection
  useEffect(() => {
    if (!elementRef.current || reducedMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setState(prev => ({
          ...prev,
          isVisible: entry.isIntersecting,
          progress: entry.intersectionRatio
        }));
      },
      {
        threshold: Array.from({ length: 11 }, (_, i) => i * 0.1),
        rootMargin: isMobile ? '-20px' : rootMargin
      }
    );

    observer.observe(elementRef.current);

    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce, reducedMotion, isMobile]);

  // Scroll direction and velocity tracking
  useEffect(() => {
    const unsubscribe = scrollY.on('change', (latest) => {
      const direction = latest > lastScrollY ? 'down' : 'up';
      const velocity = Math.abs(latest - lastScrollY);
      
      setState(prev => ({
        ...prev,
        direction,
        velocity: Math.min(velocity, 50) // Cap velocity for smooth animations
      }));
      
      setLastScrollY(latest);
    });

    return unsubscribe;
  }, [scrollY, lastScrollY]);

  // Animation variants for different scroll states
  const getScrollVariants = useCallback((index: number = 0) => {
    if (reducedMotion) {
      return {
        hidden: { opacity: 0.7 },
        visible: { opacity: 1 }
      };
    }

    return {
      hidden: {
        opacity: 0,
        y: 60,
        scale: 0.95,
        rotateX: 10,
        filter: 'blur(4px)'
      },
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        rotateX: 0,
        filter: 'blur(0px)',
        transition: {
          duration: canUseHeavyAnimations ? 0.8 : 0.4,
          delay: index * staggerDelay,
          ease: [0.25, 0.46, 0.45, 0.94],
          type: 'spring',
          stiffness: 100,
          damping: 15
        }
      },
      exit: {
        opacity: 0,
        y: -30,
        scale: 1.05,
        transition: {
          duration: 0.3,
          ease: 'easeInOut'
        }
      }
    };
  }, [reducedMotion, canUseHeavyAnimations, staggerDelay]);

  // Staggered children animation
  const getStaggeredVariants = useCallback((totalItems: number) => {
    return {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: reducedMotion ? 0 : staggerDelay,
          delayChildren: 0.1,
          when: 'beforeChildren'
        }
      }
    };
  }, [reducedMotion, staggerDelay]);

  // Parallax scroll effects
  const getParallaxTransform = useCallback((speed: number = parallaxSpeed) => {
    if (reducedMotion || !enableParallax) return {};
    
    return {
      y: useTransform(scrollY, [0, 1000], [0, 1000 * speed])
    };
  }, [scrollY, parallaxSpeed, enableParallax, reducedMotion]);

  // Scroll-based scale animation
  const getScrollScale = useCallback((range: [number, number] = [0.8, 1.2]) => {
    if (reducedMotion) return {};
    
    return {
      scale: useTransform(smoothProgress, [0, 1], range)
    };
  }, [smoothProgress, reducedMotion]);

  // Scroll-based opacity animation
  const getScrollOpacity = useCallback((range: [number, number] = [0, 1]) => {
    return {
      opacity: useTransform(smoothProgress, [0, 1], range)
    };
  }, [smoothProgress]);

  return {
    ref: elementRef,
    state,
    parallaxY,
    smoothProgress,
    
    // Animation variants
    getScrollVariants,
    getStaggeredVariants,
    getParallaxTransform,
    getScrollScale,
    getScrollOpacity,
    
    // Utility functions
    isVisible: state.isVisible,
    progress: state.progress,
    direction: state.direction,
    velocity: state.velocity,
    
    // Performance flags
    shouldAnimate: !reducedMotion && canUseHeavyAnimations,
    shouldUseParallax: enableParallax && !reducedMotion && !isMobile
  };
}

/**
 * Hook for scroll-triggered reveal animations with intersection observer
 * Requirement 4.1: Smooth reveal animations for content sections
 */
export function useScrollReveal(options: ScrollAnimationConfig = {}) {
  const { threshold = 0.1, triggerOnce = true } = options;
  const { reducedMotion } = useResponsiveMedia();
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!elementRef.current || reducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && (!triggerOnce || !hasTriggered)) {
          setIsVisible(true);
          setHasTriggered(true);
        } else if (!triggerOnce) {
          setIsVisible(entry.isIntersecting);
        }
      },
      { threshold }
    );

    observer.observe(elementRef.current);

    return () => observer.disconnect();
  }, [threshold, triggerOnce, hasTriggered, reducedMotion]);

  const variants = {
    hidden: {
      opacity: 0,
      y: reducedMotion ? 0 : 40,
      scale: reducedMotion ? 1 : 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: reducedMotion ? 0.1 : 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  return {
    ref: elementRef,
    isVisible,
    variants,
    controls: isVisible ? 'visible' : 'hidden'
  };
}

/**
 * Hook for performance-optimized scroll effects
 * Requirement 4.4: Optimize animations for 60fps performance
 */
export function useOptimizedScroll() {
  const { scrollY } = useScroll();
  const { canUseHeavyAnimations, reducedMotion } = useResponsiveMedia();
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Throttled scroll detection
  useEffect(() => {
    const unsubscribe = scrollY.on('change', () => {
      if (!isScrolling) {
        setIsScrolling(true);
      }

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set new timeout
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    });

    return () => {
      unsubscribe();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollY, isScrolling]);

  // Performance-optimized transform functions
  const createOptimizedTransform = useCallback((
    inputRange: number[],
    outputRange: number[],
    property: 'y' | 'x' | 'scale' | 'rotate' = 'y'
  ) => {
    if (reducedMotion) return {};
    
    return {
      [property]: useTransform(scrollY, inputRange, outputRange)
    };
  }, [scrollY, reducedMotion]);

  return {
    scrollY,
    isScrolling,
    canUseHeavyAnimations,
    createOptimizedTransform,
    
    // Performance utilities
    shouldReduceAnimations: isScrolling && !canUseHeavyAnimations,
    animationConfig: {
      type: canUseHeavyAnimations ? 'spring' : 'tween',
      stiffness: canUseHeavyAnimations ? 100 : 200,
      damping: canUseHeavyAnimations ? 15 : 25,
      duration: reducedMotion ? 0.1 : canUseHeavyAnimations ? 0.8 : 0.4
    }
  };
}