'use client';

import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CampaignPerformanceData } from '../../lib/analyticsApi';

interface CampaignPerformanceChartProps {
  data: CampaignPerformanceData[];
  isLoading?: boolean;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-4 rounded-lg shadow-lg border border-gray-200"
      >
        <p className="font-semibold text-gray-900 mb-2">{data.campaignName}</p>
        <div className="space-y-1 text-sm">
          <p className="text-green-600">Delivered: {data.delivered.toLocaleString()}</p>
          <p className="text-blue-600">Opened: {data.opened.toLocaleString()}</p>
          <p className="text-purple-600">Clicked: {data.clicked.toLocaleString()}</p>
          <p className="text-red-600">Bounced: {data.bounced.toLocaleString()}</p>
          <p className="text-yellow-600">Unsubscribed: {data.unsubscribed.toLocaleString()}</p>
        </div>
      </motion.div>
    );
  }
  return null;
};

const LoadingSkeleton = () => (
  <div className="w-full h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
    <div className="text-gray-400">Loading campaign data...</div>
  </div>
);

export default function CampaignPerformanceChart({ data, isLoading }: CampaignPerformanceChartProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Transform data for donut chart - showing total delivered emails per campaign
  const chartData = data.map((campaign, index) => ({
    name: campaign.campaignName,
    value: campaign.delivered,
    campaignName: campaign.campaignName,
    delivered: campaign.delivered,
    opened: campaign.opened,
    clicked: campaign.clicked,
    bounced: campaign.bounced,
    unsubscribed: campaign.unsubscribed,
    color: COLORS[index % COLORS.length]
  }));

  const totalDelivered = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Don't show labels for slices smaller than 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.6 }}
      className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaign Performance</h3>
        <p className="text-sm text-gray-600">Distribution of delivered emails across campaigns</p>
      </div>

      <div className="flex flex-col lg:flex-row items-center">
        <div className="w-full lg:w-2/3 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                outerRadius={120}
                innerRadius={60}
                fill="#8884d8"
                dataKey="value"
                animationBegin={600}
                animationDuration={1500}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Campaign Legend and Stats */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="w-full lg:w-1/3 lg:pl-6 mt-6 lg:mt-0"
        >
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {chartData.map((campaign, index) => (
              <motion.div
                key={campaign.name}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 1.3 + index * 0.1 }}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: campaign.color }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-32">
                      {campaign.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {((campaign.value / totalDelivered) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {campaign.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">delivered</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Total Summary */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.5 }}
            className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200"
          >
            <p className="text-sm font-medium text-blue-900 mb-1">Total Delivered</p>
            <p className="text-2xl font-bold text-blue-600">
              {totalDelivered.toLocaleString()}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Across {chartData.length} campaigns
            </p>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}