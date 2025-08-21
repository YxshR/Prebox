'use client';

import { motion } from 'framer-motion';
import { ContactEngagementSummary } from '../../types/contact';

interface EngagementChartProps {
  engagement: ContactEngagementSummary;
  className?: string;
}

export default function EngagementChart({ engagement, className = '' }: EngagementChartProps) {
  const metrics = [
    {
      label: 'Sent',
      value: engagement.totalSent,
      color: 'bg-blue-500',
      lightColor: 'bg-blue-100',
      textColor: 'text-blue-600'
    },
    {
      label: 'Delivered',
      value: engagement.totalDelivered,
      color: 'bg-green-500',
      lightColor: 'bg-green-100',
      textColor: 'text-green-600'
    },
    {
      label: 'Opened',
      value: engagement.totalOpened,
      color: 'bg-purple-500',
      lightColor: 'bg-purple-100',
      textColor: 'text-purple-600'
    },
    {
      label: 'Clicked',
      value: engagement.totalClicked,
      color: 'bg-orange-500',
      lightColor: 'bg-orange-100',
      textColor: 'text-orange-600'
    }
  ];

  const maxValue = Math.max(...metrics.map(m => m.value)) || 1;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Engagement Score */}
      <div className="text-center mb-6">
        <div className="text-3xl font-bold text-gray-900 mb-2">
          {engagement.engagementScore}/100
        </div>
        <div className="text-sm text-gray-600 mb-3">Engagement Score</div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${engagement.engagementScore}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={`h-3 rounded-full ${
              engagement.engagementScore >= 80 ? 'bg-green-500' :
              engagement.engagementScore >= 60 ? 'bg-yellow-500' :
              engagement.engagementScore >= 40 ? 'bg-orange-500' :
              'bg-red-500'
            }`}
          />
        </div>
      </div>

      {/* Metrics Bars */}
      <div className="space-y-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="space-y-2"
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {metric.label}
              </span>
              <span className={`text-sm font-semibold ${metric.textColor}`}>
                {metric.value}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(metric.value / maxValue) * 100}%` }}
                transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                className={`h-2 rounded-full ${metric.color}`}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Additional Stats */}
      {(engagement.totalBounced > 0 || engagement.totalComplaints > 0) && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            {engagement.totalBounced > 0 && (
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">
                  {engagement.totalBounced}
                </div>
                <div className="text-xs text-gray-600">Bounced</div>
              </div>
            )}
            {engagement.totalComplaints > 0 && (
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-600">
                  {engagement.totalComplaints}
                </div>
                <div className="text-xs text-gray-600">Complaints</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Last Engagement */}
      {engagement.lastEngagement && (
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <div className="text-xs text-gray-600">
            Last engagement: {new Date(engagement.lastEngagement).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}