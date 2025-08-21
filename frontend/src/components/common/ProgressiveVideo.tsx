/**
 * Progressive video loading component with adaptive quality and lazy loading
 * Implements requirement 2.3 for optimized media loading
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LazyLoadObserver } from '../../lib/performanceOptimization';
import { PlayIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';

interface VideoSource {
  src: string;
  type: string;
  quality?: string; // '720p', '1080p', etc.
}

interface ProgressiveVideoProps {
  sources: VideoSource[];
  poster?: string;
  width?: number;
  height?: number;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
}

export default function ProgressiveVideo({
  sources,
  poster,
  width,
  height,
  className = '',
  autoPlay = false,
  muted = true,
  loop = false,
  controls = true,
  priority = false,
  onLoad,
  onError,
  onPlay,
  onPause,
}: ProgressiveVideoProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<LazyLoadObserver | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Detect connection quality and select appropriate video source
  const getOptimalSource = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      const effectiveType = connection?.effectiveType;
      
      // Select video quality based on connection
      if (effectiveType === '4g' || effectiveType === 'wifi') {
        return sources.find(s => s.quality === '1080p') || sources[0];
      } else if (effectiveType === '3g') {
        return sources.find(s => s.quality === '720p') || sources[0];
      } else {
        return sources.find(s => s.quality === '480p') || sources[0];
      }
    }
    
    // Default to first source if connection API not available
    return sources[0];
  }, [sources]);

  useEffect(() => {
    if (priority || isInView) return;

    // Set up intersection observer for lazy loading
    observerRef.current = new LazyLoadObserver({
      rootMargin: '100px',
      threshold: 0.1,
    });

    if (containerRef.current) {
      observerRef.current.observe(containerRef.current, () => {
        setIsInView(true);
      });
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [priority, isInView]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      setIsLoaded(true);
      setDuration(video.duration);
      onLoad?.();
    };

    const handleError = () => {
      setHasError(true);
      onError?.();
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPause?.();
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [isInView, onLoad, onError, onPlay, onPause]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const optimalSource = getOptimalSource();

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-black ${className}`}
      style={{ aspectRatio: width && height ? `${width}/${height}` : '16/9' }}
      onMouseEnter={() => controls && showControlsTemporarily()}
      onMouseMove={() => controls && showControlsTemporarily()}
      onMouseLeave={() => controls && setShowControls(false)}
    >
      <AnimatePresence mode="wait">
        {!isInView && !priority ? (
          // Placeholder while not in view
          <motion.div
            key="placeholder"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full bg-gray-900 flex items-center justify-center"
          >
            <div className="text-center text-white">
              <PlayIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-sm opacity-75">Video will load when in view</p>
            </div>
          </motion.div>
        ) : hasError ? (
          // Error state
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full h-full bg-gray-900 flex items-center justify-center text-white"
          >
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-sm opacity-75">Video failed to load</p>
            </div>
          </motion.div>
        ) : (
          // Video player
          <motion.div
            key="video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative w-full h-full"
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay={autoPlay}
              muted={isMuted}
              loop={loop}
              playsInline
              preload="metadata"
              poster={poster}
            >
              <source src={optimalSource.src} type={optimalSource.type} />
              {sources.map((source, index) => (
                <source key={index} src={source.src} type={source.type} />
              ))}
              Your browser does not support the video tag.
            </video>

            {/* Loading overlay */}
            {!isLoaded && (
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ delay: 1, duration: 0.3 }}
                className="absolute inset-0 bg-gray-900 flex items-center justify-center"
              >
                <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </motion.div>
            )}

            {/* Custom controls */}
            {controls && (
              <AnimatePresence>
                {showControls && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex flex-col justify-end p-4"
                  >
                    {/* Progress bar */}
                    <div
                      className="w-full h-2 bg-white/20 rounded-full mb-4 cursor-pointer"
                      onClick={handleSeek}
                    >
                      <div
                        className="h-full bg-white rounded-full transition-all duration-200"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>

                    {/* Control buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={togglePlay}
                          className="text-white hover:text-gray-300 transition-colors"
                        >
                          {isPlaying ? (
                            <PauseIcon className="w-8 h-8" />
                          ) : (
                            <PlayIcon className="w-8 h-8" />
                          )}
                        </button>

                        <button
                          onClick={toggleMute}
                          className="text-white hover:text-gray-300 transition-colors"
                        >
                          {isMuted ? (
                            <SpeakerXMarkIcon className="w-6 h-6" />
                          ) : (
                            <SpeakerWaveIcon className="w-6 h-6" />
                          )}
                        </button>

                        <span className="text-white text-sm">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>

                      {optimalSource.quality && (
                        <span className="text-white/75 text-sm">
                          {optimalSource.quality}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}