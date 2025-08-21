'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PaperAirplaneIcon, DocumentTextIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import ProgressBar from './ProgressBar';
import AnimatedCounter from './AnimatedCounter';

interface EmailSendingInterfaceProps {
  userTier: string;
}

export default function EmailSendingInterface({ userTier }: EmailSendingInterfaceProps) {
  const [isComposing, setIsComposing] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [isSending, setIsSending] = useState(false);

  const handleQuickSend = () => {
    setIsSending(true);
    setSendingProgress(0);
    
    // Simulate sending progress
    const interval = setInterval(() => {
      setSendingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSending(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const getTierLimits = (tier: string) => {
    switch (tier) {
      case 'free':
        return { daily: 100, monthly: 2000, recipients: 300 };
      case 'paid_standard':
        return { daily: 1000, monthly: 30000, recipients: 5000 };
      case 'premium':
        return { daily: 5000, monthly: 100000, recipients: 25000 };
      case 'enterprise':
        return { daily: 'Unlimited', monthly: 'Unlimited', recipients: 'Unlimited' };
      default:
        return { daily: 100, monthly: 2000, recipients: 300 };
    }
  };

  const limits = getTierLimits(userTier);
  const usage = { daily: 23, monthly: 1250, recipients: 180 }; // Mock usage data

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-xl shadow-lg p-6 border border-gray-100"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <PaperAirplaneIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Email Sending</h3>
            <p className="text-sm text-gray-500">Send emails to your audience</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsComposing(!isComposing)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Compose Email
        </motion.button>
      </div>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">Daily Emails</span>
            <span className="text-xs text-blue-600">
              {typeof limits.daily === 'number' ? `${usage.daily}/${limits.daily}` : 'Unlimited'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <AnimatedCounter 
              value={usage.daily} 
              className="text-2xl font-bold text-blue-900"
            />
            {typeof limits.daily === 'number' && (
              <ProgressBar 
                progress={(usage.daily / limits.daily) * 100}
                color="bg-blue-500"
                showPercentage={false}
                className="flex-1"
              />
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-900">Monthly Emails</span>
            <span className="text-xs text-green-600">
              {typeof limits.monthly === 'number' ? `${usage.monthly}/${limits.monthly}` : 'Unlimited'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <AnimatedCounter 
              value={usage.monthly} 
              className="text-2xl font-bold text-green-900"
            />
            {typeof limits.monthly === 'number' && (
              <ProgressBar 
                progress={(usage.monthly / limits.monthly) * 100}
                color="bg-green-500"
                showPercentage={false}
                className="flex-1"
              />
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-900">Recipients</span>
            <span className="text-xs text-purple-600">
              {typeof limits.recipients === 'number' ? `${usage.recipients}/${limits.recipients}` : 'Unlimited'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <AnimatedCounter 
              value={usage.recipients} 
              className="text-2xl font-bold text-purple-900"
            />
            {typeof limits.recipients === 'number' && (
              <ProgressBar 
                progress={(usage.recipients / limits.recipients) * 100}
                color="bg-purple-500"
                showPercentage={false}
                className="flex-1"
              />
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleQuickSend}
          disabled={isSending}
          className="flex items-center justify-center space-x-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50"
        >
          <DocumentTextIcon className="h-5 w-5 text-gray-600" />
          <span className="font-medium text-gray-700">Quick Send</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center space-x-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all duration-200"
        >
          <UserGroupIcon className="h-5 w-5 text-gray-600" />
          <span className="font-medium text-gray-700">Bulk Campaign</span>
        </motion.button>
      </div>

      {/* Sending Progress */}
      <AnimatePresence>
        {isSending && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">Sending emails...</span>
              <span className="text-sm text-blue-600">{sendingProgress}%</span>
            </div>
            <ProgressBar 
              progress={sendingProgress}
              color="bg-blue-500"
              showPercentage={false}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compose Modal Trigger */}
      <AnimatePresence>
        {isComposing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setIsComposing(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-lg font-semibold mb-4">Email Composer</h3>
              <p className="text-gray-600 mb-4">
                Email composition interface would be implemented here with full editor capabilities.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsComposing(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setIsComposing(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Open Editor
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}