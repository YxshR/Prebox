'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CalendarIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { Toaster } from 'react-hot-toast';
import CampaignStatusBadge from '../../../components/schedule/CampaignStatusBadge';
import ProgressBar from '../../../components/schedule/ProgressBar';
import CountdownTimer from '../../../components/schedule/CountdownTimer';
import CampaignManagement from '../../../components/schedule/CampaignManagement';
import ScheduledEmailList from '../../../components/schedule/ScheduledEmailList';
import ScheduleEmailModal from '../../../components/schedule/ScheduleEmailModal';
import { scheduledEmailApi } from '../../../lib/scheduledEmailApi';
import { ScheduledEmail, ScheduleStatus } from '../../../types/scheduledEmail';

export default function SchedulePage() {
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<ScheduledEmail | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    cancelled: 0
  });

  useEffect(() => {
    loadScheduledEmails();
    loadStats();
    
    // Set up real-time updates every 30 seconds
    const interval = setInterval(() => {
      loadScheduledEmails();
      loadStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadScheduledEmails = async () => {
    try {
      const emails = await scheduledEmailApi.getScheduledEmails();
      setScheduledEmails(emails);
    } catch (error) {
      console.error('Failed to load scheduled emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await scheduledEmailApi.getStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleCancelEmail = async (scheduleId: string) => {
    try {
      await scheduledEmailApi.cancelScheduledEmail(scheduleId);
      await loadScheduledEmails();
      await loadStats();
    } catch (error) {
      console.error('Failed to cancel email:', error);
    }
  };

  const handleScheduleEmail = async (emailData: any) => {
    try {
      await scheduledEmailApi.scheduleEmail(emailData);
      await loadScheduledEmails();
      await loadStats();
      setShowScheduleModal(false);
    } catch (error) {
      console.error('Failed to schedule email:', error);
    }
  };

  const getStatusIcon = (status: ScheduleStatus) => {
    switch (status) {
      case ScheduleStatus.PENDING:
        return ClockIcon;
      case ScheduleStatus.PROCESSING:
        return ArrowPathIcon;
      case ScheduleStatus.SENT:
        return CheckCircleIcon;
      case ScheduleStatus.FAILED:
        return XCircleIcon;
      case ScheduleStatus.CANCELLED:
        return StopIcon;
      default:
        return ClockIcon;
    }
  };

  const getStatusColor = (status: ScheduleStatus) => {
    switch (status) {
      case ScheduleStatus.PENDING:
        return 'text-yellow-600 bg-yellow-100';
      case ScheduleStatus.PROCESSING:
        return 'text-blue-600 bg-blue-100';
      case ScheduleStatus.SENT:
        return 'text-green-600 bg-green-100';
      case ScheduleStatus.FAILED:
        return 'text-red-600 bg-red-100';
      case ScheduleStatus.CANCELLED:
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="rounded-full h-32 w-32 border-4 border-blue-200 border-t-blue-600"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center space-x-4"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-blue-600 rounded-xl flex items-center justify-center">
                  <CalendarIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                    Schedule Management
                  </h1>
                  <p className="text-sm text-gray-500">Manage your scheduled email campaigns</p>
                </div>
              </div>
            </motion.div>

            <motion.button
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowScheduleModal(true)}
              className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Schedule Email</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
        >
          {[
            { label: 'Total', value: stats.total, color: 'bg-gray-500', icon: CalendarIcon },
            { label: 'Pending', value: stats.pending, color: 'bg-yellow-500', icon: ClockIcon },
            { label: 'Processing', value: stats.processing, color: 'bg-blue-500', icon: ArrowPathIcon },
            { label: 'Sent', value: stats.sent, color: 'bg-green-500', icon: CheckCircleIcon },
            { label: 'Failed', value: stats.failed, color: 'bg-red-500', icon: XCircleIcon },
            { label: 'Cancelled', value: stats.cancelled, color: 'bg-gray-400', icon: StopIcon }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -2, scale: 1.02 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 ${stat.color} rounded-lg`}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
                <motion.span
                  key={stat.value}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-2xl font-bold text-gray-900"
                >
                  {stat.value}
                </motion.span>
              </div>
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Campaign Management Interface */}
        <CampaignManagement 
          scheduledEmails={scheduledEmails}
          onCancelEmail={handleCancelEmail}
          onRefresh={loadScheduledEmails}
        />

        {/* Scheduled Emails List */}
        <ScheduledEmailList 
          scheduledEmails={scheduledEmails}
          onCancelEmail={handleCancelEmail}
          onSelectCampaign={setSelectedCampaign}
        />
      </main>

      {/* Schedule Email Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <ScheduleEmailModal
            onClose={() => setShowScheduleModal(false)}
            onSchedule={handleScheduleEmail}
          />
        )}
      </AnimatePresence>

      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          },
        }}
      />
    </div>
  );
}