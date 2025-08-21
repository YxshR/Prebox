'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import Button from '../../../components/ui/Button';
import { authApi } from '../../../lib/auth';
import { Toaster } from 'react-hot-toast';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link');
        return;
      }

      try {
        const response = await authApi.verifyEmail(token);
        if (response.verified) {
          setStatus('success');
          setMessage('Your email has been successfully verified!');
        } else {
          setStatus('error');
          setMessage('Email verification failed. The link may be expired or invalid.');
        }
      } catch (error: any) {
        setStatus('error');
        setMessage(error.response?.data?.error?.message || 'Email verification failed. Please try again.');
      }
    };

    verifyEmail();
  }, [token]);

  const handleContinue = () => {
    if (status === 'success') {
      router.push('/dashboard');
    } else {
      router.push('/auth/register');
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-white shadow-lg rounded-lg p-8 text-center">
            {status === 'loading' && (
              <>
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Email</h2>
                <p className="text-gray-600">Please wait while we verify your email address...</p>
              </>
            )}

            {status === 'success' && (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4"
                >
                  <CheckCircleIcon className="w-8 h-8 text-green-600" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <Button onClick={handleContinue} className="w-full" size="lg">
                  Continue to Dashboard
                </Button>
              </>
            )}

            {status === 'error' && (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4"
                >
                  <XCircleIcon className="w-8 h-8 text-red-600" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="space-y-3">
                  <Button onClick={handleContinue} className="w-full" size="lg">
                    Try Again
                  </Button>
                  <Button 
                    onClick={() => router.push('/auth/login')} 
                    variant="outline" 
                    className="w-full"
                  >
                    Go to Login
                  </Button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
      <Toaster position="top-right" />
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}