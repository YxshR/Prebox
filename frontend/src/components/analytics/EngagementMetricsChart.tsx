'use client';

import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { EngagementMetricsData } from '../../lib/analyticsApi';

interface EngagementMetricsChartProps {
  data: EngagementMetricsData;
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-4 rounded-lg shadow-lg border border-gray-200"
      >
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        <p className="text-sm text-gray-600">
          Count: {payload[0].value.toLocaleString()}
        </p>
        <p className="text-sm text-gray-600">
          Rate: {((payload[0].value / data.totalSent) * 100).toFixed(2)}%
        </p>
      </motion.div>
    );
  }
  return null;
};

const LoadingSkeleton = () => (
  <div className="w-full h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
    <div className="text-gray-400">Loading engagement data...</div>
  </div>
);

export default function EngagementMetricsChart({ data, isLoading }: EngagementMetricsChartProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const chartData = [
    {
      name: 'Opens',
      value: data.opens,
      rate: data.totalSent > 0 ? (data.opens / data.totalSent) * 100 : 0,
      color: '#3b82f6',
      totalSent: data.totalSent
    },
    {
      name: 'Clicks',
      value: data.clicks,
      rate: data.totalSent > 0 ? (data.clicks / data.totalSent) * 100 : 0,
      color: '#10b981',
      totalSent: data.totalSent
    },
    {
      name: 'Unsubscribes',
      value: data.unsubscribes,
      rate: data.totalSent > 0 ? (data.unsubscribes / data.totalSent) * 100 : 0,
      color: '#f59e0b',
      totalSent: data.totalSent
    },
    {
      name: 'Complaints',
      value: data.complaints,
      rate: data.totalSent > 0 ? (data.complaints / data.totalSent) * 100 : 0,
      color: '#ef4444',
      totalSent: data.totalSent
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Engagement Metrics</h3>
        <p className="text-sm text-gray-600">Interactive breakdown of email engagement</p>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="name" 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="value" 
              radius={[4, 4, 0, 0]}
              cursor="pointer"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Engagement Rate Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {chartData.map((metric, index) => (
          <motion.div
            key={metric.name}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.9 + index * 0.1 }}
            className="text-center p-3 rounded-lg bg-gray-50"
          >
            <div 
              className="w-4 h-4 rounded-full mx-auto mb-2"
              style={{ backgroundColor: metric.color }}
            />
            <p className="text-xs font-medium text-gray-600 mb-1">{metric.name}</p>
            <p className="text-lg font-bold text-gray-900">{metric.rate.toFixed(1)}%</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}