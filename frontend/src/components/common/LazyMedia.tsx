'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';

interface LazyMediaProps {
  src: string;
  alt: string;
  type?: 'image' | 'video';
  className?: string;
  priority?: boolean;
  sizes?: string;
  placeholder?: string;
  fallbackSrc?: string;
  quality?: number;
  retryAttempts?: number;
  showProgressiveLoading?: boolean;
  onLoad?: () => void;
  onError?: (error: any) => void;
}

export default function LazyMedia({
  src,
  alt,
  type = 'image',
  className = '',
  priority = false,
  sizes,
  placeholder,
  fallbackSrc,
  quality = 75,
  retryAttempts = 3,
  showProgressiveLoading = true,
  onLoad,
  onError
}: LazyMediaProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const { status } = useConnectionStatus();

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px'
      }
    );

    if (elementRef.current && !priority) {
      observer.observe(elementRef.current);
    } else if (priority) {
      setIsInView(true);
    }

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    setLoadingProgress(100);
    onLoad?.();
  };

  const handleError = (error?: any) => {
    console.error('Media loading error:', error);
    
    // Try fallback source first
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setRetryCount(0);
      return;
    }
    
    // Retry with original source if we have attempts left
    if (retryCount < retryAttempts) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setCurrentSrc(src + `?retry=${retryCount + 1}`); // Cache busting
      }, Math.pow(2, retryCount) * 1000); // Exponential backoff
      return;
    }
    
    // All attempts failed
    setHasError(true);
    onError?.(error);
  };

  // Simulate progressive loading for better UX
  useEffect(() => {
    if (isInView && !isLoaded && !hasError && showProgressiveLoading) {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          const increment = Math.random() * 15 + 5; // Random increment between 5-20%
          const newProgress = Math.min(prev + increment, 85); // Cap at 85% until actual load
          return newProgress;
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [isInView, isLoaded, hasError, showProgressiveLoading]);

  const shimmerVariants = {
    animate: {
      x: ['-100%', '100%'],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear'
      }
    }
  };

  return (
    <div ref={elementRef} className={`relative overflow-hidden ${className}`}>
      {/* Loading Placeholder */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
          <div className="relative w-full h-full overflow-hidden">
            {/* Shimmer Effect */}
            <motion.div
              variants={shimmerVariants}
              animate="animate"
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
            />
            
            {/* Progressive Loading Bar */}
            {showProgressiveLoading && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-300">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${loadingProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
            
            {/* Placeholder Content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-300 rounded-lg flex items-center justify-center">
                  {type === 'video' ? (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  ) : (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                  )}
                </div>
                <p className="text-sm font-medium">
                  {retryCount > 0 ? `Retrying... (${retryCount}/${retryAttempts})` : 'Loading...'}
                </p>
                {showProgressiveLoading && (
                  <p className="text-xs text-slate-500 mt-1">
                    {Math.round(loadingProgress)}%
                  </p>
                )}
                {!status.isOnline && (
                  <p className="text-xs text-orange-500 mt-2">
                    Offline - will load when connected
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
          <div className="text-center text-red-400">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-200 rounded-lg flex items-center justify-center">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
            </div>
            <p className="text-sm font-medium">Failed to load</p>
            <p className="text-xs text-red-500 mt-1">
              {!status.isOnline ? 'Check your connection' : 'Media unavailable'}
            </p>
            {retryAttempts > 0 && (
              <button
                onClick={() => {
                  setHasError(false);
                  setRetryCount(0);
                  setCurrentSrc(src);
                }}
                className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actual Media */}
      {isInView && !hasError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full h-full"
        >
          {type === 'image' ? (
            <Image
              src={currentSrc}
              alt={alt}
              fill
              className="object-cover"
              priority={priority}
              quality={quality}
              sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px'}
              onLoad={handleLoad}
              onError={handleError}
              placeholder={placeholder ? 'blur' : 'empty'}
              blurDataURL={placeholder}
            />
          ) : (
            <video
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              onLoadedData={handleLoad}
              onError={handleError}
            >
              <source src={currentSrc} type="video/mp4" />
              {fallbackSrc && currentSrc !== fallbackSrc && (
                <source src={fallbackSrc} type="video/mp4" />
              )}
            </video>
          )}
        </motion.div>
      )}
    </div>
  );
}
/**
 * 
Progressive image component with multiple quality levels
 */
interface ProgressiveImageProps {
  src: string;
  alt: string;
  lowQualitySrc?: string;
  mediumQualitySrc?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  onLoad?: () => void;
  onError?: (error: any) => void;
}

export function ProgressiveImage({
  src,
  alt,
  lowQualitySrc,
  mediumQualitySrc,
  className = '',
  sizes,
  priority = false,
  onLoad,
  onError
}: ProgressiveImageProps) {
  const [currentQuality, setCurrentQuality] = useState<'low' | 'medium' | 'high'>('low');
  const [loadedQualities, setLoadedQualities] = useState<Set<string>>(new Set());
  const { status } = useConnectionStatus();

  // Determine which quality to show based on connection and loaded images
  useEffect(() => {
    if (!status.isOnline) return;

    const connectionSpeed = (navigator as any).connection?.effectiveType;
    
    if (connectionSpeed === 'slow-2g' || connectionSpeed === '2g') {
      // Slow connection - stick with low quality
      if (lowQualitySrc && !loadedQualities.has('low')) {
        setCurrentQuality('low');
      }
    } else if (connectionSpeed === '3g') {
      // Medium connection - load medium quality
      if (mediumQualitySrc && !loadedQualities.has('medium')) {
        setCurrentQuality('medium');
      }
    } else {
      // Fast connection - load high quality
      if (!loadedQualities.has('high')) {
        setCurrentQuality('high');
      }
    }
  }, [status.isOnline, lowQualitySrc, mediumQualitySrc, loadedQualities]);

  const getCurrentSrc = () => {
    switch (currentQuality) {
      case 'low':
        return lowQualitySrc || src;
      case 'medium':
        return mediumQualitySrc || src;
      case 'high':
      default:
        return src;
    }
  };

  const handleImageLoad = () => {
    setLoadedQualities(prev => new Set(prev).add(currentQuality));
    
    // Automatically upgrade to next quality level if available
    if (currentQuality === 'low' && mediumQualitySrc) {
      setTimeout(() => setCurrentQuality('medium'), 100);
    } else if (currentQuality === 'medium') {
      setTimeout(() => setCurrentQuality('high'), 100);
    }
    
    onLoad?.();
  };

  return (
    <div className={`relative ${className}`}>
      <LazyMedia
        src={getCurrentSrc()}
        alt={alt}
        type="image"
        priority={priority}
        sizes={sizes}
        onLoad={handleImageLoad}
        onError={onError}
        showProgressiveLoading={true}
        className="w-full h-full"
      />
      
      {/* Quality indicator */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
          {currentQuality.toUpperCase()}
        </div>
      )}
    </div>
  );
}

