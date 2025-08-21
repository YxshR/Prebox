'use client';

import { useState, useEffect, useCallback } from 'react';

interface BreakpointConfig {
  mobile: number;
  tablet: number;
  desktop: number;
  largeDesktop: number;
}

interface ResponsiveMediaConfig {
  breakpoints?: BreakpointConfig;
  enableTouchGestures?: boolean;
  autoPlayOnMobile?: boolean;
  reducedMotion?: boolean;
}

interface ResponsiveMediaState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
  touchSupported: boolean;
  reducedMotion: boolean;
  connectionSpeed: 'slow' | 'fast' | 'unknown';
}

const defaultBreakpoints: BreakpointConfig = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
  largeDesktop: 1920
};

export function useResponsiveMedia(config: ResponsiveMediaConfig = {}) {
  const {
    breakpoints = defaultBreakpoints,
    enableTouchGestures = true,
    autoPlayOnMobile = false,
    reducedMotion = false
  } = config;

  const [state, setState] = useState<ResponsiveMediaState>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isLargeDesktop: false,
    screenWidth: 0,
    screenHeight: 0,
    orientation: 'portrait',
    touchSupported: false,
    reducedMotion: false,
    connectionSpeed: 'unknown'
  });

  const updateScreenInfo = useCallback(() => {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const orientation = width > height ? 'landscape' : 'portrait';
    
    // Detect touch support
    const touchSupported = 'ontouchstart' in window || 
                          navigator.maxTouchPoints > 0 || 
                          (navigator as any).msMaxTouchPoints > 0;

    // Detect reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Detect connection speed (if available)
    let connectionSpeed: 'slow' | 'fast' | 'unknown' = 'unknown';
    if ('connection' in navigator) {
      const connection = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
      if (connection && connection.effectiveType) {
        const effectiveType = connection.effectiveType;
        connectionSpeed = ['slow-2g', '2g', '3g'].includes(effectiveType) ? 'slow' : 'fast';
      }
    }

    setState({
      isMobile: width < breakpoints.mobile,
      isTablet: width >= breakpoints.mobile && width < breakpoints.desktop,
      isDesktop: width >= breakpoints.desktop && width < breakpoints.largeDesktop,
      isLargeDesktop: width >= breakpoints.largeDesktop,
      screenWidth: width,
      screenHeight: height,
      orientation,
      touchSupported,
      reducedMotion: reducedMotion || prefersReducedMotion,
      connectionSpeed
    });
  }, [breakpoints, reducedMotion]);

  useEffect(() => {
    updateScreenInfo();

    const handleResize = () => {
      updateScreenInfo();
    };

    const handleOrientationChange = () => {
      // Delay to ensure dimensions are updated after orientation change
      setTimeout(updateScreenInfo, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    // Listen for reduced motion preference changes
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = () => {
      updateScreenInfo();
    };
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMotionChange);
    } else {
      // Fallback for older browsers
      (mediaQuery as unknown as { addListener: (listener: () => void) => void }).addListener(handleMotionChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMotionChange);
      } else {
        (mediaQuery as unknown as { removeListener: (listener: () => void) => void }).removeListener(handleMotionChange);
      }
    };
  }, [updateScreenInfo]);

  // Media optimization helpers
  const getOptimalImageSize = useCallback((baseWidth: number, baseHeight: number) => {
    const { isMobile, isTablet, screenWidth } = state;
    
    let multiplier = 1;
    if (isMobile) {
      multiplier = Math.min(screenWidth / baseWidth, 1);
    } else if (isTablet) {
      multiplier = Math.min(screenWidth * 0.8 / baseWidth, 1);
    }
    
    return {
      width: Math.round(baseWidth * multiplier),
      height: Math.round(baseHeight * multiplier)
    };
  }, [state]);

  const shouldAutoPlay = useCallback(() => {
    const { isMobile, connectionSpeed, reducedMotion } = state;
    
    if (reducedMotion) return false;
    if (isMobile && !autoPlayOnMobile) return false;
    if (connectionSpeed === 'slow') return false;
    
    return true;
  }, [state, autoPlayOnMobile]);

  const getAnimationDuration = useCallback((baseDuration: number) => {
    const { reducedMotion, connectionSpeed } = state;
    
    if (reducedMotion) return 0;
    if (connectionSpeed === 'slow') return baseDuration * 0.5;
    
    return baseDuration;
  }, [state]);

  const getTouchGestureConfig = useCallback(() => {
    const { touchSupported, isMobile } = state;
    
    return {
      enabled: enableTouchGestures && touchSupported,
      swipeThreshold: isMobile ? 50 : 100,
      velocityThreshold: 0.3,
      directionalOffsetThreshold: 80
    };
  }, [state, enableTouchGestures]);

  const getMediaQuality = useCallback(() => {
    const { isMobile, connectionSpeed, screenWidth } = state;
    
    if (connectionSpeed === 'slow') return 'low';
    if (isMobile && screenWidth < 480) return 'medium';
    if (screenWidth >= 1920) return 'high';
    
    return 'medium';
  }, [state]);

  const getGridColumns = useCallback((maxColumns: number = 4) => {
    const { isMobile, isTablet, screenWidth } = state;
    
    if (isMobile) {
      return screenWidth < 480 ? 1 : 2;
    } else if (isTablet) {
      return 3;
    } else {
      return Math.min(maxColumns, Math.floor(screenWidth / 300));
    }
  }, [state]);

  return {
    ...state,
    // Helper functions
    getOptimalImageSize,
    shouldAutoPlay,
    getAnimationDuration,
    getTouchGestureConfig,
    getMediaQuality,
    getGridColumns,
    
    // Utility getters
    isSmallScreen: state.isMobile || (state.isTablet && state.screenWidth < 900),
    isLargeScreen: state.isDesktop || state.isLargeDesktop,
    aspectRatio: state.screenWidth / state.screenHeight,
    
    // Media queries as booleans
    canUseHeavyAnimations: !state.reducedMotion && state.connectionSpeed !== 'slow',
    shouldLazyLoad: state.isMobile || state.connectionSpeed === 'slow',
    shouldPreloadMedia: !state.isMobile && state.connectionSpeed === 'fast'
  };
}

// Hook for touch gesture handling
export function useTouchGestures(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void
) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isUpSwipe = distanceY > minSwipeDistance;
    const isDownSwipe = distanceY < -minSwipeDistance;

    // Determine if horizontal or vertical swipe is more prominent
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (isLeftSwipe) onSwipeLeft?.();
      if (isRightSwipe) onSwipeRight?.();
    } else {
      if (isUpSwipe) onSwipeUp?.();
      if (isDownSwipe) onSwipeDown?.();
    }
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd: onTouchEndHandler
  };
}

// Hook for intersection observer with responsive thresholds
export function useResponsiveIntersection(options?: IntersectionObserverInit) {
  const { isMobile } = useResponsiveMedia();
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [ref, setRef] = useState<Element | null>(null);

  useEffect(() => {
    if (!ref) return;

    const threshold = isMobile ? 0.1 : 0.3;
    const rootMargin = isMobile ? '-50px' : '-100px';

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold,
        rootMargin,
        ...options
      }
    );

    observer.observe(ref);

    return () => {
      observer.disconnect();
    };
  }, [ref, isMobile, options]);

  return [setRef, isIntersecting] as const;
}