'use client';

import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DeliveryTrendData } from '../../lib/analyticsApi';

interface DeliveryTrendsChartProps {
  data: DeliveryTrendData[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-4 rounded-lg shadow-lg border border-gray-200"
      >
        <p className="font-semibold text-gray-900 mb-2">{`Date: ${label}`}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {`${entry.name}: ${entry.value.toLocaleString()}`}
          </p>
        ))}
      </motion.div>
    );
  }
  return null;
};

const LoadingSkeleton = () => (
  <div className="w-full h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
    <div className="text-gray-400">Loading chart data...</div>
  </div>
);

export default function DeliveryTrendsChart({ data, isLoading }: DeliveryTrendsChartProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Delivery Trends</h3>
        <p className="text-sm text-gray-600">Track your email delivery performance over time</p>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
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
            <Legend />
            
            <motion.g
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: 0.5 }}
            >
              <Line
                type="monotone"
                dataKey="delivered"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                name="Delivered"
              />
            </motion.g>
            
            <motion.g
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: 0.7 }}
            >
              <Line
                type="monotone"
                dataKey="bounced"
                stroke="#ef4444"
                strokeWidth={3}
                dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2 }}
                name="Bounced"
              />
            </motion.g>
            
            <motion.g
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: 0.9 }}
            >
              <Line
                type="monotone"
                dataKey="failed"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2 }}
                name="Failed"
              />
            </motion.g>
            
            <motion.g
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: 1.1 }}
            >
              <Line
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2 }}
                name="Total Sent"
              />
            </motion.g>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}