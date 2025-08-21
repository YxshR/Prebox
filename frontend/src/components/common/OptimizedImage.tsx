/**
 * Optimized Image component with progressive loading and caching
 * Implements requirement 2.3 for optimized media loading
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { LazyLoadObserver, mediaOptimization } from '../../lib/performanceOptimization';
import { cacheManager } from '../../lib/caching';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  lazy?: boolean;
  fadeInDuration?: number;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  sizes,
  quality = 85,
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError,
  lazy = true,
  fadeInDuration = 0.3,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy || priority);
  const [hasError, setHasError] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<LazyLoadObserver | null>(null);

  // Generate blur placeholder if not provided
  const defaultBlurDataURL = blurDataURL || 
    (width && height ? mediaOptimization.generateBlurDataURL(width, height) : undefined);

  // Generate responsive sizes if not provided
  const responsiveSizes = sizes || mediaOptimization.generateSizes({
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  });

  useEffect(() => {
    if (lazy && !priority && imageRef.current) {
      observerRef.current = new LazyLoadObserver({
        rootMargin: '50px',
        threshold: 0.1,
      });

      observerRef.current.observe(imageRef.current, () => {
        setIsInView(true);
      });

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    }
  }, [lazy, priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Preload image in cache for better performance
  useEffect(() => {
    if (isInView && src) {
      cacheManager.mediaCache.get(src).catch(() => {
        // Silently handle cache errors
      });
    }
  }, [isInView, src]);

  return (
    <div ref={imageRef} className={`relative overflow-hidden ${className}`}>
      <AnimatePresence mode="wait">
        {hasError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center bg-gray-100 text-gray-400 w-full h-full min-h-[200px]"
          >
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm">Image failed to load</p>
            </div>
          </motion.div>
        ) : isInView ? (
          <motion.div
            key="image"
            initial={{ opacity: 0 }}
            animate={{ opacity: isLoaded ? 1 : 0.7 }}
            transition={{ duration: fadeInDuration }}
            className="relative"
          >
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
              priority={priority}
              quality={quality}
              sizes={responsiveSizes}
              placeholder={placeholder}
              blurDataURL={defaultBlurDataURL}
              onLoad={handleLoad}
              onError={handleError}
              className="w-full h-full object-cover"
              style={{
                willChange: 'transform, opacity',
              }}
            />
            
            {/* Loading overlay */}
            <AnimatePresence>
              {!isLoaded && (
                <motion.div
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: fadeInDuration }}
                  className="absolute inset-0 bg-gray-100 flex items-center justify-center"
                >
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gray-100 w-full h-full min-h-[200px] flex items-center justify-center"
          >
            <div className="text-gray-400">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Optimized Image Gallery component with lazy loading
 */
interface ImageGalleryProps {
  images: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }>;
  className?: string;
  columns?: number;
  gap?: number;
}

export function OptimizedImageGallery({
  images,
  className = '',
  columns = 3,
  gap = 4,
}: ImageGalleryProps) {
  return (
    <div
      className={`grid gap-${gap} ${className}`}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {images.map((image, index) => (
        <OptimizedImage
          key={`${image.src}-${index}`}
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          className="aspect-square"
          priority={index < 3} // Prioritize first 3 images
          lazy={index >= 3}
        />
      ))}
    </div>
  );
}

/**
 * Hero Image component with optimized loading
 */
interface HeroImageProps {
  src: string;
  alt: string;
  className?: string;
  overlay?: boolean;
  overlayColor?: string;
  children?: React.ReactNode;
}

export function OptimizedHeroImage({
  src,
  alt,
  className = '',
  overlay = false,
  overlayColor = 'bg-black/30',
  children,
}: HeroImageProps) {
  return (
    <div className={`relative ${className}`}>
      <OptimizedImage
        src={src}
        alt={alt}
        priority={true}
        lazy={false}
        className="w-full h-full"
        sizes="100vw"
        quality={90}
      />
      
      {overlay && (
        <div className={`absolute inset-0 ${overlayColor}`} />
      )}
      
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}