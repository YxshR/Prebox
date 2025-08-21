'use client';

import { motion } from 'framer-motion';
import { ContactEngagementSummary } from '../../types/contact';
import {
  EyeIcon,
  CursorArrowRaysIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface ContactEngagementVisualizationProps {
  engagement: ContactEngagementSummary;
  className?: string;
}

export default function ContactEngagementVisualization({ 
  engagement, 
  className = '' 
}: ContactEngagementVisualizationProps) {
  const calculateRate = (numerator: number, denominator: number) => {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100);
  };

  const openRate = calculateRate(engagement.totalOpened, engagement.totalDelivered);
  const clickRate = calculateRate(engagement.totalClicked, engagement.totalOpened);
  const deliveryRate = calculateRate(engagement.totalDelivered, engagement.totalSent);

  const metrics = [
    {
      icon: EnvelopeIcon,
      label: 'Delivery Rate',
      value: deliveryRate,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: `${engagement.totalDelivered} of ${engagement.totalSent} delivered`
    },
    {
      icon: EyeIcon,
      label: 'Open Rate',
      value: openRate,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: `${engagement.totalOpened} of ${engagement.totalDelivered} opened`
    },
    {
      icon: CursorArrowRaysIcon,
      label: 'Click Rate',
      value: clickRate,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: `${engagement.totalClicked} of ${engagement.totalOpened} clicked`
    }
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Engagement Score Circle */}
      <div className="text-center">
        <div className="relative inline-flex items-center justify-center">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-gray-200"
            />
            <motion.circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 56}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
              animate={{ 
                strokeDashoffset: 2 * Math.PI * 56 * (1 - engagement.engagementScore / 100)
              }}
              transition={{ duration: 2, ease: "easeOut" }}
              className={
                engagement.engagementScore >= 80 ? 'text-green-500' :
                engagement.engagementScore >= 60 ? 'text-yellow-500' :
                engagement.engagementScore >= 40 ? 'text-orange-500' :
                'text-red-500'
              }
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-2xl font-bold text-gray-900"
              >
                {engagement.engagementScore}
              </motion.div>
              <div className="text-sm text-gray-600">Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.2 }}
            className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-white/20"
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                <metric.icon className={`h-5 w-5 ${metric.color}`} />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {metric.label}
                </div>
                <div className="text-xs text-gray-600">
                  {metric.description}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.2 + 0.3 }}
                className={`text-2xl font-bold ${metric.color}`}
              >
                {metric.value}%
              </motion.div>
              
              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${metric.value}%` }}
                  transition={{ delay: index * 0.2 + 0.5, duration: 1 }}
                  className={`h-full rounded-full ${
                    metric.value >= 80 ? 'bg-green-500' :
                    metric.value >= 60 ? 'bg-yellow-500' :
                    metric.value >= 40 ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Issues Section */}
      {(engagement.totalBounced > 0 || engagement.totalComplaints > 0) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-center space-x-2 mb-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            <h4 className="text-sm font-medium text-red-900">Issues Detected</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {engagement.totalBounced > 0 && (
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">
                  {engagement.totalBounced}
                </div>
                <div className="text-xs text-red-700">Bounced Emails</div>
              </div>
            )}
            {engagement.totalComplaints > 0 && (
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-600">
                  {engagement.totalComplaints}
                </div>
                <div className="text-xs text-orange-700">Spam Complaints</div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Success Message */}
      {engagement.totalBounced === 0 && engagement.totalComplaints === 0 && engagement.totalSent > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="bg-green-50 border border-green-200 rounded-lg p-4"
        >
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-900">
              Great engagement! No delivery issues detected.
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}