'use client';

import React, { useState } from 'react';
import { PhoneSignupFlow } from './PhoneSignupFlow';
import toast from 'react-hot-toast';

interface PhoneSignupExampleProps {
  onSignupComplete?: (userData: any) => void;
}

export function PhoneSignupExample({ onSignupComplete }: PhoneSignupExampleProps) {
  const [showSignup, setShowSignup] = useState(false);

  const handleSignupComplete = async (userData: {
    phone: string;
    email: string;
    password: string;
  }) => {
    try {
      console.log('Signup completed with data:', userData);
      toast.success('Account created successfully!');
      
      // Call the parent callback if provided
      onSignupComplete?.(userData);
      
      // Hide the signup flow
      setShowSignup(false);
      
      // You could redirect to dashboard or login page here
      // router.push('/dashboard');
    } catch (error) {
      console.error('Error handling signup completion:', error);
      toast.error('Failed to complete signup');
    }
  };

  const handleCancel = () => {
    setShowSignup(false);
    toast('Signup cancelled');
  };

  if (showSignup) {
    return (
      <PhoneSignupFlow
        onComplete={handleSignupComplete}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Phone Signup Demo
          </h1>
          <p className="text-gray-600 mb-6">
            Try the new multi-step phone signup flow
          </p>
          <button
            onClick={() => setShowSignup(true)}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Start Phone Signup
          </button>
        </div>
      </div>
    </div>
  );
}