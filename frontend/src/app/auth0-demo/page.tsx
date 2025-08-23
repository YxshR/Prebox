'use client';

import React, { useState } from 'react';
import { Auth0ProviderWrapper } from '@/components/auth/Auth0Provider';
import { Auth0SignupFlow } from '@/components/auth/Auth0SignupFlow';
import Button from '@/components/ui/Button';

export default function Auth0DemoPage() {
  const [showSignup, setShowSignup] = useState(false);
  const [completedData, setCompletedData] = useState<any>(null);

  const handleSignupComplete = (userData: any) => {
    console.log('Auth0 Signup completed:', userData);
    setCompletedData(userData);
    setShowSignup(false);
  };

  const handleSignupCancel = () => {
    setShowSignup(false);
  };

  if (showSignup) {
    return (
      <Auth0ProviderWrapper>
        <Auth0SignupFlow
          onComplete={handleSignupComplete}
          onCancel={handleSignupCancel}
        />
      </Auth0ProviderWrapper>
    );
  }

  return (
    <Auth0ProviderWrapper>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Auth0 Signup Flow Demo
            </h1>
            <p className="text-lg text-gray-600">
              Test the Auth0 signup flow with phone verification
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Auth0 Signup Components
            </h2>
            <p className="text-gray-600 mb-6">
              This demo showcases the Auth0 signup flow with integrated phone verification.
              The flow includes Auth0 authentication followed by phone number verification.
            </p>

            <div className="space-y-4">
              <Button
                onClick={() => setShowSignup(true)}
                className="w-full sm:w-auto"
              >
                Start Auth0 Signup Flow
              </Button>
            </div>
          </div>

          {completedData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Signup Completed Successfully!
              </h3>
              <div className="text-sm text-green-700">
                <p><strong>User ID:</strong> {completedData.auth0User?.sub}</p>
                <p><strong>Email:</strong> {completedData.auth0User?.email}</p>
                <p><strong>Name:</strong> {completedData.auth0User?.name}</p>
                {completedData.phone && (
                  <p><strong>Phone:</strong> {completedData.phone}</p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Component Features
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Auth0SignupFlow</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Auth0 SDK integration</li>
                  <li>• Secure authentication flow</li>
                  <li>• Progress indicator</li>
                  <li>• Error handling</li>
                  <li>• Responsive design</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Auth0Callback</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Handles Auth0 redirects</li>
                  <li>• Error state management</li>
                  <li>• Loading states</li>
                  <li>• Automatic routing</li>
                  <li>• Success callbacks</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">PhoneVerificationForAuth0</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Phone number formatting</li>
                  <li>• OTP verification</li>
                  <li>• Auth0 user context</li>
                  <li>• Resend functionality</li>
                  <li>• Input validation</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Error Handling</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Auth0 error mapping</li>
                  <li>• User-friendly messages</li>
                  <li>• Retry mechanisms</li>
                  <li>• Fallback states</li>
                  <li>• Security logging</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Auth0ProviderWrapper>
  );
}