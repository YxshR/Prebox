'use client';

import { motion } from 'framer-motion';

interface LoadingSkeletonProps {
  className?: string;
  rows?: number;
  type?: 'table' | 'card' | 'list';
}

export function LoadingSkeleton({ className = '', rows = 5, type = 'table' }: LoadingSkeletonProps) {
  const skeletonVariants = {
    loading: {
      opacity: [0.4, 0.8, 0.4],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  if (type === 'table') {
    return (
      <div className={`space-y-3 ${className}`}>
        {/* Table Header Skeleton */}
        <div className="grid grid-cols-5 gap-4 px-6 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={`header-${i}`}
              variants={skeletonVariants}
              animate="loading"
              className="h-4 bg-gray-200 rounded"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
        
        {/* Table Rows Skeleton */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="grid grid-cols-5 gap-4 px-6 py-4 border-t border-gray-100">
            {Array.from({ length: 5 }).map((_, colIndex) => (
              <motion.div
                key={`cell-${rowIndex}-${colIndex}`}
                variants={skeletonVariants}
                animate="loading"
                className="h-4 bg-gray-200 rounded"
                style={{ animationDelay: `${(rowIndex * 5 + colIndex) * 0.05}s` }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
        {Array.from({ length: rows }).map((_, index) => (
          <motion.div
            key={`card-${index}`}
            variants={skeletonVariants}
            animate="loading"
            className="bg-white/70 backdrop-blur-sm rounded-lg p-6 border border-white/20 shadow-lg"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="space-y-3">
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  // Default list type
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <motion.div
          key={`list-${index}`}
          variants={skeletonVariants}
          animate="loading"
          className="flex items-center space-x-4 p-4 bg-white/50 rounded-lg"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}