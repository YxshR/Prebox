'use client';

import { Suspense } from 'react';
import GoogleOAuthCallback from '../../../../components/auth/GoogleOAuthCallback';
import { Toaster } from 'react-hot-toast';

function CallbackPageContent() {
  return (
    <>
      <GoogleOAuthCallback />
      <Toaster position="top-right" />
    </>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <CallbackPageContent />
    </Suspense>
  );
}