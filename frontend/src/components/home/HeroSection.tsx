'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { PlayIcon, PauseIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface HeroSectionProps {
  onSignupClick: () => void;
}

export default function HeroSection({ onSignupClick }: HeroSectionProps) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isIntersecting, setIsIntersecting] = useState(false);
  
  const heroRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0.8]);
  
  // Media assets for showcase
  const mediaAssets = [
    {
      type: 'image' as const,
      src: '/images/hero-platform-showcase.svg',
      alt: 'Perbox Platform Dashboard - Complete Email Marketing Interface',
      title: 'Complete Dashboard Overview'
    },
    {
      type: 'image' as const,
      src: '/images/hero-dashboard-preview.svg',
      alt: 'Email Campaign Management Interface',
      title: 'Campaign Management'
    },
    {
      type: 'video' as const,
      src: '/images/hero-video.svg',
      alt: 'Platform Demo Video',
      title: 'Interactive Demo'
    }
  ];

  // Intersection Observer for performance
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Auto-rotate media showcase
  useEffect(() => {
    if (!isIntersecting) return;
    
    const interval = setInterval(() => {
      setCurrentMediaIndex((prev) => (prev + 1) % mediaAssets.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isIntersecting, mediaAssets.length]);

  // Animation variants
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
        duration: 0.8,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  const gradientVariants = {
    animate: {
      background: [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      ],
      transition: {
        duration: 12,
        repeat: Infinity,
        ease: 'linear'
      }
    }
  };

  const mediaTransitionVariants = {
    enter: {
      opacity: 0,
      scale: 1.1,
      rotateY: 15,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    },
    center: {
      opacity: 1,
      scale: 1,
      rotateY: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      rotateY: -15,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  const floatingVariants = {
    animate: {
      y: [-10, 10, -10],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  };

  return (
    <section ref={heroRef} className="relative min-h-screen overflow-hidden">
      {/* Animated Background Gradient */}
      <motion.div
        className="absolute inset-0 opacity-90"
        variants={gradientVariants}
        animate="animate"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          y,
          opacity
        }}
      />

      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          variants={floatingVariants}
          animate="animate"
          className="absolute top-20 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl"
        />
        <motion.div
          variants={floatingVariants}
          animate="animate"
          className="absolute top-40 right-20 w-32 h-32 bg-white/5 rounded-full blur-2xl"
          style={{ animationDelay: '1s' }}
        />
        <motion.div
          variants={floatingVariants}
          animate="animate"
          className="absolute bottom-20 left-1/4 w-16 h-16 bg-white/15 rounded-full blur-lg"
          style={{ animationDelay: '2s' }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center"
        >
          {/* Hero Headline */}
          <motion.div variants={itemVariants} className="mb-8 px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="flex items-center justify-center gap-2 mb-4"
            >
              <SparklesIcon className="w-6 h-6 text-yellow-300" />
              <span className="text-yellow-300 font-medium text-sm uppercase tracking-wider">
                Premium Email Platform
              </span>
              <SparklesIcon className="w-6 h-6 text-yellow-300" />
            </motion.div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-white mb-6 leading-tight">
              <motion.span 
                className="block"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
              >
                Transform Your
              </motion.span>
              <motion.span 
                className="block bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
              >
                Email Marketing
              </motion.span>
            </h1>
            
            <motion.p 
              className="text-lg sm:text-xl md:text-2xl text-white/90 max-w-4xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8 }}
            >
              Experience the future of bulk email marketing with AI-powered templates, 
              advanced analytics, and enterprise-grade security. Join thousands of businesses 
              already transforming their communication.
            </motion.p>
          </motion.div>

          {/* Premium Hero Media Section */}
          <motion.div variants={itemVariants} className="mb-12 px-4">
            <div className="relative max-w-6xl mx-auto">
              {/* Main Media Container */}
              <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl bg-black/20 backdrop-blur-sm border border-white/20">
                {!isVideoLoaded && !imageError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="rounded-full h-12 w-12 border-b-2 border-white"
                    />
                  </div>
                )}
                
                {/* Dynamic Media Showcase */}
                <div className="relative w-full h-full">
                  {mediaAssets.map((asset, index) => (
                    <motion.div
                      key={`${asset.src}-${index}`}
                      className="absolute inset-0"
                      variants={mediaTransitionVariants}
                      initial="enter"
                      animate={index === currentMediaIndex ? "center" : "exit"}
                      style={{ 
                        zIndex: index === currentMediaIndex ? 2 : 1,
                        perspective: '1000px'
                      }}
                    >
                      {!imageError ? (
                        <Image
                          src={asset.src}
                          alt={asset.alt}
                          fill
                          className="object-cover transition-all duration-700"
                          priority={index === 0}
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1400px"
                          onLoad={() => setIsVideoLoaded(true)}
                          onError={() => {
                            setImageError(true);
                            setIsVideoLoaded(true);
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                          <div className="text-center text-white">
                            <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
                              <PlayIcon className="w-10 h-10" />
                            </div>
                            <p className="text-xl font-medium">Platform Demo</p>
                            <p className="text-sm opacity-75">Experience the future of email marketing</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Interactive Play Overlay */}
                {isVideoLoaded && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                    <button
                      onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                      className="absolute inset-0 flex items-center justify-center group"
                    >
                      <motion.div 
                        className="bg-white/20 backdrop-blur-sm rounded-full p-8 group-hover:bg-white/30 transition-all duration-300"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {isVideoPlaying ? (
                          <PauseIcon className="w-10 h-10 text-white" />
                        ) : (
                          <PlayIcon className="w-10 h-10 text-white ml-1" />
                        )}
                      </motion.div>
                    </button>
                  </div>
                )}

                {/* Media Navigation Dots */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
                  <div className="flex gap-2">
                    {mediaAssets.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentMediaIndex(index)}
                        className={`w-3 h-3 rounded-full transition-all duration-300 ${
                          index === currentMediaIndex 
                            ? 'bg-white scale-125' 
                            : 'bg-white/40 hover:bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Current Media Title */}
                <div className="absolute top-6 left-6">
                  <motion.div
                    key={currentMediaIndex}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2"
                  >
                    <p className="text-white font-medium text-sm">
                      {mediaAssets[currentMediaIndex]?.title}
                    </p>
                  </motion.div>
                </div>

                {/* Enhanced Feature Highlights */}
                <div className="absolute bottom-16 left-4 right-4">
                  <div className="flex flex-wrap gap-3 justify-center">
                    {[
                      { icon: '🤖', text: 'AI Templates' },
                      { icon: '📊', text: 'Real-time Analytics' },
                      { icon: '📧', text: 'Bulk Sending' },
                      { icon: '🌐', text: 'Custom Domains' },
                      { icon: '🔒', text: 'Enterprise Security' }
                    ].map((feature, index) => (
                      <motion.div
                        key={feature.text}
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 2 + index * 0.1 }}
                        className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm text-white border border-white/30 hover:bg-white/30 transition-all duration-300"
                      >
                        <span className="text-base">{feature.icon}</span>
                        <span className="font-medium">{feature.text}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Enhanced Decorative Elements */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.5, duration: 1 }}
                className="absolute -top-6 -left-6 w-32 h-32 bg-gradient-to-br from-yellow-400 to-pink-400 rounded-full blur-2xl opacity-60"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.8, duration: 1 }}
                className="absolute -bottom-6 -right-6 w-40 h-40 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full blur-2xl opacity-60"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 2.1, duration: 1 }}
                className="absolute top-1/2 -right-8 w-24 h-24 bg-gradient-to-br from-green-400 to-cyan-400 rounded-full blur-xl opacity-50"
              />
            </div>
          </motion.div>

          {/* Enhanced Call to Action */}
          <motion.div variants={itemVariants} className="mb-16 px-4">
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <motion.button
                onClick={onSignupClick}
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                className="group relative px-10 py-5 bg-white text-purple-600 font-bold rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 overflow-hidden min-w-[220px] text-lg"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                />
                <span className="relative z-10 flex items-center justify-center gap-3 group-hover:text-white transition-colors duration-300">
                  <SparklesIcon className="w-5 h-5" />
                  Start Free Trial
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-xl"
                  >
                    →
                  </motion.span>
                </span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                className="group px-10 py-5 border-2 border-white/40 text-white font-bold rounded-2xl backdrop-blur-sm hover:bg-white/15 hover:border-white/60 transition-all duration-300 min-w-[220px] flex items-center justify-center gap-3 text-lg"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <PlayIcon className="w-6 h-6" />
                </motion.div>
                Watch Demo
              </motion.button>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.5 }}
              className="mt-6 text-center"
            >
              <p className="text-white/80 text-base font-medium mb-2">
                🚀 No credit card required • ⚡ 14-day free trial • ✨ Cancel anytime
              </p>
              <div className="flex items-center justify-center gap-4 text-white/60 text-sm">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  10,000+ Active Users
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                  99.9% Uptime
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                  24/7 Support
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div variants={itemVariants}>
            <p className="text-white/60 text-sm mb-6">Trusted by 10,000+ businesses worldwide</p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              {/* Placeholder for company logos */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-24 h-12 bg-white/20 rounded-lg flex items-center justify-center"
                >
                  <span className="text-white/60 text-xs">Logo {i}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3, duration: 1 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center"
        >
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1 h-3 bg-white/60 rounded-full mt-2"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}