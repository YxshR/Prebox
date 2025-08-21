/**
 * Lazy-loaded components for home page performance optimization
 * Implements code splitting for non-critical components
 */

import { Suspense } from 'react';
import { createLazyComponent } from '../../lib/performanceOptimization';
import { motion } from 'framer-motion';

// Loading component for lazy-loaded sections
function SectionLoader({ height = 'h-96' }: { height?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`${height} bg-gray-50 flex items-center justify-center`}
    >
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading content...</p>
      </div>
    </motion.div>
  );
}

// Lazy load MultimediaShowcase component
const LazyMultimediaShowcase = createLazyComponent(
  () => import('./MultimediaShowcase'),
  'MultimediaShowcase'
);

// Lazy load AnimatedPricingSection component
const LazyAnimatedPricingSection = createLazyComponent(
  () => import('./AnimatedPricingSection'),
  'AnimatedPricingSection'
);

// Lazy load MediaGallery component
const LazyMediaGallery = createLazyComponent(
  () => import('./MediaGallery'),
  'MediaGallery'
);

// Lazy load PremiumVideoPlayer component
const LazyPremiumVideoPlayer = createLazyComponent(
  () => import('./PremiumVideoPlayer'),
  'PremiumVideoPlayer'
);

// Lazy load PricingComparison component
const LazyPricingComparison = createLazyComponent(
  () => import('./PricingComparison'),
  'PricingComparison'
);

// Wrapper components with Suspense boundaries
export function LazyMultimediaShowcaseWrapper(props: any) {
  return (
    <Suspense fallback={<SectionLoader height="h-[600px]" />}>
      <LazyMultimediaShowcase {...props} />
    </Suspense>
  );
}

export function LazyAnimatedPricingSectionWrapper(props: any) {
  return (
    <Suspense fallback={<SectionLoader height="h-[500px]" />}>
      <LazyAnimatedPricingSection {...props} />
    </Suspense>
  );
}

export function LazyMediaGalleryWrapper(props: any) {
  return (
    <Suspense fallback={<SectionLoader height="h-[400px]" />}>
      <LazyMediaGallery {...props} />
    </Suspense>
  );
}

export function LazyPremiumVideoPlayerWrapper(props: any) {
  return (
    <Suspense fallback={<SectionLoader height="h-[400px]" />}>
      <LazyPremiumVideoPlayer {...props} />
    </Suspense>
  );
}

export function LazyPricingComparisonWrapper(props: any) {
  return (
    <Suspense fallback={<SectionLoader height="h-[600px]" />}>
      <LazyPricingComparison {...props} />
    </Suspense>
  );
}

// Preload functions for better UX
export const preloadHomeComponents = {
  multimediaShowcase: () => import('./MultimediaShowcase'),
  animatedPricing: () => import('./AnimatedPricingSection'),
  mediaGallery: () => import('./MediaGallery'),
  videoPlayer: () => import('./PremiumVideoPlayer'),
  pricingComparison: () => import('./PricingComparison'),
};

// Preload all components when user shows intent to interact
export function preloadAllHomeComponents() {
  Object.values(preloadHomeComponents).forEach(preloadFn => {
    preloadFn().catch(() => {
      // Silently handle preload failures
    });
  });
}