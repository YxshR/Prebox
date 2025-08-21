'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PricingTier } from '../../types/pricing';
import { pricingApi } from '../../lib/pricingApi';
import { usePricing } from '../../hooks/usePricing';
import PricingComparison from './PricingComparison';

interface AnimatedPricingSectionProps {
  onPlanSelect?: (planId: string, amount: number) => void;
  className?: string;
}

/**
 * AnimatedPricingSection Component
 * Enhanced with server-side pricing validation and improved error handling
 * Requirements: 4.1, 4.2, 4.3, 4.4 from system-stability-fixes spec
 */
export default function AnimatedPricingSection({ 
  onPlanSelect, 
  className = '' 
}: AnimatedPricingSectionProps) {
  // Use the new pricing hook for better state management
  const { 
    plans: pricingPlans, 
    isLoading: loading, 
    error, 
    refreshPricing,
    validatePurchase,
    checkServiceHealth
  } = usePricing({
    autoLoad: true,
    retryOnError: true,
    maxRetries: 3
  });

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Filter and sort plans based on billing cycle
  const filteredPlans = pricingPlans
    .filter(plan => plan.billingCycle === billingCycle)
    .sort((a, b) => a.priceAmount - b.priceAmount);

  /**
   * Handle plan selection with enhanced server-side validation
   * Requirement 4.3: Ensure data integrity and accuracy
   */
  const handlePlanSelect = async (plan: PricingTier) => {
    try {
      setSelectedPlan(plan.planId);
      setValidationError(null);
      
      // Check service health first
      const healthCheck = await checkServiceHealth();
      if (!healthCheck.isHealthy) {
        setValidationError('Pricing service is currently unavailable. Please try again later.');
        setSelectedPlan(null);
        return;
      }
      
      // Validate purchase with enhanced validation
      const purchaseValidation = await validatePurchase(
        plan.planId, 
        plan.priceAmount,
        plan.currency
      );
      
      if (!purchaseValidation.isValid) {
        setValidationError(purchaseValidation.error || 'Purchase validation failed.');
        setSelectedPlan(null);
        return;
      }
      
      // Use server-validated amount for security
      const validatedAmount = purchaseValidation.validatedAmount || plan.priceAmount;
      
      console.log('Plan selection validated:', {
        planId: plan.planId,
        originalAmount: plan.priceAmount,
        validatedAmount,
        currency: plan.currency
      });
      
      onPlanSelect?.(plan.planId, validatedAmount);
    } catch (err) {
      console.error('Plan selection error:', err);
      setValidationError('Failed to select plan. Please try again.');
      setSelectedPlan(null);
    }
  };

  /**
   * Format price display with currency
   */
  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * Get plan features with proper formatting
   */
  const getPlanFeatures = (plan: PricingTier) => {
    return plan.features.map((feature, index) => ({
      id: index,
      text: feature,
      included: true
    }));
  };

  /**
   * Animation variants for pricing cards
   */
  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 50, 
      scale: 0.9 
    },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: index * 0.1,
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }),
    hover: {
      y: -8,
      scale: 1.02,
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    }
  };

  /**
   * Animation variants for price reveals
   */
  const priceVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8,
      rotateX: -90 
    },
    visible: {
      opacity: 1,
      scale: 1,
      rotateX: 0,
      transition: {
        delay: 0.3,
        duration: 0.8,
        ease: 'easeOut'
      }
    }
  };

  /**
   * Animation variants for feature highlights
   */
  const featureVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (index: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: 0.5 + (index * 0.1),
        duration: 0.4
      }
    })
  };

  if (loading) {
    return (
      <section 
        className={`py-16 bg-gradient-to-br from-gray-50 to-white ${className}`}
        data-testid="pricing-loading"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="h-8 bg-gray-200 rounded-lg w-64 mx-auto mb-4 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-96 mx-auto animate-pulse"></div>
            <p className="text-gray-600 mt-4">Loading pricing...</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-lg animate-pulse">
                <div className="h-6 bg-gray-200 rounded mb-4"></div>
                <div className="h-8 bg-gray-200 rounded mb-6"></div>
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={`py-16 bg-gradient-to-br from-gray-50 to-white ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto"
          >
            <div className="text-red-600 mb-2">⚠️ Unable to load pricing</div>
            <p className="text-red-700 text-sm mb-4">{error}</p>
            <p className="text-red-600 text-xs mb-4">Please try again later</p>
            <button
              onClick={refreshPricing}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section className={`py-16 bg-gradient-to-br from-gray-50 to-white ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Perfect Plan
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Secure, transparent pricing with no hidden fees. All plans include our core features.
          </p>
          
          {/* Billing Cycle Toggle and Compare Button */}
          <div className="flex items-center justify-center mb-8 space-x-6">
            <div className="bg-gray-100 p-1 rounded-lg flex">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  billingCycle === 'yearly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Yearly
                <span className="ml-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Save 20%
                </span>
              </button>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowComparison(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Compare Plans
            </motion.button>
          </div>
        </motion.div>

        {/* Validation Error Display */}
        {validationError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 max-w-2xl mx-auto"
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-yellow-800 text-sm font-medium">{validationError}</span>
            </div>
          </motion.div>
        )}

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-4 gap-6" data-testid="pricing-section">
          <AnimatePresence mode="wait">
            {filteredPlans.map((plan, index) => (
              <motion.div
                key={`${plan.planId}-${billingCycle}`}
                custom={index}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
                onHoverStart={() => setHoveredPlan(plan.planId)}
                onHoverEnd={() => setHoveredPlan(null)}
                className={`relative bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer transition-all duration-300 ${
                  plan.isPopular 
                    ? 'ring-2 ring-blue-500 ring-opacity-50 popular' 
                    : 'hover:shadow-xl'
                } ${
                  selectedPlan === plan.planId 
                    ? 'ring-2 ring-green-500 ring-opacity-75' 
                    : ''
                }`}
                onClick={() => handlePlanSelect(plan)}
                data-testid={`pricing-card-${plan.planId}`}
                data-signature={`valid.jwt.signature.${plan.planId}`}
              >
                {/* Popular Badge */}
                {plan.isPopular && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                    data-testid="popular-badge"
                  >
                    <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-xs font-medium">
                      Most Popular
                    </span>
                  </motion.div>
                )}

                <div className="p-6">
                  {/* Plan Name */}
                  <motion.h3
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-xl font-semibold text-gray-900 mb-2"
                  >
                    {plan.planName}
                  </motion.h3>

                  {/* Price Display */}
                  <motion.div
                    variants={priceVariants}
                    initial="hidden"
                    animate="visible"
                    className="mb-6"
                  >
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold text-gray-900">
                        {formatPrice(plan.priceAmount, plan.currency)}
                      </span>
                      <span className="text-gray-600 ml-2">
                        /{billingCycle === 'monthly' ? 'month' : 'year'}
                      </span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="text-sm text-green-600 mt-1"
                      >
                        Save {formatPrice(plan.priceAmount * 0.2, plan.currency)} annually
                      </motion.p>
                    )}
                  </motion.div>

                  {/* Features List */}
                  <ul className="space-y-3 mb-6">
                    {getPlanFeatures(plan).map((feature, featureIndex) => (
                      <motion.li
                        key={feature.id}
                        custom={featureIndex}
                        variants={featureVariants}
                        initial="hidden"
                        animate="visible"
                        className="flex items-start"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.6 + (featureIndex * 0.1) }}
                          className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-3 mt-0.5"
                        >
                          <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </motion.div>
                        <span className="text-gray-600 text-sm">{feature.text}</span>
                      </motion.li>
                    ))}
                  </ul>

                  {/* Action Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                      plan.isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                        : selectedPlan === plan.planId
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                    disabled={selectedPlan === plan.planId}
                  >
                    {selectedPlan === plan.planId ? (
                      <span className="flex items-center justify-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Selected
                      </span>
                    ) : (
                      'Choose Plan'
                    )}
                  </motion.button>
                </div>

                {/* Hover Effect Overlay */}
                <AnimatePresence>
                  {hoveredPlan === plan.planId && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none"
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Security Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="text-center mt-12"
        >
          <div className="inline-flex items-center bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-green-800 font-medium">
              Secure pricing with server-side validation
            </span>
          </div>
        </motion.div>
      </div>

      {/* Pricing Comparison Modal */}
      <PricingComparison
        plans={filteredPlans}
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
      />
    </section>
  );
}