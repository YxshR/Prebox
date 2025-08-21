'use client';

import React, { forwardRef, ReactNode } from 'react';
import { motion, HTMLMotionProps, Variants } from 'framer-motion';
import { useScrollAnimations, useScrollReveal } from '../../hooks/useScrollAnimations';
import { useMicroInteractions } from '../../hooks/useMicroInteractions';
import { useResponsiveMedia } from '../../hooks/useResponsiveMedia';

interface AnimatedSectionProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  animation?: 'fadeUp' | 'fadeIn' | 'slideLeft' | 'slideRight' | 'scale' | 'rotate' | 'parallax';
  delay?: number;
  duration?: number;
  stagger?: boolean;
  staggerDelay?: number;
  triggerOnce?: boolean;
  threshold?: number;
  className?: string;
}

interface InteractiveElementProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  type?: 'button' | 'card' | 'icon' | 'image';
  hoverScale?: number;
  tapScale?: number;
  enableMagnetic?: boolean;
  enableRipple?: boolean;
  className?: string;
}

interface LoadingAnimationProps {
  type?: 'spinner' | 'dots' | 'pulse' | 'skeleton' | 'progress';
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

/**
 * Animated Section Component with scroll-triggered animations
 * Requirement 4.1: Scroll-triggered animations for content sections
 */
export const AnimatedSection = forwardRef<HTMLDivElement, AnimatedSectionProps>(({
  children,
  animation = 'fadeUp',
  delay = 0,
  duration = 0.6,
  stagger = false,
  staggerDelay = 0.1,
  triggerOnce = true,
  threshold = 0.1,
  className = '',
  ...props
}, ref) => {
  const { reducedMotion, canUseHeavyAnimations } = useResponsiveMedia();
  const { ref: scrollRef, isVisible, variants } = useScrollReveal({
    threshold,
    triggerOnce
  });

  // Combine refs
  const combinedRef = (node: HTMLDivElement) => {
    scrollRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const getAnimationVariants = (): Variants => {
    if (reducedMotion) {
      return {
        hidden: { opacity: 0.7 },
        visible: { opacity: 1, transition: { duration: 0.1 } }
      };
    }

    const baseTransition = {
      duration: canUseHeavyAnimations ? duration : duration * 0.5,
      delay,
      ease: [0.25, 0.46, 0.45, 0.94]
    };

    const staggerTransition = stagger ? {
      ...baseTransition,
      staggerChildren: staggerDelay,
      delayChildren: delay
    } : baseTransition;

    switch (animation) {
      case 'fadeIn':
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: staggerTransition }
        };
      
      case 'fadeUp':
        return {
          hidden: { opacity: 0, y: 60, scale: 0.95 },
          visible: { 
            opacity: 1, 
            y: 0, 
            scale: 1, 
            transition: staggerTransition 
          }
        };
      
      case 'slideLeft':
        return {
          hidden: { opacity: 0, x: 100 },
          visible: { opacity: 1, x: 0, transition: staggerTransition }
        };
      
      case 'slideRight':
        return {
          hidden: { opacity: 0, x: -100 },
          visible: { opacity: 1, x: 0, transition: staggerTransition }
        };
      
      case 'scale':
        return {
          hidden: { opacity: 0, scale: 0.8 },
          visible: { opacity: 1, scale: 1, transition: staggerTransition }
        };
      
      case 'rotate':
        return {
          hidden: { opacity: 0, rotateY: -90, scale: 0.8 },
          visible: { 
            opacity: 1, 
            rotateY: 0, 
            scale: 1, 
            transition: staggerTransition 
          }
        };
      
      case 'parallax':
        return {
          hidden: { opacity: 0, y: 100, rotateX: 45 },
          visible: { 
            opacity: 1, 
            y: 0, 
            rotateX: 0, 
            transition: staggerTransition 
          }
        };
      
      default:
        return variants;
    }
  };

  return (
    <motion.div
      ref={combinedRef}
      variants={getAnimationVariants()}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
});

AnimatedSection.displayName = 'AnimatedSection';

/**
 * Interactive Element Component with micro-interactions
 * Requirement 4.2: Hover effects and micro-interactions for interactive elements
 */
export const InteractiveElement = forwardRef<HTMLDivElement, InteractiveElementProps>(({
  children,
  type = 'button',
  hoverScale = 1.05,
  tapScale = 0.95,
  enableMagnetic = false,
  enableRipple = false,
  className = '',
  onClick,
  ...props
}, ref) => {
  const {
    handleHoverStart,
    handleHoverEnd,
    handleTapStart,
    handleTapEnd,
    handleMouseMove,
    handleMouseLeave,
    getButtonVariants,
    getCardVariants,
    getIconVariants,
    getMagneticEffect,
    createRippleEffect,
    shouldAnimate
  } = useMicroInteractions({
    hoverScale,
    tapScale
  });

  const getVariants = () => {
    switch (type) {
      case 'card':
        return getCardVariants();
      case 'icon':
        return getIconVariants();
      default:
        return getButtonVariants();
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (enableRipple) {
      createRippleEffect(event);
    }
    onClick?.(event);
  };

  const magneticProps = enableMagnetic ? getMagneticEffect() : {};

  return (
    <motion.div
      ref={ref}
      variants={shouldAnimate ? getVariants() : undefined}
      initial="idle"
      whileHover="hover"
      whileTap="tap"
      onHoverStart={shouldAnimate ? handleHoverStart : undefined}
      onHoverEnd={shouldAnimate ? handleHoverEnd : undefined}
      onTapStart={shouldAnimate ? handleTapStart : undefined}
      onTap={shouldAnimate ? handleTapEnd : undefined}
      onMouseMove={enableMagnetic ? handleMouseMove : undefined}
      onMouseLeave={enableMagnetic ? handleMouseLeave : undefined}
      onClick={handleClick}
      className={`${className} ${enableRipple ? 'relative overflow-hidden' : ''}`}
      style={magneticProps}
      {...props}
    >
      {children}
    </motion.div>
  );
});

InteractiveElement.displayName = 'InteractiveElement';

/**
 * Loading Animation Component
 * Requirement 4.3: Smooth loading animations
 */
export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  type = 'spinner',
  size = 'md',
  color = 'currentColor',
  className = ''
}) => {
  const { reducedMotion } = useResponsiveMedia();

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const spinnerVariants = {
    animate: {
      rotate: 360,
      transition: {
        duration: reducedMotion ? 0 : 1,
        repeat: Infinity,
        ease: 'linear'
      }
    }
  };

  const dotsVariants = {
    animate: {
      transition: {
        staggerChildren: reducedMotion ? 0 : 0.2,
        repeat: Infinity,
        repeatType: 'reverse' as const
      }
    }
  };

  const dotVariants = {
    animate: {
      y: reducedMotion ? 0 : [-10, 10],
      transition: {
        duration: reducedMotion ? 0 : 0.6,
        ease: 'easeInOut'
      }
    }
  };

  const pulseVariants = {
    animate: {
      scale: reducedMotion ? 1 : [1, 1.2, 1],
      opacity: reducedMotion ? 1 : [1, 0.7, 1],
      transition: {
        duration: reducedMotion ? 0 : 1.5,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  };

  const skeletonVariants = {
    animate: {
      opacity: reducedMotion ? 1 : [0.5, 1, 0.5],
      transition: {
        duration: reducedMotion ? 0 : 1.5,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  };

  switch (type) {
    case 'spinner':
      return (
        <motion.div
          variants={spinnerVariants}
          animate="animate"
          className={`${sizeClasses[size]} ${className}`}
        >
          <svg
            className="w-full h-full"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="31.416"
              strokeDashoffset="31.416"
              opacity="0.3"
            />
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="31.416"
              strokeDashoffset="23.562"
            />
          </svg>
        </motion.div>
      );

    case 'dots':
      return (
        <motion.div
          variants={dotsVariants}
          animate="animate"
          className={`flex space-x-1 ${className}`}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              variants={dotVariants}
              className={`${sizeClasses[size]} rounded-full`}
              style={{ backgroundColor: color }}
            />
          ))}
        </motion.div>
      );

    case 'pulse':
      return (
        <motion.div
          variants={pulseVariants}
          animate="animate"
          className={`${sizeClasses[size]} rounded-full ${className}`}
          style={{ backgroundColor: color }}
        />
      );

    case 'skeleton':
      return (
        <motion.div
          variants={skeletonVariants}
          animate="animate"
          className={`bg-gray-200 rounded ${className}`}
          style={{ backgroundColor: color }}
        />
      );

    case 'progress':
      return (
        <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
          <motion.div
            className="h-2 rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{
              duration: reducedMotion ? 0 : 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        </div>
      );

    default:
      return null;
  }
};

/**
 * Staggered Children Container
 * Requirement 4.1: Staggered animations for multiple elements
 */
interface StaggeredContainerProps {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}

export const StaggeredContainer: React.FC<StaggeredContainerProps> = ({
  children,
  staggerDelay = 0.1,
  className = ''
}) => {
  const { reducedMotion } = useResponsiveMedia();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: reducedMotion ? 0 : staggerDelay,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: reducedMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reducedMotion ? 0.1 : 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

/**
 * Floating Action Button with premium animations
 * Requirement 4.2: Premium micro-interactions
 */
interface FloatingActionButtonProps {
  onClick?: () => void;
  icon: ReactNode;
  label?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  icon,
  label,
  position = 'bottom-right',
  className = ''
}) => {
  const { shouldAnimate } = useMicroInteractions();

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
  };

  const fabVariants = {
    idle: {
      scale: 1,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25
      }
    },
    hover: {
      scale: 1.1,
      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.25)',
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25
      }
    },
    tap: {
      scale: 0.95,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 20
      }
    }
  };

  return (
    <motion.button
      variants={shouldAnimate ? fabVariants : undefined}
      initial="idle"
      whileHover="hover"
      whileTap="tap"
      onClick={onClick}
      className={`
        fixed ${positionClasses[position]} 
        w-14 h-14 bg-blue-600 text-white rounded-full 
        flex items-center justify-center z-50
        focus:outline-none focus:ring-4 focus:ring-blue-300
        ${className}
      `}
      aria-label={label}
    >
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'linear'
        }}
      >
        {icon}
      </motion.div>
    </motion.button>
  );
};

// CSS for ripple effect
const rippleStyles = `
  @keyframes ripple {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = rippleStyles;
  document.head.appendChild(style);
}