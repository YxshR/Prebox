'use client';

import { motion } from 'framer-motion';
import { 
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  StopIcon
} from '@heroicons/react/24/outline';
import { ScheduleStatus } from '../../types/scheduledEmail';

interface CampaignStatusBadgeProps {
  status: ScheduleStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  animated?: boolean;
}

export default function CampaignStatusBadge({ 
  status, 
  size = 'md', 
  showIcon = true, 
  animated = true 
}: CampaignStatusBadgeProps) {
  const getStatusConfig = (status: ScheduleStatus) => {
    switch (status) {
      case ScheduleStatus.PENDING:
        return {
          label: 'Pending',
          icon: ClockIcon,
          colors: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          iconColor: 'text-yellow-600',
          pulseColor: 'bg-yellow-400'
        };
      case ScheduleStatus.PROCESSING:
        return {
          label: 'Processing',
          icon: ArrowPathIcon,
          colors: 'bg-blue-100 text-blue-800 border-blue-200',
          iconColor: 'text-blue-600',
          pulseColor: 'bg-blue-400'
        };
      case ScheduleStatus.SENT:
        return {
          label: 'Sent',
          icon: CheckCircleIcon,
          colors: 'bg-green-100 text-green-800 border-green-200',
          iconColor: 'text-green-600',
          pulseColor: 'bg-green-400'
        };
      case ScheduleStatus.FAILED:
        return {
          label: 'Failed',
          icon: XCircleIcon,
          colors: 'bg-red-100 text-red-800 border-red-200',
          iconColor: 'text-red-600',
          pulseColor: 'bg-red-400'
        };
      case ScheduleStatus.CANCELLED:
        return {
          label: 'Cancelled',
          icon: StopIcon,
          colors: 'bg-gray-100 text-gray-800 border-gray-200',
          iconColor: 'text-gray-600',
          pulseColor: 'bg-gray-400'
        };
      default:
        return {
          label: 'Unknown',
          icon: ClockIcon,
          colors: 'bg-gray-100 text-gray-800 border-gray-200',
          iconColor: 'text-gray-600',
          pulseColor: 'bg-gray-400'
        };
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-1 text-xs',
          icon: 'h-3 w-3',
          gap: 'space-x-1'
        };
      case 'lg':
        return {
          container: 'px-4 py-2 text-base',
          icon: 'h-5 w-5',
          gap: 'space-x-2'
        };
      default: // md
        return {
          container: 'px-3 py-1.5 text-sm',
          icon: 'h-4 w-4',
          gap: 'space-x-1.5'
        };
    }
  };

  const config = getStatusConfig(status);
  const sizeClasses = getSizeClasses(size);
  const IconComponent = config.icon;

  const badgeVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 500,
        damping: 30
      }
    },
    exit: { scale: 0.8, opacity: 0 }
  };

  const iconVariants = {
    processing: {
      rotate: 360,
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "linear"
      }
    },
    pulse: {
      scale: [1, 1.1, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <motion.div
      variants={animated ? badgeVariants : undefined}
      initial={animated ? "initial" : undefined}
      animate={animated ? "animate" : undefined}
      exit={animated ? "exit" : undefined}
      className={`
        inline-flex items-center font-medium rounded-full border
        ${config.colors} ${sizeClasses.container} ${sizeClasses.gap}
        relative overflow-hidden
      `}
    >
      {/* Animated background pulse for processing status */}
      {status === ScheduleStatus.PROCESSING && animated && (
        <motion.div
          className={`absolute inset-0 ${config.pulseColor} opacity-20 rounded-full`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.1, 0.2]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}

      {showIcon && (
        <motion.div
          animate={
            animated && status === ScheduleStatus.PROCESSING 
              ? iconVariants.processing 
              : animated && (status === ScheduleStatus.PENDING || status === ScheduleStatus.FAILED)
              ? iconVariants.pulse
              : undefined
          }
          className={config.iconColor}
        >
          <IconComponent className={sizeClasses.icon} />
        </motion.div>
      )}
      
      <span className="relative z-10">{config.label}</span>
    </motion.div>
  );
}