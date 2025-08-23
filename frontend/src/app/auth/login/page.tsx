'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { authApi, LoginData } from '../../../lib/auth';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { useApiState } from '../../../hooks/useApiState';
import ErrorDisplay from '../../../components/ErrorDisplay';
import LoadingState from '../../../components/LoadingState';
import ConnectionStatus from '../../../components/ConnectionStatus';
import { GoogleAuthButton } from '../../../components/auth/GoogleAuthButton';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const { state: loginState, execute: executeLogin, retry: retryLogin } = useApiState();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginData>();

  const onSubmit = async (data: LoginData) => {
    const response = await executeLogin(async () => {
      return await authApi.login(data);
    });

    if (response) {
      // Store tokens
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      
      toast.success('Login successful!');
      router.push('/dashboard');
    } else if (loginState.error) {
      // Handle specific error cases
      if (loginState.error.response?.status === 401) {
        setError('email', { type: 'manual', message: 'Invalid email or password' });
        setError('password', { type: 'manual', message: 'Invalid email or password' });
      }
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
        {/* Connection Status Bar */}
        <div className="bg-white border-b px-4 py-2">
          <ConnectionStatus />
        </div>
        
        <div className="flex-1 flex items-center justify-center py-12 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md mx-auto"
          >
            <div className="bg-white shadow-lg rounded-lg p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
              <p className="text-gray-600 mt-2">Sign in to your account</p>
            </div>

            {/* Error Display */}
            {loginState.error && (
              <div className="mb-6">
                <ErrorDisplay 
                  error={loginState.error} 
                  onRetry={retryLogin}
                />
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  disabled={loginState.loading}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('password', {
                      required: 'Password is required',
                    })}
                    disabled={loginState.loading}
                  />
                <button
                  type="button"
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loginState.loading}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={loginState.loading}
                disabled={loginState.loading}
              >
                {loginState.loading ? (
                  <LoadingState message="Signing in..." size="small" />
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            {/* Links */}
            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-gray-600">
                Don&apos;t have an account?{' '}
                <Link href="/auth/register" className="text-blue-600 hover:text-blue-700 font-medium">
                  Sign up
                </Link>
              </p>
              <p className="text-sm">
                <Link href="/auth/forgot-password" className="text-blue-600 hover:text-blue-700">
                  Forgot your password?
                </Link>
              </p>
            </div>

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
                    console.log('Google login successful:', user);
                    // Handle successful Google login
                    router.push('/dashboard');
                  }}
                  onError={(error) => {
                    console.error('Google login failed:', error);
                    toast.error(error);
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
        </div>
      </div>
      <Toaster position="top-right" />
    </>
  );
}