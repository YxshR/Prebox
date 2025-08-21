'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { PricingTier } from '../../types/pricing';
import { usePricing } from '../../hooks/usePricing';

interface PricingDisplayProps {
  onPlanSelect?: (planId: string, amount: number) => void;
  showComparison?: boolean;
  billingCycle?: 'monthly' | 'yearly';
  className?: string;
}

/**
 * Simple Pricing Display Component with Server-Side Validation
 * Requirement 4.1: Display server-validated pricing information
 * Requirement 4.4: Add loading states and error handling for pricing data
 */
export default function PricingDisplay({
  onPlanSelect,
  showComparison = false,
  billingCycle = 'monthly',
  className = ''
}: PricingDisplayProps) {
  const { 
    plans, 
    isLoading, 
    error, 
    refreshPricing,
    validatePurchase 
  } = usePricing();

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [validating, setValidating] = useState<string | null>(null);

  // Filter plans by billing cycle
  const filteredPlans = plans
    .filter(plan => plan.billingCycle === billingCycle)
    .sort((a, b) => a.priceAmount - b.priceAmount);

  const handlePlanSelect = async (plan: PricingTier) => {
    try {
      setValidating(plan.planId);
      setSelectedPlan(plan.planId);

      // Validate purchase with server
      const validation = await validatePurchase(
        plan.planId,
        plan.priceAmount,
        plan.currency
      );

      if (!validation.isValid) {
        console.error('Purchase validation failed:', validation.error);
        setSelectedPlan(null);
        return;
      }

      onPlanSelect?.(plan.planId, validation.validatedAmount || plan.priceAmount);
    } catch (error) {
      console.error('Plan selection error:', error);
      setSelectedPlan(null);
    } finally {
      setValidating(null);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center">
          <div className="inline-flex items-center px-4 py-2 bg-blue-50 rounded-lg">
            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-blue-800 text-sm font-medium">Loading pricing...</span>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded mb-4"></div>
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-3 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <div className="text-red-600 mb-2">⚠️ Pricing Unavailable</div>
          <p className="text-red-700 text-sm mb-4">{error}</p>
          <button
            onClick={refreshPricing}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (filteredPlans.length === 0) {
    return (
      <div className={`text-center ${className}`}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-w-md mx-auto">
          <div className="text-gray-600 mb-2">No pricing plans available</div>
          <p className="text-gray-500 text-sm">Please check back later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Pricing Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {filteredPlans.map((plan) => (
          <motion.div
            key={plan.planId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className={`bg-white rounded-lg shadow-lg p-6 cursor-pointer transition-all duration-200 ${
              plan.isPopular ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
            } ${
              selectedPlan === plan.planId ? 'ring-2 ring-green-500' : ''
            }`}
            onClick={() => handlePlanSelect(plan)}
          >
            {/* Popular Badge */}
            {plan.isPopular && (
              <div className="text-center mb-4">
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                  Most Popular
                </span>
              </div>
            )}

            {/* Plan Name */}
            <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
              {plan.planName}
            </h3>

            {/* Price */}
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-gray-900">
                {formatPrice(plan.priceAmount, plan.currency)}
              </div>
              <div className="text-gray-600 text-sm">
                per {billingCycle === 'monthly' ? 'month' : 'year'}
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-2 mb-6">
              {plan.features.slice(0, 4).map((feature, index) => (
                <li key={index} className="flex items-start text-sm">
                  <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-600">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Action Button */}
            <button
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                validating === plan.planId
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : plan.isPopular
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : selectedPlan === plan.planId
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
              disabled={validating === plan.planId}
            >
              {validating === plan.planId ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Validating...
                </span>
              ) : selectedPlan === plan.planId ? (
                'Selected'
              ) : (
                'Choose Plan'
              )}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Security Notice */}
      <div className="text-center">
        <div className="inline-flex items-center bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm text-green-800 font-medium">
            Server-validated pricing
          </span>
        </div>
      </div>
    </div>
  );
}