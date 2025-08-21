'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClockIcon } from '@heroicons/react/24/outline';

interface CountdownTimerProps {
  targetDate: Date;
  onComplete?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  animated?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function CountdownTimer({ 
  targetDate, 
  onComplete, 
  size = 'md', 
  showIcon = true, 
  animated = true 
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
        setIsExpired(false);
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsExpired(true);
        if (onComplete) {
          onComplete();
        }
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return {
          container: 'text-xs',
          number: 'text-sm font-bold',
          label: 'text-xs',
          icon: 'h-3 w-3',
          spacing: 'space-x-2'
        };
      case 'lg':
        return {
          container: 'text-base',
          number: 'text-2xl font-bold',
          label: 'text-sm',
          icon: 'h-6 w-6',
          spacing: 'space-x-4'
        };
      default: // md
        return {
          container: 'text-sm',
          number: 'text-lg font-bold',
          label: 'text-xs',
          icon: 'h-4 w-4',
          spacing: 'space-x-3'
        };
    }
  };

  const sizeClasses = getSizeClasses(size);

  const formatNumber = (num: number) => {
    return num.toString().padStart(2, '0');
  };

  const timeUnits = [
    { value: timeLeft.days, label: 'Days', show: timeLeft.days > 0 },
    { value: timeLeft.hours, label: 'Hours', show: timeLeft.days > 0 || timeLeft.hours > 0 },
    { value: timeLeft.minutes, label: 'Min', show: true },
    { value: timeLeft.seconds, label: 'Sec', show: timeLeft.days === 0 }
  ].filter(unit => unit.show);

  if (isExpired) {
    return (
      <motion.div
        initial={animated ? { scale: 0.8, opacity: 0 } : undefined}
        animate={animated ? { scale: 1, opacity: 1 } : undefined}
        className="flex items-center space-x-2 text-red-600"
      >
        {showIcon && <ClockIcon className={sizeClasses.icon} />}
        <span className={`font-medium ${sizeClasses.container}`}>Expired</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={animated ? { opacity: 0, y: 10 } : undefined}
      animate={animated ? { opacity: 1, y: 0 } : undefined}
      className={`flex items-center ${sizeClasses.spacing}`}
    >
      {showIcon && (
        <motion.div
          animate={animated ? {
            rotate: [0, 5, -5, 0],
            scale: [1, 1.1, 1]
          } : undefined}
          transition={animated ? {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          } : undefined}
          className="text-blue-600"
        >
          <ClockIcon className={sizeClasses.icon} />
        </motion.div>
      )}
      
      <div className={`flex items-center ${sizeClasses.spacing}`}>
        <AnimatePresence mode="wait">
          {timeUnits.map((unit, index) => (
            <motion.div
              key={unit.label}
              initial={animated ? { opacity: 0, y: -10 } : undefined}
              animate={animated ? { opacity: 1, y: 0 } : undefined}
              exit={animated ? { opacity: 0, y: 10 } : undefined}
              className="text-center"
            >
              <motion.div
                key={unit.value}
                initial={animated ? { scale: 1.2, opacity: 0 } : undefined}
                animate={animated ? { scale: 1, opacity: 1 } : undefined}
                transition={animated ? { type: "spring", stiffness: 300, damping: 30 } : undefined}
                className={`${sizeClasses.number} text-gray-900`}
              >
                {formatNumber(unit.value)}
              </motion.div>
              <div className={`${sizeClasses.label} text-gray-500 uppercase tracking-wide`}>
                {unit.label}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Pulsing indicator for urgency */}
      {timeLeft.days === 0 && timeLeft.hours < 1 && !isExpired && animated && (
        <motion.div
          className="w-2 h-2 bg-red-500 rounded-full"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [1, 0.5, 1]
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}
    </motion.div>
  );
}