'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';

import Button from '../ui/Button';
import Input from '../ui/Input';
import { RegisterData, authApi } from '../../lib/auth';
import toast from 'react-hot-toast';
import GoogleAuthButton from './GoogleAuthButton';

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

      const response = await authApi.register(registerData);
      
      toast.success('Registration successful! Please verify your phone number.');
      
      onSuccess({
        userId: response.user.id,
        email: response.user.email,
        otpId: response.otpId,
        registrationMethod: 'phone_google',
        phone: data.phone,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 'Registration failed. Please try again.';
      toast.error(errorMessage);
      
      // Handle specific validation errors
      if (error.response?.data?.error?.code === 'VALIDATION_ERROR') {
        const message = error.response.data.error.message;
        if (message.includes('phone')) {
          setError('phone', { type: 'manual', message });
        }
      }
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
            <Input
              label="First Name"
              placeholder="John"
              {...register('firstName')}
              error={errors.firstName?.message}
            />
            <Input
              label="Last Name"
              placeholder="Doe"
              {...register('lastName')}
              error={errors.lastName?.message}
            />
          </div>

          {/* Phone Field */}
          <Input
            label="Phone Number"
            type="tel"
            placeholder="+91 98765 43210"
            {...register('phone', {
              required: 'Phone number is required',
              pattern: {
                value: /^[\+]?[1-9][\d]{0,15}$/,
                message: 'Invalid phone number',
              },
            })}
            error={errors.phone?.message}
            helperText="We'll send you an OTP for verification"
          />

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
              mode="signup" 
              disabled={loading}
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