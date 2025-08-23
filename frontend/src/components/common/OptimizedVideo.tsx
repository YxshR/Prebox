/**
 * Optimized Video component with progressive loading and performance optimization
 * Implements requirement 2.3 for optimized media loading
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LazyLoadObserver, mediaOptimization } from '../../lib/performanceOptimization';
import { PlayIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';

interface OptimizedVideoProps {
  src: string;
  poster?: string;
  width?: number;
  height?: number;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  lazy?: boolean;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
}

export default function OptimizedVideo({
  src,
  poster,
  width,
  height,
  className = '',
  autoPlay = false,
  muted = true,
  loop = false,
  controls = false,
  lazy = true,
  priority = false,
  onLoad,
  onError,
  onPlay,
  onPause,
}: OptimizedVideoProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy || priority);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<LazyLoadObserver | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (lazy && !priority && containerRef.current) {
      observerRef.current = new LazyLoadObserver({
        rootMargin: '100px',
        threshold: 0.1,
      });

      observerRef.current.observe(containerRef.current, () => {
        setIsInView(true);
      });

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    }
  }, [lazy, priority]);

  const handleLoadedData = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    onPlay?.();
  }, [onPlay]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    onPause?.();
  }, [onPause]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {
          // Handle play promise rejection
        });
      }
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const handleMouseMove = useCallback(() => {
    if (!controls) return;
    showControlsTemporarily();
  }, [controls, showControlsTemporarily]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-gray-900 ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => controls && setShowControls(true)}
      onMouseLeave={() => controls && setShowControls(false)}
    >
      <AnimatePresence mode="wait">
        {hasError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center bg-gray-800 text-gray-400 w-full h-full min-h-[300px]"
          >
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p className="text-lg font-medium">Video failed to load</p>
              <p className="text-sm text-gray-500 mt-1">Please check your connection and try again</p>
            </div>
          </motion.div>
        ) : isInView ? (
          <motion.div
            key="video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="relative w-full h-full"
          >
            <video
              ref={videoRef}
              {...mediaOptimization.videoSettings}
              width={width}
              height={height}
              poster={poster}
              autoPlay={autoPlay}
              loop={loop}
              muted={muted}
              playsInline
              preload="metadata"
              onLoadedData={handleLoadedData}
              onError={handleError}
              onPlay={handlePlay}
              onPause={handlePause}
              className="w-full h-full object-cover"
              style={{
                willChange: 'transform, opacity',
              }}
            >
              <source src={src} type="video/mp4" />
              Your browser does not support the video tag.
            </video>

            {/* Loading overlay */}
            <AnimatePresence>
              {!isLoaded && (
                <motion.div
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-gray-800 flex items-center justify-center"
                >
                  <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-sm">Loading video...</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom controls */}
            {controls && (
              <AnimatePresence>
                {showControls && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"
                  >
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={togglePlay}
                          className="p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                        >
                          {isPlaying ? (
                            <PauseIcon className="w-6 h-6" />
                          ) : (
                            <PlayIcon className="w-6 h-6" />
                          )}
                        </button>
                        
                        <button
                          onClick={toggleMute}
                          className="p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                        >
                          {isMuted ? (
                            <SpeakerXMarkIcon className="w-6 h-6" />
                          ) : (
                            <SpeakerWaveIcon className="w-6 h-6" />
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Play button overlay for non-autoplay videos */}
            {!autoPlay && !isPlaying && isLoaded && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/30 text-white hover:bg-black/40 transition-colors"
              >
                <div className="p-4 rounded-full bg-white/20 backdrop-blur-sm">
                  <PlayIcon className="w-12 h-12" />
                </div>
              </motion.button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gray-800 w-full h-full min-h-[300px] flex items-center justify-center"
          >
            <div className="text-center text-gray-400">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm">Video will load when in view</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Video Background component for hero sections
 */
interface VideoBackgroundProps {
  src: string;
  poster?: string;
  className?: string;
  overlay?: boolean;
  overlayColor?: string;
  children?: React.ReactNode;
}

export function OptimizedVideoBackground({
  src,
  poster,
  className = '',
  overlay = true,
  overlayColor = 'bg-black/40',
  children,
}: VideoBackgroundProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <OptimizedVideo
        src={src}
        poster={poster}
        autoPlay={true}
        muted={true}
        loop={true}
        controls={false}
        priority={true}
        lazy={false}
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {overlay && (
        <div className={`absolute inset-0 ${overlayColor}`} />
      )}
      
      {children && (
        <div className="relative z-10">
          {children}
        </div>
      )}
    </div>
  );
}