'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Smartphone, Mail, Shield } from 'lucide-react';

export type LoginMethod = 'auth0' | 'phone' | 'email';

interface LoginMethodSelectorProps {
  onMethodSelect: (method: LoginMethod) => void;
  loading?: boolean;
  className?: string;
}

export function LoginMethodSelector({ 
  onMethodSelect, 
  loading = false,
  className = '' 
}: LoginMethodSelectorProps) {
  const loginMethods = [
    {
      id: 'auth0' as LoginMethod,
      title: 'Social Login',
      description: 'Sign in with Google, Facebook, or other social accounts',
      icon: Shield,
      primary: true
    },
    {
      id: 'phone' as LoginMethod,
      title: 'Phone Number',
      description: 'Sign in with your phone number and OTP',
      icon: Smartphone,
      primary: false
    },
    {
      id: 'email' as LoginMethod,
      title: 'Email & Password',
      description: 'Sign in with your email and password',
      icon: Mail,
      primary: false
    }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome Back
        </h2>
        <p className="text-gray-600">
          Choose your preferred login method
        </p>
      </div>

      <div className="grid gap-4">
        {loginMethods.map((method) => {
          const IconComponent = method.icon;
          
          return (
            <Card 
              key={method.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:border-blue-300 ${
                method.primary ? 'border-blue-200 bg-blue-50' : ''
              }`}
              onClick={() => !loading && onMethodSelect(method.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    method.primary 
                      ? 'bg-blue-100 text-blue-600' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{method.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {method.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  variant={method.primary ? 'default' : 'outline'}
                  className="w-full"
                  disabled={loading}
                  loading={loading}
                >
                  {method.primary ? 'Continue with Social Login' : `Continue with ${method.title}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center mt-6">
        <p className="text-sm text-gray-500">
          Don't have an account?{' '}
          <button 
            className="text-blue-600 hover:text-blue-800 font-medium"
            onClick={() => window.location.href = '/auth/signup'}
          >
            Sign up here
          </button>
        </p>
      </div>
    </div>
  );
}