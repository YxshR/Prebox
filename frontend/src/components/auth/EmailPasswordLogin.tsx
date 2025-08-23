'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, ArrowLeft, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/lib/auth';
import { useApiState } from '@/hooks/useApiState';

interface EmailPasswordLoginProps {
  onSuccess?: (authResponse: any) => void;
  onError?: (error: string) => void;
  onBack?: () => void;
  className?: string;
}

interface LoginFormData {
  email: string;
  password: string;
}

export function EmailPasswordLogin({ 
  onSuccess, 
  onError, 
  onBack,
  className = '' 
}: EmailPasswordLoginProps) {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<LoginFormData>>({});

  const loginApi = useApiState();

  const updateFormData = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginFormData> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const result = await loginApi.execute(async () => {
        const response = await authApi.login({
          email: formData.email.toLowerCase().trim(),
          password: formData.password
        });
        return response;
      });

      if (result) {
        onSuccess?.(result);
      }
    } catch (error: any) {
      onError?.(error.message || 'Login failed. Please check your credentials.');
    }
  };

  const handleForgotPassword = () => {
    // TODO: Implement forgot password flow
    alert('Forgot password functionality will be implemented in a future update.');
  };

  const isLoading = loginApi.state.loading;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center space-x-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Mail className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle>Email & Password</CardTitle>
              <CardDescription>
                Sign in with your email and password
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          {loginApi.state.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {loginApi.state.error.message || 'Login failed. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => updateFormData('email', e.target.value)}
                disabled={isLoading}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-600 mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => updateFormData('password', e.target.value)}
                  disabled={isLoading}
                  className={`pr-10 ${errors.password ? 'border-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600 mt-1">{errors.password}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                Remember me
              </label>
            </div>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-blue-600 hover:text-blue-800"
              disabled={isLoading}
            >
              Forgot password?
            </button>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            loading={isLoading}
            className="w-full"
            size="lg"
          >
            Sign In
          </Button>

          <div className="text-center pt-4 border-t">
            <p className="text-xs text-gray-500">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}