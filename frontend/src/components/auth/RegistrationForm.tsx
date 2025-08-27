'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';

import Button from '../ui/Button';
import Input from '../ui/Input';
import { RegisterData, authApi } from '../../lib/auth';
import { apiClient } from '../../lib/api-client';
import toast from 'react-hot-toast';
import { GoogleAuthButton } from './GoogleAuthButton';

interface RegistrationFormProps {
  onSuccess: (data: { userId: string; email: string; otpId?: string; registrationMethod: string; phone?: string }) => void;
}

interface FormData {
  phone: string;
  firstName?: string;
  lastName?: string;
}

export default function RegistrationForm({ onSuccess }: RegistrationFormProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const registerData: RegisterData = {
        email: `${data.phone}@temp.perbox.com`, // Temporary email for phone-only registration
        password: 'temp-password-123', // Temporary password for phone-only registration
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        registrationMethod: 'phone_google',
      };

      console.log('Attempting registration with data:', { ...registerData, password: '[HIDDEN]' });

      // First check if backend is reachable
      try {
        await apiClient.get('/health');
        console.log('✅ Backend is reachable');
      } catch (healthError) {
        console.error('❌ Backend health check failed:', healthError);
        throw new Error('Cannot connect to server. Please make sure the backend is running on port 3001.');
      }

      const response = await authApi.register(registerData);

      console.log('Registration successful:', response);
      toast.success('Registration successful! Please verify your phone number.');

      onSuccess({
        userId: response.user.id,
        email: response.user.email,
        otpId: response.otpId,
        registrationMethod: 'phone_google',
        phone: data.phone,
      });
    } catch (error: any) {
      console.error('Registration error:', error);

      let errorMessage = 'Registration failed. Please try again.';

      // Handle different types of errors
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to server. Please make sure the backend is running.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your connection and try again.';
      }

      toast.error(errorMessage);

      // Handle specific validation errors
      if (error.response?.data?.error?.code === 'VALIDATION_ERROR') {
        const message = error.response.data.error.message;
        if (message.includes('phone')) {
          setError('phone', { type: 'manual', message });
        }
      }

      // Log detailed error for debugging
      console.error('Detailed registration error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        code: error.code,
        message: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="text-gray-600 mt-2">
            Sign up with your phone number
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <Input
                placeholder="John"
                {...register('firstName')}
              />
              {errors.firstName && (
                <p className="text-red-500 text-sm mt-1">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <Input
                placeholder="Doe"
                {...register('lastName')}
              />
              {errors.lastName && (
                <p className="text-red-500 text-sm mt-1">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <Input
              type="tel"
              placeholder="+91 98765 43210"
              {...register('phone', {
                required: 'Phone number is required',
                pattern: {
                  value: /^[\+]?[1-9][\d]{0,15}$/,
                  message: 'Invalid phone number',
                },
              })}
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
            )}
            <p className="text-gray-500 text-sm mt-1">We'll send you an OTP for verification</p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={loading}
          >
            Create Account
          </Button>
        </form>

        {/* Google OAuth */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <GoogleAuthButton
              onSuccess={(user) => {
                console.log('Google signup successful:', user);
                // Handle successful Google signup
                onSuccess({
                  userId: 'google-user-id',
                  email: user.email,
                  registrationMethod: 'google',
                });
              }}
              onError={(error) => {
                console.error('Google signup failed:', error);
                toast.error(error);
              }}
            />
          </div>
        </div>

        {/* Terms and Privacy */}
        <p className="text-xs text-gray-500 text-center mt-6">
          By creating an account, you agree to our{' '}
          <a href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </motion.div>
  );
}