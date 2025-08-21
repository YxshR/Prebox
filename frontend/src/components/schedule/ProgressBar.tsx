'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  animated?: boolean;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export default function ProgressBar({ 
  progress, 
  status, 
  animated = true, 
  showPercentage = true, 
  size = 'md',
  label 
}: ProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setDisplayProgress(progress);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setDisplayProgress(progress);
    }
  }, [progress, animated]);

  const getStatusColors = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          bg: 'bg-yellow-200',
          fill: 'bg-yellow-500',
          glow: 'shadow-yellow-500/50'
        };
      case 'processing':
        return {
          bg: 'bg-blue-200',
          fill: 'bg-blue-500',
          glow: 'shadow-blue-500/50'
        };
      case 'sent':
        return {
          bg: 'bg-green-200',
          fill: 'bg-green-500',
          glow: 'shadow-green-500/50'
        };
      case 'failed':
        return {
          bg: 'bg-red-200',
          fill: 'bg-red-500',
          glow: 'shadow-red-500/50'
        };
      case 'cancelled':
        return {
          bg: 'bg-gray-200',
          fill: 'bg-gray-500',
          glow: 'shadow-gray-500/50'
        };
      default:
        return {
          bg: 'bg-gray-200',
          fill: 'bg-gray-500',
          glow: 'shadow-gray-500/50'
        };
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return {
          height: 'h-2',
          text: 'text-xs'
        };
      case 'lg':
        return {
          height: 'h-4',
          text: 'text-base'
        };
      default: // md
        return {
          height: 'h-3',
          text: 'text-sm'
        };
    }
  };

  const colors = getStatusColors(status);
  const sizeClasses = getSizeClasses(size);

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className={`font-medium text-gray-700 ${sizeClasses.text}`}>
              {label}
            </span>
          )}
          {showPercentage && (
            <motion.span
              key={displayProgress}
              initial={animated ? { scale: 1.2, opacity: 0 } : undefined}
              animate={animated ? { scale: 1, opacity: 1 } : undefined}
              className={`font-semibold text-gray-600 ${sizeClasses.text}`}
            >
              {Math.round(displayProgress)}%
            </motion.span>
          )}
        </div>
      )}
      
      <div className={`w-full ${colors.bg} rounded-full overflow-hidden ${sizeClasses.height}`}>
        <motion.div
          className={`${colors.fill} ${sizeClasses.height} rounded-full relative overflow-hidden`}
          initial={{ width: 0 }}
          animate={{ 
            width: `${displayProgress}%`,
            transition: animated ? {
              duration: 1.2,
              ease: "easeOut"
            } : { duration: 0 }
          }}
        >
          {/* Animated shimmer effect for processing status */}
          {status === 'processing' && animated && displayProgress > 0 && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{
                x: ['-100%', '100%']
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          )}
          
          {/* Pulsing glow effect */}
          {status === 'processing' && animated && displayProgress > 0 && (
            <motion.div
              className={`absolute inset-0 ${colors.fill} rounded-full blur-sm ${colors.glow}`}
              animate={{
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          )}
        </motion.div>
      </div>
      
      {/* Status indicator dots */}
      {status === 'processing' && animated && (
        <div className="flex justify-center mt-2 space-x-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={`w-1.5 h-1.5 ${colors.fill} rounded-full`}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}