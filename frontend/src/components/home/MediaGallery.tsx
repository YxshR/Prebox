'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import Image from 'next/image';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  PlayIcon,
  XMarkIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { MediaGalleryProps } from '../../types/multimedia';

export default function MediaGallery({
  assets,
  onAssetSelect,
  autoPlay = false,
  showThumbnails = true,
  className = ''
}: MediaGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const galleryRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(galleryRef, { once: true, margin: "-50px" });

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay || !isInView || isLightboxOpen) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % assets.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoPlay, isInView, isLightboxOpen, assets.length]);

  // Touch handlers for mobile swipe
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextAsset();
    } else if (isRightSwipe) {
      prevAsset();
    }
  };

  const nextAsset = () => {
    setCurrentIndex((prev) => (prev + 1) % assets.length);
  };

  const prevAsset = () => {
    setCurrentIndex((prev) => (prev - 1 + assets.length) % assets.length);
  };

  const selectAsset = (index: number) => {
    setCurrentIndex(index);
    onAssetSelect?.(assets[index].id);
  };

  const openLightbox = () => {
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
  };

  const handleImageLoad = (assetId: string) => {
    setLoadedImages(prev => new Set([...prev, assetId]));
  };

  const handleImageError = (assetId: string) => {
    setImageErrors(prev => new Set([...prev, assetId]));
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9
    })
  };

  if (!assets || assets.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 bg-gray-100 rounded-2xl ${className}`}>
        <p className="text-gray-500">No media assets available</p>
      </div>
    );
  }

  return (
    <div ref={galleryRef} className={`relative ${className}`}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className="space-y-6"
      >
        {/* Main Gallery Display */}
        <motion.div variants={itemVariants} className="relative">
          <div 
            className="relative aspect-video rounded-2xl overflow-hidden shadow-xl bg-gray-100 cursor-pointer"
            onClick={openLightbox}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <AnimatePresence mode="wait" custom={1}>
              <motion.div
                key={currentIndex}
                custom={1}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                className="absolute inset-0"
              >
                {!imageErrors.has(assets[currentIndex].id) ? (
                  <div className="relative w-full h-full">
                    {!loadedImages.has(assets[currentIndex].id) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="w-8 h-8 border-2 border-gray-400 border-t-purple-600 rounded-full"
                        />
                      </div>
                    )}
                    
                    <Image
                      src={assets[currentIndex].src}
                      alt={assets[currentIndex].alt}
                      fill
                      className="object-cover transition-transform duration-300 hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1000px"
                      priority={currentIndex === 0}
                      onLoad={() => handleImageLoad(assets[currentIndex].id)}
                      onError={() => handleImageError(assets[currentIndex].id)}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                    <div className="text-center text-gray-600">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-400 rounded-full flex items-center justify-center">
                        <MagnifyingGlassIcon className="w-8 h-8" />
                      </div>
                      <p className="font-medium">{assets[currentIndex].title}</p>
                      <p className="text-sm opacity-75">Media Preview</p>
                    </div>
                  </div>
                )}

                {/* Media Type Indicator */}
                {assets[currentIndex].type === 'video' && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="bg-white/20 backdrop-blur-sm rounded-full p-4"
                    >
                      <PlayIcon className="w-8 h-8 text-white" />
                    </motion.div>
                  </div>
                )}

                {/* Zoom Indicator */}
                <div className="absolute top-4 right-4">
                  <div className="bg-black/20 backdrop-blur-sm rounded-full p-2">
                    <MagnifyingGlassIcon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Arrows */}
            {assets.length > 1 && (
              <>
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    prevAsset();
                  }}
                  whileHover={{ scale: 1.1, x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-sm rounded-full p-2 text-white hover:bg-white/30 transition-all duration-200"
                >
                  <ChevronLeftIcon className="w-6 h-6" />
                </motion.button>

                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    nextAsset();
                  }}
                  whileHover={{ scale: 1.1, x: 2 }}
                  whileTap={{ scale: 0.95 }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-sm rounded-full p-2 text-white hover:bg-white/30 transition-all duration-200"
                >
                  <ChevronRightIcon className="w-6 h-6" />
                </motion.button>
              </>
            )}

            {/* Asset Info Overlay */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3">
                <h3 className="text-white font-semibold text-lg">
                  {assets[currentIndex].title}
                </h3>
                {assets[currentIndex].duration && (
                  <p className="text-white/80 text-sm">
                    Duration: {Math.floor(assets[currentIndex].duration! / 60)}:
                    {(assets[currentIndex].duration! % 60).toString().padStart(2, '0')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Thumbnail Navigation */}
        {showThumbnails && assets.length > 1 && (
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {assets.map((asset, index) => (
                <motion.button
                  key={asset.id}
                  onClick={() => selectAsset(index)}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    index === currentIndex
                      ? 'border-purple-500 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Image
                    src={asset.thumbnail || asset.src}
                    alt={asset.alt}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                  
                  {asset.type === 'video' && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <PlayIcon className="w-4 h-4 text-white" />
                    </div>
                  )}

                  {index === currentIndex && (
                    <motion.div
                      layoutId="thumbnailIndicator"
                      className="absolute inset-0 border-2 border-purple-500 rounded-lg"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>

            {/* Progress Indicators */}
            <div className="flex justify-center gap-2">
              {assets.map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() => selectAsset(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex 
                      ? 'bg-purple-600 w-8' 
                      : 'bg-gray-300 w-2 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-6xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <motion.button
                onClick={closeLightbox}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="absolute -top-12 right-0 bg-white/20 backdrop-blur-sm rounded-full p-2 text-white hover:bg-white/30 transition-all duration-200 z-10"
              >
                <XMarkIcon className="w-6 h-6" />
              </motion.button>

              {/* Lightbox Image */}
              <div className="relative aspect-video rounded-2xl overflow-hidden">
                <Image
                  src={assets[currentIndex].src}
                  alt={assets[currentIndex].alt}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 90vw"
                  priority
                />
              </div>

              {/* Lightbox Navigation */}
              {assets.length > 1 && (
                <>
                  <motion.button
                    onClick={prevAsset}
                    whileHover={{ scale: 1.1, x: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-sm rounded-full p-3 text-white hover:bg-white/30 transition-all duration-200"
                  >
                    <ChevronLeftIcon className="w-8 h-8" />
                  </motion.button>

                  <motion.button
                    onClick={nextAsset}
                    whileHover={{ scale: 1.1, x: 2 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-sm rounded-full p-3 text-white hover:bg-white/30 transition-all duration-200"
                  >
                    <ChevronRightIcon className="w-8 h-8" />
                  </motion.button>
                </>
              )}

              {/* Lightbox Info */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black/60 backdrop-blur-sm rounded-lg p-4">
                  <h3 className="text-white font-bold text-xl mb-2">
                    {assets[currentIndex].title}
                  </h3>
                  <div className="flex items-center justify-between text-white/80 text-sm">
                    <span>
                      {currentIndex + 1} of {assets.length}
                    </span>
                    {assets[currentIndex].size && (
                      <span>
                        {assets[currentIndex].size!.width} × {assets[currentIndex].size!.height}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}