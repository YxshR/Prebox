'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDownIcon,
  ChevronRightIcon,
  CalendarIcon,
  UserIcon,
  EnvelopeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { ScheduledEmail, ScheduleStatus } from '../../types/scheduledEmail';
import CampaignStatusBadge from './CampaignStatusBadge';
import CountdownTimer from './CountdownTimer';
import ProgressBar from './ProgressBar';

interface ScheduledEmailListProps {
  scheduledEmails: ScheduledEmail[];
  onCancelEmail: (scheduleId: string) => void;
  onSelectCampaign: (email: ScheduledEmail) => void;
}

export default function ScheduledEmailList({ 
  scheduledEmails, 
  onCancelEmail, 
  onSelectCampaign 
}: ScheduledEmailListProps) {
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  const toggleExpanded = (emailId: string) => {
    const newExpanded = new Set(expandedEmails);
    if (newExpanded.has(emailId)) {
      newExpanded.delete(emailId);
    } else {
      newExpanded.add(emailId);
    }
    setExpandedEmails(newExpanded);
  };

  const toggleSelected = (emailId: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getTimeUntilScheduled = (scheduledAt: Date) => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diffMs = scheduled.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Overdue';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} min${diffMinutes > 1 ? 's' : ''}`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-200/50">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Scheduled Emails</h2>
          <div className="text-sm text-gray-500">
            {scheduledEmails.length} total campaigns
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="divide-y divide-gray-200/50">
        <AnimatePresence>
          {scheduledEmails.map((email, index) => (
            <motion.div
              key={email.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className="hover:bg-white/50 transition-colors duration-200"
            >
              {/* Main Row */}
              <div className="p-4">
                <div className="flex items-center space-x-4">
                  {/* Checkbox */}
                  <motion.input
                    whileTap={{ scale: 0.9 }}
                    type="checkbox"
                    checked={selectedEmails.has(email.id)}
                    onChange={() => toggleSelected(email.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  
                  {/* Expand Button */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleExpanded(email.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <motion.div
                      animate={{ rotate: expandedEmails.has(email.id) ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </motion.div>
                  </motion.button>
                  
                  {/* Status Badge */}
                  <CampaignStatusBadge status={email.status} size="sm" />
                  
                  {/* Email Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {email.emailJob.subject}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <UserIcon className="h-3 w-3" />
                            <span>{email.emailJob.to.length} recipients</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <CalendarIcon className="h-3 w-3" />
                            <span>{formatDate(email.scheduledAt)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <ClockIcon className="h-3 w-3" />
                            <span>{getTimeUntilScheduled(email.scheduledAt)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Countdown Timer for Pending Emails */}
                      {email.status === ScheduleStatus.PENDING && (
                        <div className="ml-4">
                          <CountdownTimer 
                            targetDate={email.scheduledAt} 
                            size="sm" 
                            showIcon={false}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    {email.status === ScheduleStatus.PENDING && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onCancelEmail(email.id)}
                        className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                      >
                        Cancel
                      </motion.button>
                    )}
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onSelectCampaign(email)}
                      className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                    >
                      View
                    </motion.button>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-3 ml-9">
                  <ProgressBar
                    progress={getProgress(email)}
                    status={email.status}
                    size="sm"
                    showPercentage={false}
                  />
                </div>
              </div>
              
              {/* Expanded Details */}
              <AnimatePresence>
                {expandedEmails.has(email.id) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-gray-200/50 bg-gray-50/50"
                  >
                    <div className="p-4 ml-9">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Email Details */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Email Details</h4>
                          <div className="space-y-2 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">From:</span> {email.emailJob.from}
                            </div>
                            {email.emailJob.replyTo && (
                              <div>
                                <span className="font-medium">Reply To:</span> {email.emailJob.replyTo}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Recipients:</span>
                              <div className="mt-1 max-h-20 overflow-y-auto">
                                {email.emailJob.to.map((recipient, idx) => (
                                  <div key={idx} className="text-xs text-gray-500">
                                    {recipient}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Scheduling Info */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Scheduling Info</h4>
                          <div className="space-y-2 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Created:</span> {formatDate(email.createdAt)}
                            </div>
                            <div>
                              <span className="font-medium">User Type:</span>
                              <span className={`ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                email.userType === 'subscription' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {email.userType}
                              </span>
                            </div>
                            {email.estimatedCost && (
                              <div>
                                <span className="font-medium">Estimated Cost:</span> ₹{email.estimatedCost}
                              </div>
                            )}
                            {email.retryCount > 0 && (
                              <div>
                                <span className="font-medium">Retry Count:</span> {email.retryCount}/{email.maxRetries}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Status Info */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Status Info</h4>
                          <div className="space-y-2 text-sm text-gray-600">
                            {email.sentAt && (
                              <div>
                                <span className="font-medium">Sent At:</span> {formatDate(email.sentAt)}
                              </div>
                            )}
                            {email.cancelledAt && (
                              <div>
                                <span className="font-medium">Cancelled At:</span> {formatDate(email.cancelledAt)}
                              </div>
                            )}
                            {email.failureReason && (
                              <div>
                                <span className="font-medium text-red-600">Failure Reason:</span>
                                <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                                  {email.failureReason}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Email Content Preview */}
                      {email.emailJob.htmlContent && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Content Preview</h4>
                          <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                            <div 
                              className="text-sm text-gray-600"
                              dangerouslySetInnerHTML={{ 
                                __html: email.emailJob.htmlContent.substring(0, 500) + '...' 
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {scheduledEmails.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-12 text-center"
          >
            <EnvelopeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No scheduled emails</h3>
            <p className="text-gray-600">Schedule your first email campaign to get started.</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}