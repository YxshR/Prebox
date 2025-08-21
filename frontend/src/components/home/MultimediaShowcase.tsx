'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import Image from 'next/image';
import { 
  PlayIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  EyeIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import PremiumVideoPlayer from './PremiumVideoPlayer';
import { useResponsiveMedia, useTouchGestures } from '../../hooks/useResponsiveMedia';

interface FeatureWithMedia {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
  imageUrl: string;
  demoUrl?: string;
  category: 'templates' | 'analytics' | 'automation' | 'security' | 'integration';
  highlights: string[];
}

interface MultimediaShowcaseProps {
  features?: FeatureWithMedia[];
  onFeatureSelect?: (featureId: string) => void;
  className?: string;
}

const defaultFeatures: FeatureWithMedia[] = [
  {
    id: 'ai-templates',
    title: 'AI-Powered Email Templates',
    description: 'Create stunning, conversion-optimized emails in seconds with our advanced AI template generator.',
    imageUrl: '/images/features/ai-templates-showcase.svg',
    videoUrl: '/videos/ai-templates-demo.mp4',
    demoUrl: '/demo/templates',
    category: 'templates',
    highlights: ['50+ Template Styles', 'AI Content Generation', 'Brand Customization', 'Mobile Responsive']
  },
  {
    id: 'real-time-analytics',
    title: 'Real-Time Analytics Dashboard',
    description: 'Track opens, clicks, conversions, and engagement with comprehensive real-time analytics.',
    imageUrl: '/images/features/analytics-dashboard.svg',
    videoUrl: '/videos/analytics-demo.mp4',
    demoUrl: '/demo/analytics',
    category: 'analytics',
    highlights: ['Live Metrics', 'Conversion Tracking', 'A/B Testing', 'Custom Reports']
  },
  {
    id: 'bulk-automation',
    title: 'Smart Bulk Email Automation',
    description: 'Send thousands of personalized emails with intelligent scheduling and delivery optimization.',
    imageUrl: '/images/features/bulk-automation.svg',
    videoUrl: '/videos/automation-demo.mp4',
    demoUrl: '/demo/automation',
    category: 'automation',
    highlights: ['Smart Scheduling', 'Personalization', 'Delivery Optimization', 'Queue Management']
  },
  {
    id: 'custom-domains',
    title: 'Custom Domain Management',
    description: 'Build trust and improve deliverability with custom domains and advanced DNS configuration.',
    imageUrl: '/images/features/custom-domains.svg',
    videoUrl: '/videos/domains-demo.mp4',
    demoUrl: '/demo/domains',
    category: 'integration',
    highlights: ['Domain Verification', 'DNS Setup', 'SSL Certificates', 'Deliverability Boost']
  },
  {
    id: 'enterprise-security',
    title: 'Enterprise-Grade Security',
    description: 'Protect your data and ensure compliance with advanced security features and monitoring.',
    imageUrl: '/images/features/security-features.svg',
    videoUrl: '/videos/security-demo.mp4',
    demoUrl: '/demo/security',
    category: 'security',
    highlights: ['End-to-End Encryption', 'GDPR Compliance', 'Audit Logs', '2FA Authentication']
  }
];

export default function MultimediaShowcase({ 
  features = defaultFeatures, 
  onFeatureSelect,
  className = '' 
}: MultimediaShowcaseProps) {
  const [activeFeature, setActiveFeature] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  
  // Responsive media hook for mobile optimization
  const {
    isMobile,
    isTablet,
    shouldAutoPlay
  } = useResponsiveMedia({
    autoPlayOnMobile: false,
    enableTouchGestures: true
  });

  // Touch gestures for mobile navigation
  const touchGestures = useTouchGestures(
    () => nextFeature(), // onSwipeLeft
    () => prevFeature(), // onSwipeRight
  );

  // Auto-rotate features (disabled on mobile for better UX)
  useEffect(() => {
    if (!isInView || !shouldAutoPlay()) return;
    
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, isMobile ? 10000 : 8000); // Longer interval on mobile

    return () => clearInterval(interval);
  }, [isInView, features.length, shouldAutoPlay, isMobile]);

  const handleFeatureSelect = (index: number) => {
    setActiveFeature(index);
    onFeatureSelect?.(features[index].id);
  };

  const handleImageLoad = (featureId: string) => {
    setLoadedImages(prev => new Set([...prev, featureId]));
  };

  const handleImageError = (featureId: string) => {
    setImageErrors(prev => new Set([...prev, featureId]));
  };

  const openVideoPlayer = (videoUrl: string) => {
    setSelectedMedia(videoUrl);
    setIsVideoPlayerOpen(true);
  };

  const closeVideoPlayer = () => {
    setIsVideoPlayerOpen(false);
    setSelectedMedia(null);
  };

  const nextFeature = () => {
    setActiveFeature((prev) => (prev + 1) % features.length);
  };

  const prevFeature = () => {
    setActiveFeature((prev) => (prev - 1 + features.length) % features.length);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      templates: 'from-purple-500 to-pink-500',
      analytics: 'from-blue-500 to-cyan-500',
      automation: 'from-green-500 to-emerald-500',
      security: 'from-red-500 to-orange-500',
      integration: 'from-indigo-500 to-purple-500'
    };
    return colors[category as keyof typeof colors] || 'from-gray-500 to-gray-600';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  const mediaVariants = {
    enter: {
      opacity: 0,
      scale: 0.9,
      rotateY: 10,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    },
    center: {
      opacity: 1,
      scale: 1,
      rotateY: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    },
    exit: {
      opacity: 0,
      scale: 1.1,
      rotateY: -10,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  return (
    <section 
      ref={containerRef}
      className={`py-20 bg-gradient-to-br from-slate-50 to-white ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {/* Section Header */}
          <motion.div variants={itemVariants} className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="flex items-center justify-center gap-2 mb-4"
            >
              <SparklesIcon className="w-6 h-6 text-purple-600" />
              <span className="text-purple-600 font-semibold text-sm uppercase tracking-wider">
                Platform Features
              </span>
              <SparklesIcon className="w-6 h-6 text-purple-600" />
            </motion.div>
            
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              <motion.span 
                className="block"
                initial={{ opacity: 0, x: -30 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                Experience the
              </motion.span>
              <motion.span 
                className="block bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent"
                initial={{ opacity: 0, x: 30 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                Future of Email
              </motion.span>
            </h2>
            
            <motion.p 
              className="text-xl text-gray-600 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              Discover powerful features designed to transform your email marketing campaigns 
              with cutting-edge technology and intuitive design.
            </motion.p>
          </motion.div>

          {/* Main Showcase */}
          <div className={`grid gap-8 items-center ${
            isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-1 lg:grid-cols-2' : 'lg:grid-cols-2'
          } ${isMobile ? 'gap-8' : 'gap-12'}`}>
            {/* Feature Navigation */}
            <motion.div 
              variants={itemVariants} 
              className={`space-y-4 ${isMobile ? 'order-2' : ''}`}
            >
              {features.map((feature, index) => (
                <motion.div
                  key={feature.id}
                  className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-300 ${
                    index === activeFeature
                      ? 'bg-white shadow-xl border-2 border-purple-200'
                      : 'bg-white/50 hover:bg-white hover:shadow-lg border border-gray-200'
                  }`}
                  onClick={() => handleFeatureSelect(index)}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Category Badge */}
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${getCategoryColor(feature.category)} mb-3`}>
                    {feature.category.charAt(0).toUpperCase() + feature.category.slice(1)}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Feature Highlights */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {feature.highlights.map((highlight, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    {feature.videoUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openVideoPlayer(feature.videoUrl!);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                      >
                        <PlayIcon className="w-4 h-4" />
                        Watch Demo
                      </button>
                    )}
                    
                    {feature.demoUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(feature.demoUrl, '_blank');
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium"
                      >
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        Try Live Demo
                      </button>
                    )}
                  </div>

                  {/* Active Indicator */}
                  {index === activeFeature && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-pink-500 rounded-r-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.div>
              ))}

              {/* Navigation Controls */}
              <div className="flex justify-center gap-4 mt-8">
                <motion.button
                  onClick={prevFeature}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-3 bg-white rounded-full shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
                </motion.button>
                
                <motion.button
                  onClick={nextFeature}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-3 bg-white rounded-full shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200"
                >
                  <ChevronRightIcon className="w-5 h-5 text-gray-600" />
                </motion.button>
              </div>
            </motion.div>

            {/* Media Display */}
            <motion.div 
              variants={itemVariants} 
              className={`relative ${isMobile ? 'order-1' : ''}`}
              {...(isMobile ? touchGestures : {})}
            >
              <div className={`relative aspect-video overflow-hidden shadow-2xl bg-gradient-to-br from-gray-100 to-gray-200 ${
                isMobile ? 'rounded-2xl' : 'rounded-3xl'
              }`}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeFeature}
                    variants={mediaVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="absolute inset-0"
                  >
                    {!imageErrors.has(features[activeFeature].id) ? (
                      <div className="relative w-full h-full">
                        {!loadedImages.has(features[activeFeature].id) && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full"
                            />
                          </div>
                        )}
                        
                        <Image
                          src={features[activeFeature].imageUrl}
                          alt={features[activeFeature].title}
                          fill
                          className="object-cover transition-all duration-500"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                          priority={activeFeature === 0}
                          onLoad={() => handleImageLoad(features[activeFeature].id)}
                          onError={() => handleImageError(features[activeFeature].id)}
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                        <div className="text-center text-purple-600">
                          <div className="w-20 h-20 mx-auto mb-4 bg-purple-200 rounded-full flex items-center justify-center">
                            <EyeIcon className="w-10 h-10" />
                          </div>
                          <p className="text-xl font-semibold">{features[activeFeature].title}</p>
                          <p className="text-sm opacity-75 mt-2">Feature Preview</p>
                        </div>
                      </div>
                    )}

                    {/* Media Overlay Controls */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-6 left-6 right-6">
                        <div className="flex items-center justify-between">
                          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                            <p className="text-white font-semibold">
                              {features[activeFeature].title}
                            </p>
                          </div>
                          
                          {features[activeFeature].videoUrl && (
                            <motion.button
                              onClick={() => openVideoPlayer(features[activeFeature].videoUrl!)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              className="bg-white/20 backdrop-blur-sm rounded-full p-3 text-white hover:bg-white/30 transition-all duration-200"
                            >
                              <PlayIcon className="w-6 h-6" />
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Feature Progress Indicators */}
                <div className="absolute top-6 left-6">
                  <div className="flex gap-2">
                    {features.map((_, index) => (
                      <motion.div
                        key={index}
                        className={`h-1 rounded-full transition-all duration-300 ${
                          index === activeFeature 
                            ? 'bg-white w-8' 
                            : 'bg-white/40 w-4 hover:bg-white/60'
                        }`}
                        onClick={() => handleFeatureSelect(index)}
                      />
                    ))}
                  </div>
                </div>

                {/* Decorative Elements */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 1.2, duration: 1 }}
                  className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-xl opacity-60"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 1.5, duration: 1 }}
                  className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full blur-2xl opacity-50"
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Video Player Modal */}
      <AnimatePresence>
        {isVideoPlayerOpen && selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeVideoPlayer}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full max-w-4xl aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              <PremiumVideoPlayer
                src={selectedMedia}
                title={features[activeFeature].title}
                description={features[activeFeature].description}
                onClose={closeVideoPlayer}
                autoPlay={true}
                className="w-full h-full"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}