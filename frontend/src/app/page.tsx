'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import HeroSection from '../components/home/HeroSection';
import { 
  LazyMultimediaShowcaseWrapper,
  LazyAnimatedPricingSectionWrapper,
  preloadAllHomeComponents 
} from '../components/home/LazyComponents';
import { useBundleAnalyzer } from '../lib/bundleAnalyzer';
import { usePerformanceMonitoring, useAnimationPerformance } from '../hooks/usePerformanceMonitoring';
import { serviceWorkerManager } from '../lib/serviceWorker';
import { AnimatedSection, InteractiveElement, StaggeredContainer, FloatingActionButton } from '../components/common/PremiumAnimations';
import { ErrorHandlingProvider, useErrorHandling, useApiErrorHandler } from '../components/common/ErrorHandlingProvider';
import { ApiDependentContent, CriticalFeature, OptionalFeature } from '../components/common/GracefulDegradation';
import { PageErrorBoundary } from '../components/common/ErrorBoundary';
import { useScrollAnimations } from '../hooks/useScrollAnimations';
import { useResponsiveMedia } from '../hooks/useResponsiveMedia';
import { ArrowUpIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import PerformanceDashboard from '../components/common/PerformanceDashboard';

export default function Home() {
  const router = useRouter();
  const { canUseHeavyAnimations, isMobile } = useResponsiveMedia();
  const { shouldAnimate } = useScrollAnimations({
    threshold: 0.1,
    enableParallax: true,
    parallaxSpeed: 0.3
  });

  // Performance monitoring and optimization
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false);
  const { analyze: analyzeBundleSize, getPerformanceImpact } = useBundleAnalyzer();
  const { startTiming, endTiming } = usePerformanceMonitoring({
    enableWebVitals: true,
    enableCustomMetrics: true,
  });
  const { getFrameRate } = useAnimationPerformance();

  useEffect(() => {
    // Start performance monitoring
    startTiming('home-page-load');

    // Check if user is already logged in
    const token = localStorage.getItem('accessToken');
    if (token) {
      router.push('/dashboard');
      return;
    }

    // Register service worker for caching
    serviceWorkerManager.register({
      onSuccess: () => console.log('Service worker registered successfully'),
      onUpdate: () => console.log('Service worker updated'),
      onError: (error) => console.error('Service worker registration failed:', error),
    });

    // Preload components when user shows intent to interact
    const handleUserInteraction = () => {
      startTiming('component-preload');
      preloadAllHomeComponents();
      endTiming('component-preload');
      
      // Remove listeners after first interaction
      document.removeEventListener('mousemove', handleUserInteraction);
      document.removeEventListener('scroll', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    // Start preloading on first user interaction
    document.addEventListener('mousemove', handleUserInteraction, { once: true });
    document.addEventListener('scroll', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });

    // Analyze bundle size after initial load
    setTimeout(() => {
      analyzeBundleSize().then(() => {
        const impact = getPerformanceImpact();
        console.log('Bundle performance grade:', impact.grade);
        if (impact.issues.length > 0) {
          console.warn('Bundle optimization opportunities:', impact.issues);
        }
      });
      endTiming('home-page-load');
    }, 2000);

    return () => {
      document.removeEventListener('mousemove', handleUserInteraction);
      document.removeEventListener('scroll', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [router, startTiming, endTiming, analyzeBundleSize, getPerformanceImpact]);

  const handleSignupClick = () => {
    router.push('/auth/signup');
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <PageErrorBoundary>
      <ErrorHandlingProvider
        showGlobalErrorBanner={true}
        enableOfflineMode={true}
        enableGracefulDegradation={true}
      >
        <div className="min-h-screen">
          {/* Navigation Header */}
          <AnimatedSection
            animation="fadeIn"
            delay={0.2}
            className="absolute top-0 left-0 right-0 z-50"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <nav className="flex items-center justify-between">
                <InteractiveElement type="icon" className="flex items-center">
                  <h1 className="text-2xl font-bold text-white">Perbox</h1>
                </InteractiveElement>
                <div className="flex items-center space-x-4">
                  <InteractiveElement type="button">
                    <Link
                      href="/auth/signup"
                      className="text-white/80 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Sign Up
                    </Link>
                  </InteractiveElement>
                  <InteractiveElement type="button">
                    <Link
                      href="/demo"
                      className="text-white/80 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Demo
                    </Link>
                  </InteractiveElement>
                  <InteractiveElement type="button" hoverScale={1.02} tapScale={0.98}>
                    <Link
                      href="/auth/login"
                      className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 px-4 py-2 rounded-md text-sm font-medium transition-colors border border-white/30"
                    >
                      Sign In
                    </Link>
                  </InteractiveElement>
                </div>
              </nav>
            </div>
          </AnimatedSection>

          {/* Hero Section - Works offline */}
          <HeroSection onSignupClick={handleSignupClick} />

          {/* Interactive Multimedia Showcase - Works offline */}
          <AnimatedSection animation="fadeUp" delay={0.3} threshold={0.2}>
            <LazyMultimediaShowcaseWrapper 
              onFeatureSelect={(featureId: string) => {
                console.log('Selected feature:', featureId);
                // Could track analytics or navigate to specific demo
              }}
            />
          </AnimatedSection>

          {/* Secure Animated Pricing Section - Critical for business */}
          <AnimatedSection animation="scale" delay={0.4} threshold={0.2}>
            <CriticalFeature featureName="Pricing">
              <LazyAnimatedPricingSectionWrapper 
                onPlanSelect={(planId: string, amount: number) => {
                  console.log('Selected plan:', planId, 'Amount:', amount);
                  // Navigate to signup or payment flow
                  router.push(`/auth/signup?plan=${planId}&amount=${amount}`);
                }}
              />
            </CriticalFeature>
          </AnimatedSection>

          {/* Features and Content Sections - Can work offline */}
          <AnimatedSection animation="fadeUp" delay={0.5} className="bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
              <div className="text-center">
                {/* Features Grid */}
                <StaggeredContainer staggerDelay={0.15} className="grid md:grid-cols-3 gap-8">
                  <InteractiveElement type="card" className="bg-white p-6 rounded-lg shadow-lg">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Bulk Email Sending</h3>
                    <p className="text-gray-600">Send thousands of emails with high deliverability rates and professional templates.</p>
                  </InteractiveElement>

                  <InteractiveElement type="card" className="bg-white p-6 rounded-lg shadow-lg">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">AI Templates</h3>
                    <p className="text-gray-600">Generate professional email templates using AI. Save time and create engaging content.</p>
                    
                    {/* Optional feature indicator */}
                    <OptionalFeature 
                      offlineMessage="AI features require internet connection"
                      className="mt-3"
                    >
                      <button className="text-sm text-purple-600 hover:text-purple-800 underline">
                        Try AI Generator
                      </button>
                    </OptionalFeature>
                  </InteractiveElement>

                  <InteractiveElement type="card" className="bg-white p-6 rounded-lg shadow-lg">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Advanced Analytics</h3>
                    <p className="text-gray-600">Track opens, clicks, bounces, and more with detailed analytics and reporting.</p>
                  </InteractiveElement>
                </StaggeredContainer>
              </div>
            </div>
          </AnimatedSection>

          {/* Floating Action Buttons */}
          <div className="fixed bottom-6 right-6 flex flex-col space-y-3 z-40">
            {/* Performance Dashboard Toggle */}
            {process.env.NODE_ENV === 'development' && (
              <FloatingActionButton
                onClick={() => setShowPerformanceDashboard(true)}
                icon={<ChartBarIcon className="w-6 h-6" />}
                label="Performance Dashboard"
                position="bottom-right"
                className="bg-purple-600 hover:bg-purple-700"
              />
            )}
            
            {/* Scroll to top */}
            <FloatingActionButton
              onClick={scrollToTop}
              icon={<ArrowUpIcon className="w-6 h-6" />}
              label="Scroll to top"
              position="bottom-right"
            />
          </div>

          {/* Performance Dashboard */}
          <PerformanceDashboard
            isVisible={showPerformanceDashboard}
            onClose={() => setShowPerformanceDashboard(false)}
          />
        </div>
      </ErrorHandlingProvider>
    </PageErrorBoundary>
  );
}
