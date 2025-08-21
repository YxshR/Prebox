'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { useResponsiveMedia } from './useResponsiveMedia';

interface MicroInteractionConfig {
  enableHaptics?: boolean;
  enableSounds?: boolean;
  hoverScale?: number;
  tapScale?: number;
  springConfig?: {
    stiffness: number;
    damping: number;
  };
}

interface InteractionState {
  isHovered: boolean;
  isPressed: boolean;
  isFocused: boolean;
  isActive: boolean;
}

/**
 * Hook for micro-interactions and hover effects
 * Requirement 4.2: Hover effects and micro-interactions for interactive elements
 */
export function useMicroInteractions(config: MicroInteractionConfig = {}) {
  const {
    enableHaptics = true,
    enableSounds = false,
    hoverScale = 1.05,
    tapScale = 0.95,
    springConfig = { stiffness: 300, damping: 25 }
  } = config;

  const { reducedMotion, touchSupported, canUseHeavyAnimations } = useResponsiveMedia();
  const [state, setState] = useState<InteractionState>({
    isHovered: false,
    isPressed: false,
    isFocused: false,
    isActive: false
  });

  const controls = useAnimation();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);

  // Haptic feedback (if supported)
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!enableHaptics || !navigator.vibrate || reducedMotion) return;
    
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30]
    };
    
    navigator.vibrate(patterns[type]);
  }, [enableHaptics, reducedMotion]);

  // Sound feedback (placeholder for future implementation)
  const triggerSound = useCallback((soundType: 'hover' | 'click' | 'success' = 'click') => {
    if (!enableSounds || reducedMotion) return;
    // Future: Implement sound feedback
    console.log(`Sound: ${soundType}`);
  }, [enableSounds, reducedMotion]);

  // Hover handlers
  const handleHoverStart = useCallback(() => {
    if (reducedMotion) return;
    
    setState(prev => ({ ...prev, isHovered: true }));
    
    controls.start({
      scale: hoverScale,
      y: -2,
      transition: {
        type: 'spring',
        ...springConfig,
        duration: 0.2
      }
    });

    triggerSound('hover');
  }, [controls, hoverScale, springConfig, reducedMotion, triggerSound]);

  const handleHoverEnd = useCallback(() => {
    if (reducedMotion) return;
    
    setState(prev => ({ ...prev, isHovered: false }));
    
    controls.start({
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        ...springConfig,
        duration: 0.2
      }
    });
  }, [controls, springConfig, reducedMotion]);

  // Tap/Click handlers
  const handleTapStart = useCallback(() => {
    setState(prev => ({ ...prev, isPressed: true }));
    
    if (reducedMotion) return;
    
    controls.start({
      scale: tapScale,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 20,
        duration: 0.1
      }
    });

    triggerHaptic('light');
  }, [controls, tapScale, reducedMotion, triggerHaptic]);

  const handleTapEnd = useCallback(() => {
    setState(prev => ({ ...prev, isPressed: false }));
    
    if (reducedMotion) return;
    
    controls.start({
      scale: state.isHovered ? hoverScale : 1,
      transition: {
        type: 'spring',
        ...springConfig,
        duration: 0.15
      }
    });

    triggerSound('click');
  }, [controls, state.isHovered, hoverScale, springConfig, reducedMotion, triggerSound]);

  // Focus handlers
  const handleFocus = useCallback(() => {
    setState(prev => ({ ...prev, isFocused: true }));
    
    if (reducedMotion) return;
    
    controls.start({
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.5)',
      transition: { duration: 0.2 }
    });
  }, [controls, reducedMotion]);

  const handleBlur = useCallback(() => {
    setState(prev => ({ ...prev, isFocused: false }));
    
    if (reducedMotion) return;
    
    controls.start({
      boxShadow: '0 0 0 0px rgba(59, 130, 246, 0)',
      transition: { duration: 0.2 }
    });
  }, [controls, reducedMotion]);

  // Mouse tracking for advanced effects
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (reducedMotion || !canUseHeavyAnimations) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (event.clientX - centerX) * 0.1;
    const deltaY = (event.clientY - centerY) * 0.1;
    
    x.set(deltaX);
    y.set(deltaY);
  }, [x, y, reducedMotion, canUseHeavyAnimations]);

  const handleMouseLeave = useCallback(() => {
    if (reducedMotion) return;
    
    x.set(0);
    y.set(0);
  }, [x, y, reducedMotion]);

  // Gesture variants for different interaction types
  const getButtonVariants = useCallback(() => {
    if (reducedMotion) {
      return {
        idle: { opacity: 1 },
        hover: { opacity: 0.9 },
        tap: { opacity: 0.8 }
      };
    }

    return {
      idle: {
        scale: 1,
        y: 0,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        transition: {
          type: 'spring',
          ...springConfig
        }
      },
      hover: {
        scale: hoverScale,
        y: -2,
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        transition: {
          type: 'spring',
          ...springConfig
        }
      },
      tap: {
        scale: tapScale,
        y: 0,
        boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        transition: {
          type: 'spring',
          stiffness: 400,
          damping: 20
        }
      }
    };
  }, [reducedMotion, hoverScale, tapScale, springConfig]);

  const getCardVariants = useCallback(() => {
    if (reducedMotion) {
      return {
        idle: { opacity: 1 },
        hover: { opacity: 1 }
      };
    }

    return {
      idle: {
        scale: 1,
        rotateY: 0,
        z: 0,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        transition: {
          type: 'spring',
          ...springConfig
        }
      },
      hover: {
        scale: 1.02,
        rotateY: 2,
        z: 50,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        transition: {
          type: 'spring',
          ...springConfig
        }
      }
    };
  }, [reducedMotion, springConfig]);

  const getIconVariants = useCallback(() => {
    if (reducedMotion) {
      return {
        idle: { rotate: 0 },
        hover: { rotate: 0 },
        tap: { rotate: 0 }
      };
    }

    return {
      idle: {
        rotate: 0,
        scale: 1,
        transition: {
          type: 'spring',
          ...springConfig
        }
      },
      hover: {
        rotate: 5,
        scale: 1.1,
        transition: {
          type: 'spring',
          ...springConfig
        }
      },
      tap: {
        rotate: -5,
        scale: 0.95,
        transition: {
          type: 'spring',
          stiffness: 400,
          damping: 20
        }
      }
    };
  }, [reducedMotion, springConfig]);

  // Magnetic effect for buttons
  const getMagneticEffect = useCallback((strength: number = 0.3) => {
    if (reducedMotion || !canUseHeavyAnimations) return {};
    
    return {
      x: useTransform(x, [-100, 100], [-100 * strength, 100 * strength]),
      y: useTransform(y, [-100, 100], [-100 * strength, 100 * strength])
    };
  }, [x, y, reducedMotion, canUseHeavyAnimations]);

  // Ripple effect for material design interactions
  const createRippleEffect = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (reducedMotion) return;
    
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.6);
      transform: scale(0);
      animation: ripple 0.6s linear;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      pointer-events: none;
    `;
    
    button.appendChild(ripple);
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }, [reducedMotion]);

  return {
    state,
    controls,
    
    // Event handlers
    handleHoverStart,
    handleHoverEnd,
    handleTapStart,
    handleTapEnd,
    handleFocus,
    handleBlur,
    handleMouseMove,
    handleMouseLeave,
    
    // Variants
    getButtonVariants,
    getCardVariants,
    getIconVariants,
    
    // Effects
    getMagneticEffect,
    createRippleEffect,
    
    // Feedback
    triggerHaptic,
    triggerSound,
    
    // Motion values
    x,
    y,
    scale,
    
    // Utility
    shouldAnimate: !reducedMotion && canUseHeavyAnimations,
    touchSupported
  };
}

/**
 * Hook for loading animations and transitions
 * Requirement 4.3: Smooth page transitions and loading animations
 */
export function useLoadingAnimations() {
  const { reducedMotion, canUseHeavyAnimations } = useResponsiveMedia();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const controls = useAnimation();

  // Simulate loading progress
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          setIsLoading(false);
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Loading spinner variants
  const spinnerVariants = {
    loading: {
      rotate: 360,
      transition: {
        duration: reducedMotion ? 0 : 1,
        repeat: Infinity,
        ease: 'linear'
      }
    }
  };

  // Progress bar variants
  const progressVariants = {
    loading: {
      scaleX: loadingProgress / 100,
      transition: {
        duration: reducedMotion ? 0 : 0.3,
        ease: 'easeOut'
      }
    }
  };

  // Page transition variants
  const pageVariants = {
    initial: {
      opacity: 0,
      y: reducedMotion ? 0 : 20,
      scale: reducedMotion ? 1 : 0.98
    },
    enter: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: reducedMotion ? 0.1 : 0.6,
        ease: [0.25, 0.46, 0.45, 0.94],
        when: 'beforeChildren',
        staggerChildren: reducedMotion ? 0 : 0.1
      }
    },
    exit: {
      opacity: 0,
      y: reducedMotion ? 0 : -20,
      scale: reducedMotion ? 1 : 1.02,
      transition: {
        duration: reducedMotion ? 0.1 : 0.4,
        ease: 'easeInOut'
      }
    }
  };

  // Skeleton loading variants
  const skeletonVariants = {
    loading: {
      opacity: [0.5, 1, 0.5],
      transition: {
        duration: reducedMotion ? 0 : 1.5,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  };

  return {
    isLoading,
    loadingProgress,
    controls,
    
    // Variants
    spinnerVariants,
    progressVariants,
    pageVariants,
    skeletonVariants,
    
    // Utilities
    setIsLoading,
    setLoadingProgress,
    shouldAnimate: !reducedMotion && canUseHeavyAnimations
  };
}