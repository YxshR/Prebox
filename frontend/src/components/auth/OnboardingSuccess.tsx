'use client';

import { motion } from 'framer-motion';
import { CheckCircleIcon, SparklesIcon, EnvelopeIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import Button from '../ui/Button';

interface OnboardingSuccessProps {
  userName?: string;
  onContinue: () => void;
}

export default function OnboardingSuccess({ userName, onContinue }: OnboardingSuccessProps) {
  const features = [
    {
      icon: EnvelopeIcon,
      title: '100 Emails Daily',
      description: 'Send up to 100 emails per day with your Free tier',
    },
    {
      icon: SparklesIcon,
      title: '1 AI Template Daily',
      description: 'Generate professional email templates using AI',
    },
    {
      icon: ChartBarIcon,
      title: 'Basic Analytics',
      description: 'Track your email performance with essential metrics',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="bg-white shadow-lg rounded-lg p-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6"
          >
            <CheckCircleIcon className="w-10 h-10 text-green-600" />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-bold text-gray-900 mb-2"
          >
            Welcome to BulkEmail Platform!
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-gray-600"
          >
            {userName ? `Hi ${userName}, your` : 'Your'} account has been successfully created
          </motion.p>
        </div>

        {/* Free Tier Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-2 flex items-center">
              <SparklesIcon className="w-5 h-5 mr-2" />
              Free Tier Activated
            </h2>
            <p className="text-blue-800 text-sm">
              You've been automatically assigned to our Free tier. Start sending emails right away!
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="bg-gray-50 rounded-lg p-4 text-center"
              >
                <feature.icon className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                <h3 className="font-medium text-gray-900 mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Next Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6"
        >
          <h3 className="font-medium text-yellow-900 mb-2">What's Next?</h3>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• Import your contacts or create contact lists</li>
            <li>• Design your first email template</li>
            <li>• Send your first campaign</li>
            <li>• Upgrade to unlock more features</li>
          </ul>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Button
            onClick={onContinue}
            className="flex-1"
            size="lg"
          >
            Go to Dashboard
          </Button>
          
          <Button
            variant="outline"
            className="flex-1"
            size="lg"
            onClick={() => {
              // This could open a tour or guide
              onContinue();
            }}
          >
            Take a Tour
          </Button>
        </motion.div>

        {/* Upgrade Hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="text-center mt-6"
        >
          <p className="text-sm text-gray-500">
            Need more emails?{' '}
            <button className="text-blue-600 hover:text-blue-700 font-medium">
              Upgrade to Paid Standard
            </button>{' '}
            for up to 1,000 emails daily
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}