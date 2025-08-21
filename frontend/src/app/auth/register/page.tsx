'use client';

import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import OnboardingFlow from '../../../components/auth/OnboardingFlow';
import { Toaster } from 'react-hot-toast';

function RegisterPageContent() {
  const router = useRouter();

  const handleOnboardingComplete = () => {
    // Redirect to dashboard after successful onboarding
    router.push('/dashboard');
  };

  return (
    <>
      <OnboardingFlow
        onComplete={handleOnboardingComplete}
      />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}