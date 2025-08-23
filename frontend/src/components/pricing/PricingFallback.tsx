'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface PricingFallbackProps {
  onRetry?: () => void;
  className?: string;
  showContactSupport?: boolean;
}

/**
 * PricingFallback Component for Error Scenarios
 * Requirement 4.2: Implement PricingFallback component for error scenarios
 * Requirement 4.3: Add loading states and error handling for pricing data
 */
export default function PricingFallback({
  onRetry,
  className = '',
  showContactSupport = true
}: PricingFallbackProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  // Fallback pricing data when database is unavailable
  const fallbackPlans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 999,
      currency: 'INR',
      billingCycle: 'monthly',
      features: [
        'Up to 100 emails per month',
        'Basic templates',
        'Email support',
        'Standard delivery'
      ],
      isPopular: false
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 2999,
      currency: 'INR',
      billingCycle: 'monthly',
      features: [
        'Up to 1,000 emails per month',
        'Premium templates',
        'Priority support',
        'Advanced analytics',
        'Custom branding'
      ],
      isPopular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 9999,
      currency: 'INR',
      billingCycle: 'monthly',
      features: [
        'Unlimited emails',
        'Custom templates',
        '24/7 phone support',
        'Advanced analytics',
        'White-label solution',
        'API access'
      ],
      isPopular: false
    }
  ];

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleRetry = async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Error Notice */}
      <div className="text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-amber-800 mb-2">
            Pricing Service Temporarily Unavailable
          </h3>
          <p className="text-amber-700 text-sm mb-4">
            We're experiencing technical difficulties loading current pricing. 
            The plans below show our standard rates, but please contact us for the most up-to-date pricing.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {onRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRetrying ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Retrying...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again
                  </>
                )}
              </button>
            )}
            
            {showContactSupport && (
              <a
                href="mailto:support@prebox.io"
                className="inline-flex items-center px-4 py-2 bg-white text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Support
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Fallback Pricing Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {fallbackPlans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`bg-white rounded-lg shadow-lg p-6 relative ${
              plan.isPopular ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
            }`}
          >
            {/* Fallback Badge */}
            <div className="absolute top-2 right-2">
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium">
                Fallback
              </span>
            </div>

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
              {plan.name}
            </h3>

            {/* Price */}
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-gray-900">
                {formatPrice(plan.price, plan.currency)}
              </div>
              <div className="text-gray-600 text-sm">
                per month
              </div>
              <div className="text-xs text-gray-500 mt-1">
                *Indicative pricing
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-2 mb-6">
              {plan.features.map((feature, featureIndex) => (
                <li key={featureIndex} className="flex items-start text-sm">
                  <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-600">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Action Button */}
            <button
              className="w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-not-allowed"
              disabled
            >
              Contact for Pricing
            </button>
          </motion.div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="text-center">
        <div className="inline-flex items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
          <svg className="w-4 h-4 text-gray-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span className="text-sm text-gray-600">
            Fallback pricing shown. Contact support for current rates.
          </span>
        </div>
      </div>
    </div>
  );
}