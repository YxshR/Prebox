'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircleIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import Button from '../ui/Button';
import { authApi } from '../../lib/auth';
import toast from 'react-hot-toast';

interface EmailVerificationProps {
  email: string;
  onSuccess: () => void;
  isVerified?: boolean;
}

export default function EmailVerification({ email, onSuccess, isVerified = false }: EmailVerificationProps) {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResendEmail = async () => {
    setLoading(true);
    try {
      await authApi.resendEmailVerification();
      setEmailSent(true);
      toast.success('Verification email sent! Please check your inbox.');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to send verification email. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (isVerified) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="bg-white shadow-lg rounded-lg p-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4"
          >
            <CheckCircleIcon className="w-8 h-8 text-green-600" />
          </motion.div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Email Verified!</h2>
          <p className="text-gray-600 mb-6">
            Your email address has been successfully verified.
          </p>
          
          <Button onClick={onSuccess} className="w-full" size="lg">
            Continue to Dashboard
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="text-center mb-8">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatType: 'reverse'
            }}
            className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4"
          >
            <EnvelopeIcon className="w-8 h-8 text-blue-600" />
          </motion.div>
          
          <h2 className="text-3xl font-bold text-gray-900">Check Your Email</h2>
          <p className="text-gray-600 mt-2">
            We've sent a verification link to
          </p>
          <p className="text-gray-900 font-medium break-all">
            {email}
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Next Steps:</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Check your email inbox</li>
              <li>Click the verification link</li>
              <li>Return here to continue</li>
            </ol>
          </div>

          {/* Resend Email Button */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-3">
              Didn't receive the email?
            </p>
            <Button
              onClick={handleResendEmail}
              variant="outline"
              loading={loading}
              disabled={emailSent}
            >
              {emailSent ? 'Email Sent!' : 'Resend Verification Email'}
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Check your spam folder if you don't see the email in your inbox.
            </p>
          </div>

          {/* Manual Check Button */}
          <Button
            onClick={onSuccess}
            variant="ghost"
            className="w-full"
          >
            I've verified my email
          </Button>
        </div>
      </div>
    </motion.div>
  );
}