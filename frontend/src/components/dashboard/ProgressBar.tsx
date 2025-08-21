'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
  color?: string;
  showPercentage?: boolean;
  animated?: boolean;
}

export default function ProgressBar({ 
  progress, 
  className = '', 
  color = 'bg-blue-500',
  showPercentage = true,
  animated = true
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-1">
        {showPercentage && (
          <span className="text-sm font-medium text-gray-700">
            {Math.round(clampedProgress)}%
          </span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <motion.div
          className={`h-2 rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ 
            duration: animated ? 1.5 : 0, 
            ease: "easeOut" 
          }}
        />
      </div>
    </div>
  );
}