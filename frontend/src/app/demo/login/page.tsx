'use client';

import React from 'react';
import { Login } from '@/components/auth/Login';
import { Auth0ProviderWrapper } from '@/components/auth/Auth0Provider';
import { AuthProvider } from '@/components/auth/AuthProvider';

export default function LoginDemoPage() {
  const handleLoginSuccess = (user: any) => {
    console.log('Login successful:', user);
    alert(`Welcome ${user.email || user.name || 'User'}!`);
  };

  return (
    <Auth0ProviderWrapper>
      <AuthProvider>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Login Demo
              </h1>
              <p className="text-gray-600">
                Test all authentication methods
              </p>
            </div>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10">
              <Login 
                onSuccess={handleLoginSuccess}
                redirectTo="/dashboard"
              />
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="bg-white rounded-lg shadow p-4 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Demo Features
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✅ Multiple login methods</li>
                <li>✅ Auth0 social login integration</li>
                <li>✅ Phone OTP authentication</li>
                <li>✅ Email/password login</li>
                <li>✅ Session management</li>
                <li>✅ Automatic token refresh</li>
              </ul>
            </div>
          </div>
        </div>
      </AuthProvider>
    </Auth0ProviderWrapper>
  );
}