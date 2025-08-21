'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { AnalyticsTimeRange } from '../../lib/analyticsApi';

interface TimeRangeSelectorProps {
  selectedRange: AnalyticsTimeRange;
  onRangeChange: (range: AnalyticsTimeRange) => void;
}

const predefinedRanges = [
  { label: 'Last 7 Days', period: 'daily' as const, days: 7 },
  { label: 'Last 30 Days', period: 'daily' as const, days: 30 },
  { label: 'Last 3 Months', period: 'weekly' as const, days: 90 },
  { label: 'Last 6 Months', period: 'monthly' as const, days: 180 },
  { label: 'Last Year', period: 'monthly' as const, days: 365 },
];

export default function TimeRangeSelector({ selectedRange, onRangeChange }: TimeRangeSelectorProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const handlePredefinedRange = (days: number, period: 'daily' | 'weekly' | 'monthly') => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const range: AnalyticsTimeRange = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      period
    };

    onRangeChange(range);
    setIsCustom(false);
  };

  const handleCustomRange = () => {
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      let period: 'daily' | 'weekly' | 'monthly' = 'daily';
      if (diffDays > 90) period = 'weekly';
      if (diffDays > 365) period = 'monthly';

      const range: AnalyticsTimeRange = {
        startDate: customStartDate,
        endDate: customEndDate,
        period
      };

      onRangeChange(range);
    }
  };

  const getCurrentRangeLabel = () => {
    const start = new Date(selectedRange.startDate);
    const end = new Date(selectedRange.endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    const predefined = predefinedRanges.find(range => range.days === diffDays);
    if (predefined) return predefined.label;
    
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Analytics Dashboard</h3>
          <p className="text-sm text-gray-600">
            Viewing data for: <span className="font-medium">{getCurrentRangeLabel()}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Predefined Range Buttons */}
          {predefinedRanges.map((range, index) => (
            <motion.button
              key={range.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              onClick={() => handlePredefinedRange(range.days, range.period)}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              {range.label}
            </motion.button>
          ))}

          {/* Custom Range Toggle */}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            onClick={() => setIsCustom(!isCustom)}
            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              isCustom
                ? 'bg-blue-500 text-white border-blue-500'
                : 'border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            }`}
          >
            Custom Range
          </motion.button>
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {isCustom && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4 pt-4 border-t border-gray-200"
        >
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCustomRange}
              disabled={!customStartDate || !customEndDate}
              className="px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}