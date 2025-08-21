/**
 * Progressive image loading component with blur placeholder and lazy loading
 * Implements requirement 2.3 for optimized media loading
 */

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { LazyLoadObserver } from '../../lib/performanceOptimization';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  blurDataURL?: string;
  placeholder?: 'blur' | 'empty';
  quality?: number;
  onLoad?: () => void;
  onError?: () => void;
}

export default function ProgressiveImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  sizes,
  blurDataURL,
  placeholder = 'blur',
  quality = 75,
  onLoad,
  onError,
}: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<LazyLoadObserver | null>(null);

  // Generate blur placeholder if not provided
  const defaultBlurDataURL = blurDataURL || generateBlurDataURL(width || 400, height || 300);

  useEffect(() => {
    if (priority || isInView) return;

    // Set up intersection observer for lazy loading
    observerRef.current = new LazyLoadObserver({
      rootMargin: '50px',
      threshold: 0.1,
    });

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current, () => {
        setIsInView(true);
      });
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [priority, isInView]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      <AnimatePresence mode="wait">
        {!isInView && !priority ? (
          // Placeholder while not in view
          <motion.div
            key="placeholder"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full bg-gray-200 flex items-center justify-center"
            style={{ aspectRatio: width && height ? `${width}/${height}` : undefined }}
          >
            <div className="w-8 h-8 bg-gray-300 rounded animate-pulse" />
          </motion.div>
        ) : hasError ? (
          // Error state
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400"
            style={{ aspectRatio: width && height ? `${width}/${height}` : undefined }}
          >
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Image failed to load</p>
            </div>
          </motion.div>
        ) : (
          // Progressive image loading
          <motion.div
            key="image"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative"
          >
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
              className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
              priority={priority}
              sizes={sizes}
              placeholder={placeholder}
              blurDataURL={defaultBlurDataURL}
              quality={quality}
              onLoad={handleLoad}
              onError={handleError}
              style={{
                objectFit: 'cover',
                width: '100%',
                height: 'auto',
              }}
            />
            
            {/* Loading overlay */}
            {!isLoaded && (
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: isLoaded ? 0 : 1 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-gray-200 flex items-center justify-center"
              >
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Generate a blur placeholder data URL
 */
function generateBlurDataURL(width: number, height: number, color = '#f3f4f6'): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
    </svg>
  `;
  
  if (typeof Buffer !== 'undefined') {
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  } else {
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
}