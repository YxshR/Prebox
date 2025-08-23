'use client';

import React from 'react';
import { Login } from '@/components/auth/Login';
import { Auth0ProviderWrapper } from '@/components/auth/Auth0Provider';

export default function LoginPage() {
  const handleLoginSuccess = (user: any) => {
    console.log('Login successful:', user);
  };

  return (
    <Auth0ProviderWrapper>
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Sign In
            </h1>
            <p className="text-gray-600">
              Access your account using your preferred method
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <Login 
              onSuccess={handleLoginSuccess}
              redirectTo="/dashboard"
            />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help?{' '}
            <a 
              href="/support" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </Auth0ProviderWrapper>
  );
}