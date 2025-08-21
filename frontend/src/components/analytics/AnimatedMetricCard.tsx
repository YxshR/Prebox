'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';

interface AnimatedMetricCardProps {
  title: string;
  value: number;
  previousValue?: number;
  format?: 'number' | 'percentage' | 'currency';
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo';
  delay?: number;
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  green: 'bg-green-50 text-green-600 border-green-200',
  red: 'bg-red-50 text-red-600 border-red-200',
  yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
};

const iconColorClasses = {
  blue: 'text-blue-500',
  green: 'text-green-500',
  red: 'text-red-500',
  yellow: 'text-yellow-500',
  purple: 'text-purple-500',
  indigo: 'text-indigo-500',
};

export default function AnimatedMetricCard({
  title,
  value,
  previousValue,
  format = 'number',
  icon,
  color = 'blue',
  delay = 0
}: AnimatedMetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 2,
      delay: delay,
      ease: "easeOut"
    });

    const unsubscribe = rounded.onChange((latest) => {
      setDisplayValue(latest);
    });

    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, motionValue, rounded, delay]);

  const formatValue = (val: number) => {
    switch (format) {
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'currency':
        return `₹${val.toLocaleString()}`;
      default:
        return val.toLocaleString();
    }
  };

  const getChangeIndicator = () => {
    if (previousValue === undefined) return null;
    
    const change = value - previousValue;
    const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;
    
    if (Math.abs(changePercent) < 0.1) return null;
    
    const isPositive = change > 0;
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay + 1, duration: 0.5 }}
        className={`flex items-center text-sm ${
          isPositive ? 'text-green-600' : 'text-red-600'
        }`}
      >
        <svg
          className={`w-4 h-4 mr-1 ${isPositive ? 'rotate-0' : 'rotate-180'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {Math.abs(changePercent).toFixed(1)}%
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: delay }}
      className={`p-6 rounded-xl border-2 ${colorClasses[color]} backdrop-blur-sm`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline space-x-2">
            <motion.p
              className="text-3xl font-bold text-gray-900"
              key={displayValue}
            >
              {formatValue(displayValue)}
            </motion.p>
            {getChangeIndicator()}
          </div>
        </div>
        {icon && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              duration: 0.8, 
              delay: delay + 0.3,
              type: "spring",
              stiffness: 200
            }}
            className={`p-3 rounded-lg ${iconColorClasses[color]} bg-white/50`}
          >
            {icon}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}