/**
 * Smart image component that adapts to connection quality
 */
interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  adaptToConnection?: boolean;
  onLoad?: () => void;
  onError?: (error: any) => void;
}

export function SmartImage({
  src,
  alt,
  className = '',
  sizes,
  priority = false,
  adaptToConnection = true,
  onLoad,
  onError
}: SmartImageProps) {
  const { status } = useConnectionStatus();
  const [quality, setQuality] = useState(75);

  // Adapt quality based on connection
  useEffect(() => {
    if (!adaptToConnection || !status.isOnline) return;

    const connectionSpeed = (navigator as any).connection?.effectiveType;
    
    switch (connectionSpeed) {
      case 'slow-2g':
      case '2g':
        setQuality(30);
        break;
      case '3g':
        setQuality(50);
        break;
      case '4g':
      default:
        setQuality(75);
        break;
    }
  }, [status.isOnline, adaptToConnection]);

  // Generate quality-specific URLs (assuming your backend supports quality parameters)
  const getQualityUrl = (baseUrl: string, targetQuality: number) => {
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.set('q', targetQuality.toString());
    return url.toString();
  };

  return (
    <LazyMedia
      src={getQualityUrl(src, quality)}
      alt={alt}
      type="image"
      priority={priority}
      sizes={sizes}
      quality={quality}
      fallbackSrc={src} // Original as fallback
      onLoad={onLoad}
      onError={onError}
      showProgressiveLoading={true}
      className={className}
    />
  );
}

/**
 * Placeholder component for when images fail to load
 */
interface ImagePlaceholderProps {
  alt: string;
  className?: string;
  icon?: 'image' | 'video' | 'document' | 'user';
  message?: string;
}

export function ImagePlaceholder({
  alt,
  className = '',
  icon = 'image',
  message
}: ImagePlaceholderProps) {
  const getIcon = () => {
    switch (icon) {
      case 'video':
        return (
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        );
      case 'document':
        return (
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
        );
      case 'user':
        return (
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
        );
    }
  };

  return (
    <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
      <div className="text-center text-gray-400">
        <div className="w-16 h-16 mx-auto mb-2 bg-gray-200 rounded-lg flex items-center justify-center">
          {getIcon()}
        </div>
        <p className="text-sm font-medium">{message || alt || 'Image unavailable'}</p>
      </div>
    </div>
  );
}