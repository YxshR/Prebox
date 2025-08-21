'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BellIcon, 
  Cog6ToothIcon, 
  UserCircleIcon,
  ChartBarIcon,
  CalendarIcon,
  UsersIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { authApi, User } from '../../lib/auth';
import { Toaster } from 'react-hot-toast';
import EmailSendingInterface from '../../components/dashboard/EmailSendingInterface';
import TemplateManagement from '../../components/dashboard/TemplateManagement';
import TierFeatureDisplay from '../../components/dashboard/TierFeatureDisplay';
import OnboardingFlow from '../../components/dashboard/OnboardingFlow';
import AnimatedCounter from '../../components/dashboard/AnimatedCounter';
import AnimatedBackground from '../../components/dashboard/AnimatedBackground';
import FloatingActionButton from '../../components/dashboard/FloatingActionButton';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          router.push('/auth/login');
          return;
        }

        const currentUser = await authApi.getCurrentUser();
        setUser(currentUser);
        
        // Show onboarding for new users
        const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
        if (!hasSeenOnboarding && (!currentUser.isEmailVerified || !currentUser.isPhoneVerified)) {
          setShowOnboarding(true);
        }
      } catch (error) {
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleOnboardingClose = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenOnboarding', 'true');
  };

  const handleOnboardingStepComplete = (stepId: string) => {
    // Handle step completion logic here
    console.log('Completed step:', stepId);
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

  if (!user) {
    return null; // Will redirect to login
  }

  const getTierInfo = (tier: string) => {
    switch (tier) {
      case 'free':
        return {
          name: 'Free Tier',
          color: 'bg-gray-100 text-gray-800',
          badge: 'bg-gray-500',
          limits: '100 emails/day, 300 recipients/month',
        };
      case 'paid_standard':
        return {
          name: 'Standard',
          color: 'bg-blue-100 text-blue-800',
          badge: 'bg-blue-500',
          limits: '500-1000 emails/day, 1500-5000 recipients/month',
        };
      case 'premium':
        return {
          name: 'Premium',
          color: 'bg-purple-100 text-purple-800',
          badge: 'bg-purple-500',
          limits: '2000-5000 emails/day, 10000-25000 recipients/month',
        };
      case 'enterprise':
        return {
          name: 'Enterprise',
          color: 'bg-yellow-100 text-yellow-800',
          badge: 'bg-yellow-500',
          limits: 'Unlimited (custom limits)',
        };
      default:
        return {
          name: 'Unknown',
          color: 'bg-gray-100 text-gray-800',
          badge: 'bg-gray-500',
          limits: 'Contact support',
        };
    }
  };

  const tierInfo = getTierInfo(user.subscriptionTier);

  // Mock stats data - in real app, this would come from API
  const stats = {
    totalEmailsSent: 1247,
    deliveryRate: 98.5,
    openRate: 24.3,
    clickRate: 3.7
  };

  const quickActions = [
    {
      name: 'Analytics',
      description: 'View detailed campaign analytics',
      icon: ChartBarIcon,
      color: 'bg-blue-500',
      href: '/dashboard/analytics'
    },
    {
      name: 'Schedule',
      description: 'Manage scheduled campaigns',
      icon: CalendarIcon,
      color: 'bg-green-500',
      href: '/dashboard/schedule'
    },
    {
      name: 'Subscribers',
      description: 'Manage your contact lists',
      icon: UsersIcon,
      color: 'bg-purple-500',
      href: '/dashboard/subscribers'
    },
    {
      name: 'Templates',
      description: 'Browse template library',
      icon: DocumentTextIcon,
      color: 'bg-orange-500',
      href: '/dashboard/templates'
    },
    {
      name: 'Contact Support',
      description: 'Get help and support',
      icon: ChatBubbleLeftRightIcon,
      color: 'bg-pink-500',
      href: '/dashboard/contact'
    }
  ];

  return (
    <>
      <AnimatedBackground />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative">
        {/* Animated Header */}
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
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg">B</span>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      BulkEmail Platform
                    </h1>
                    <p className="text-sm text-gray-500">Welcome back, {user.firstName || 'User'}!</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 ${tierInfo.badge} rounded-full`}></div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${tierInfo.color}`}>
                    {tierInfo.name}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <BellIcon className="h-5 w-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => router.push('/dashboard/settings')}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Cog6ToothIcon className="h-5 w-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <UserCircleIcon className="h-6 w-6" />
                  </motion.button>
                </div>
              </motion.div>
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
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            <motion.div
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Emails Sent</p>
                  <AnimatedCounter 
                    value={stats.totalEmailsSent}
                    className="text-2xl font-bold text-gray-900"
                  />
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Delivery Rate</p>
                  <AnimatedCounter 
                    value={stats.deliveryRate}
                    suffix="%"
                    className="text-2xl font-bold text-green-600"
                  />
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Open Rate</p>
                  <AnimatedCounter 
                    value={stats.openRate}
                    suffix="%"
                    className="text-2xl font-bold text-purple-600"
                  />
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Click Rate</p>
                  <AnimatedCounter 
                    value={stats.clickRate}
                    suffix="%"
                    className="text-2xl font-bold text-orange-600"
                  />
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8"
          >
            {quickActions.map((action, index) => (
              <motion.button
                key={action.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(action.href)}
                className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200 text-left"
              >
                <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mb-3`}>
                  <action.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{action.name}</h3>
                <p className="text-sm text-gray-600">{action.description}</p>
              </motion.button>
            ))}
          </motion.div>

          {/* Main Dashboard Components */}
          <div className="space-y-8">
            {/* Email Sending Interface */}
            <EmailSendingInterface userTier={user.subscriptionTier} />

            {/* Template Management */}
            <TemplateManagement userTier={user.subscriptionTier} />

            {/* Tier Feature Display */}
            <TierFeatureDisplay currentTier={user.subscriptionTier} />
          </div>
        </main>
      </div>

      {/* Onboarding Flow */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingFlow
            user={user}
            onClose={handleOnboardingClose}
            onStepComplete={handleOnboardingStepComplete}
          />
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <FloatingActionButton />

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
    </>
  );
}