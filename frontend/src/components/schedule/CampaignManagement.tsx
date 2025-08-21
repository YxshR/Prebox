'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline';
import { ScheduledEmail, ScheduleStatus } from '../../types/scheduledEmail';
import CampaignStatusBadge from './CampaignStatusBadge';
import CountdownTimer from './CountdownTimer';
import ProgressBar from './ProgressBar';

interface CampaignManagementProps {
  scheduledEmails: ScheduledEmail[];
  onCancelEmail: (scheduleId: string) => void;
  onRefresh: () => void;
}

export default function CampaignManagement({ 
  scheduledEmails, 
  onCancelEmail, 
  onRefresh 
}: CampaignManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'scheduledAt' | 'createdAt' | 'status'>('scheduledAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const filteredAndSortedEmails = scheduledEmails
    .filter(email => {
      const matchesSearch = email.emailJob.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           email.emailJob.to.some(recipient => recipient.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || email.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'scheduledAt':
          aValue = new Date(a.scheduledAt).getTime();
          bValue = new Date(b.scheduledAt).getTime();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const getProgress = (email: ScheduledEmail) => {
    switch (email.status) {
      case ScheduleStatus.PENDING:
        return 0;
      case ScheduleStatus.PROCESSING:
        return 50;
      case ScheduleStatus.SENT:
        return 100;
      case ScheduleStatus.FAILED:
      case ScheduleStatus.CANCELLED:
        return 0;
      default:
        return 0;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg mb-8"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-200/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <h2 className="text-xl font-semibold text-gray-900">Campaign Management</h2>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ScheduleStatus | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Status</option>
              <option value={ScheduleStatus.PENDING}>Pending</option>
              <option value={ScheduleStatus.PROCESSING}>Processing</option>
              <option value={ScheduleStatus.SENT}>Sent</option>
              <option value={ScheduleStatus.FAILED}>Failed</option>
              <option value={ScheduleStatus.CANCELLED}>Cancelled</option>
            </select>
            
            {/* Refresh Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <motion.div
                animate={isRefreshing ? { rotate: 360 } : {}}
                transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
              >
                <ArrowPathIcon className="h-4 w-4" />
              </motion.div>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Campaign List */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {filteredAndSortedEmails.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <div className="text-gray-400 mb-4">
                <FunnelIcon className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600">No campaigns found matching your criteria</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {filteredAndSortedEmails.map((email, index) => (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -2, scale: 1.01 }}
                  className="bg-white/50 rounded-lg p-4 border border-gray-200/50 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <CampaignStatusBadge status={email.status} size="sm" />
                      <h3 className="font-medium text-gray-900 truncate max-w-md">
                        {email.emailJob.subject}
                      </h3>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {email.status === ScheduleStatus.PENDING && (
                        <CountdownTimer 
                          targetDate={email.scheduledAt} 
                          size="sm" 
                          showIcon={false}
                        />
                      )}
                      
                      <div className="flex items-center space-x-1">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </motion.button>
                        
                        {email.status === ScheduleStatus.PENDING && (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </motion.button>
                            
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => onCancelEmail(email.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </motion.button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Recipients</p>
                      <p className="text-sm font-medium text-gray-900">
                        {email.emailJob.to.length} recipients
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Scheduled For</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(email.scheduledAt).toLocaleString()}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-500 mb-1">User Type</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        email.userType === 'subscription' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {email.userType}
                      </span>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <ProgressBar
                    progress={getProgress(email)}
                    status={email.status}
                    size="sm"
                    showPercentage={false}
                  />
                  
                  {email.failureReason && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <p className="text-sm text-red-800">
                        <span className="font-medium">Error:</span> {email.failureReason}
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}