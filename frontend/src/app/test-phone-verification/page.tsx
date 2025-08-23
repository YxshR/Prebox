'use client';

import { useState } from 'react';
import { PhoneVerification } from '../../components/auth/PhoneVerification';
import { validateAndFormatPhone } from '../../lib/phoneValidation';

export default function TestPhoneVerificationPage() {
  const [otpId, setOtpId] = useState('test-otp-id-123');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [enableAuth, setEnableAuth] = useState(false);
  const [showComponent, setShowComponent] = useState(true);

  const handleSuccess = (authData?: any) => {
    console.log('Verification successful!', authData);
    alert(`Verification successful! ${authData ? 'With auth data' : 'Standard verification'}`);
  };

  const handleResend = (newOtpId: string) => {
    console.log('Resend OTP, new ID:', newOtpId);
    setOtpId(newOtpId);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const result = validateAndFormatPhone(e.target.value);
    setPhone(result.formatted);
  };

  const resetComponent = () => {
    setShowComponent(false);
    setTimeout(() => setShowComponent(true), 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Phone Verification Component Test
          </h1>
          
          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={handlePhoneChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter phone number"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OTP ID
              </label>
              <input
                type="text"
                value={otpId}
                onChange={(e) => setOtpId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter OTP ID"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={enableAuth}
                  onChange={(e) => setEnableAuth(e.target.checked)}
                  className="mr-2"
                />
                Enable Authentication (JWT tokens)
              </label>
              
              <button
                onClick={resetComponent}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Reset Component
              </button>
            </div>
          </div>
          
          <div className="border-t pt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Component Preview
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Features being tested:
            </p>
            <ul className="text-sm text-gray-600 mb-6 list-disc list-inside space-y-1">
              <li>Enhanced phone number validation and formatting</li>
              <li>Secure OTP input with validation</li>
              <li>Security feedback and error handling</li>
              <li>Rate limiting and attempt tracking</li>
              <li>JWT token integration for authentication</li>
              <li>Improved UX with animations and micro-interactions</li>
            </ul>
          </div>
        </div>
        
        {showComponent && (
          <PhoneVerification
            onPhoneSubmit={(phoneNumber) => {
              console.log('Phone submitted:', phoneNumber);
              // Handle phone submission
            }}
            onOtpVerify={(otp) => {
              console.log('OTP verified:', otp);
              handleSuccess();
            }}
            onResendOtp={() => {
              console.log('Resending OTP');
              handleResend('new-otp-id');
            }}
            loading={false}
            error={null}
            showOtpInput={!!otpId}
            onBack={() => {
              console.log('Going back');
            }}
          />
        )}
        
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            Testing Instructions:
          </h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Enter any 6-digit code to test validation</li>
            <li>Try invalid codes to see security feedback</li>
            <li>Test the resend functionality</li>
            <li>Toggle authentication mode to see JWT integration</li>
            <li>Check browser console for detailed logs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}