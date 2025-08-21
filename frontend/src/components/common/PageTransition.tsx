'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useResponsiveMedia } from '../../hooks/useResponsiveMedia';
import { LoadingAnimation } from './PremiumAnimations';

interface PageTransitionProps {
  children: ReactNode;
  type?: 'fade' | 'slide' | 'scale' | 'rotate' | 'curtain' | 'morphing';
  duration?: number;
  showLoader?: boolean;
  className?: string;
}

interface TransitionLoaderProps {
  isVisible: boolean;
  type?: 'spinner' | 'progress' | 'dots' | 'pulse' | 'skeleton';
  message?: string;
}

/**
 * Page Transition Component with smooth animations
 * Requirement 4.3: Smooth page transitions and loading animations
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  type = 'fade',
  duration = 0.6,
  showLoader = true,
  className = ''
}) => {
  const pathname = usePathname();
  const { reducedMotion, canUseHeavyAnimations } = useResponsiveMedia();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Simulate loading for demonstration
  useEffect(() => {
    if (!showLoader) return;

    setIsLoading(true);
    setLoadingProgress(0);

    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          setIsLoading(false);
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 20 + 10;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [pathname, showLoader]);

  const getTransitionVariants = (): Variants => {
    const baseDuration = reducedMotion ? 0.1 : canUseHeavyAnimations ? duration : duration * 0.5;
    const easing = [0.25, 0.46, 0.45, 0.94];

    if (reducedMotion) {
      return {
        initial: { opacity: 0.7 },
        enter: { opacity: 1, transition: { duration: 0.1 } },
        exit: { opacity: 0.7, transition: { duration: 0.1 } }
      };
    }

    switch (type) {
      case 'fade':
        return {
          initial: { opacity: 0 },
          enter: { 
            opacity: 1, 
            transition: { 
              duration: baseDuration, 
              ease: easing 
            } 
          },
          exit: { 
            opacity: 0, 
            transition: { 
              duration: baseDuration * 0.5, 
              ease: easing 
            } 
          }
        };

      case 'slide':
        return {
          initial: { opacity: 0, x: 100 },
          enter: { 
            opacity: 1, 
            x: 0, 
            transition: { 
              duration: baseDuration, 
              ease: easing 
            } 
          },
          exit: { 
            opacity: 0, 
            x: -100, 
            transition: { 
              duration: baseDuration * 0.5, 
              ease: easing 
            } 
          }
        };

      case 'scale':
        return {
          initial: { opacity: 0, scale: 0.9 },
          enter: { 
            opacity: 1, 
            scale: 1, 
            transition: { 
              duration: baseDuration, 
              ease: easing 
            } 
          },
          exit: { 
            opacity: 0, 
            scale: 1.1, 
            transition: { 
              duration: baseDuration * 0.5, 
              ease: easing 
            } 
          }
        };

      case 'rotate':
        return {
          initial: { opacity: 0, rotateY: -90, scale: 0.8 },
          enter: { 
            opacity: 1, 
            rotateY: 0, 
            scale: 1, 
            transition: { 
              duration: baseDuration, 
              ease: easing 
            } 
          },
          exit: { 
            opacity: 0, 
            rotateY: 90, 
            scale: 0.8, 
            transition: { 
              duration: baseDuration * 0.5, 
              ease: easing 
            } 
          }
        };

      case 'curtain':
        return {
          initial: { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
          enter: { 
            opacity: 1, 
            clipPath: 'inset(0 0% 0 0)', 
            transition: { 
              duration: baseDuration, 
              ease: easing 
            } 
          },
          exit: { 
            opacity: 0, 
            clipPath: 'inset(0 0 0 100%)', 
            transition: { 
              duration: baseDuration * 0.5, 
              ease: easing 
            } 
          }
        };

      case 'morphing':
        return {
          initial: { 
            opacity: 0, 
            scale: 0.8, 
            borderRadius: '50%',
            filter: 'blur(10px)'
          },
          enter: { 
            opacity: 1, 
            scale: 1, 
            borderRadius: '0%',
            filter: 'blur(0px)',
            transition: { 
              duration: baseDuration, 
              ease: easing 
            } 
          },
          exit: { 
            opacity: 0, 
            scale: 1.2, 
            borderRadius: '50%',
            filter: 'blur(10px)',
            transition: { 
              duration: baseDuration * 0.5, 
              ease: easing 
            } 
          }
        };

      default:
        return {
          initial: { opacity: 0 },
          enter: { opacity: 1 },
          exit: { opacity: 0 }
        };
    }
  };

  return (
    <>
      <TransitionLoader 
        isVisible={isLoading} 
        type="progress"
        message="Loading..."
      />
      
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          variants={getTransitionVariants()}
          initial="initial"
          animate="enter"
          exit="exit"
          className={className}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
};

/**
 * Transition Loader Component
 * Requirement 4.3: Loading animations during transitions
 */
const TransitionLoader: React.FC<TransitionLoaderProps> = ({
  isVisible,
  type = 'spinner',
  message = 'Loading...'
}) => {
  const { reducedMotion } = useResponsiveMedia();

  const loaderVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8,
      transition: { duration: reducedMotion ? 0.1 : 0.3 }
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: reducedMotion ? 0.1 : 0.3 }
    }
  };

  const backdropVariants = {
    hidden: { 
      opacity: 0,
      transition: { duration: reducedMotion ? 0.1 : 0.2 }
    },
    visible: { 
      opacity: 1,
      transition: { duration: reducedMotion ? 0.1 : 0.2 }
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <motion.div
            variants={loaderVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="flex flex-col items-center space-y-4"
          >
            <LoadingAnimation type={type} size="lg" color="#3B82F6" />
            
            {message && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: reducedMotion ? 0.1 : 0.4 }}
                className="text-gray-600 font-medium"
              >
                {message}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Route Transition Wrapper for Next.js pages
 * Requirement 4.3: Smooth page transitions
 */
interface RouteTransitionProps {
  children: ReactNode;
  className?: string;
}

export const RouteTransition: React.FC<RouteTransitionProps> = ({
  children,
  className = ''
}) => {
  const pathname = usePathname();
  const { reducedMotion } = useResponsiveMedia();

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

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Modal Transition Component
 * Requirement 4.3: Smooth modal animations
 */
interface ModalTransitionProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

export const ModalTransition: React.FC<ModalTransitionProps> = ({
  isOpen,
  onClose,
  children,
  size = 'md',
  className = ''
}) => {
  const { reducedMotion } = useResponsiveMedia();

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4'
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: reducedMotion ? 0.1 : 0.3 }
    }
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: reducedMotion ? 1 : 0.8,
      y: reducedMotion ? 0 : 50
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: reducedMotion ? 0.1 : 0.4,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className={`
              bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} 
              max-h-[90vh] overflow-auto ${className}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PageTransition;