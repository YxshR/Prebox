'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PricingTier, PricingComparison as PricingComparisonType } from '../../types/pricing';

interface PricingComparisonProps {
  plans: PricingTier[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * PricingComparison Component
 * Interactive tier comparison functionality with detailed feature breakdown
 * Requirements: 1.3 - Interactive tier comparison functionality
 */
export default function PricingComparison({ plans, isOpen, onClose }: PricingComparisonProps) {
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);

  // Generate comparison data from plans
  const generateComparisonData = (): PricingComparisonType[] => {
    const allFeatures = new Set<string>();
    
    // Collect all unique features
    plans.forEach(plan => {
      plan.features.forEach(feature => allFeatures.add(feature));
    });

    // Create comparison rows
    return Array.from(allFeatures).map(feature => {
      const comparison: PricingComparisonType = {
        feature,
        free: false,
        standard: false,
        premium: false,
        enterprise: false
      };

      plans.forEach(plan => {
        const hasFeature = plan.features.includes(feature);
        const planType = plan.planName.toLowerCase();
        
        if (planType.includes('free')) {
          comparison.free = hasFeature;
        } else if (planType.includes('standard')) {
          comparison.standard = hasFeature;
        } else if (planType.includes('premium')) {
          comparison.premium = hasFeature;
        } else if (planType.includes('enterprise')) {
          comparison.enterprise = hasFeature;
        }
      });

      return comparison;
    });
  };

  const comparisonData = generateComparisonData();

  const togglePlanSelection = (planId: string) => {
    setSelectedPlans(prev => 
      prev.includes(planId) 
        ? prev.filter(id => id !== planId)
        : [...prev, planId]
    );
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Compare Plans</h2>
                  <p className="text-blue-100">Choose the perfect plan for your needs</p>
                </div>
                <button
                  onClick={onClose}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-auto max-h-[calc(90vh-120px)]">
              {/* Plan Selection */}
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select plans to compare:</h3>
                <div className="flex flex-wrap gap-3">
                  {plans.map(plan => (
                    <motion.button
                      key={plan.planId}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => togglePlanSelection(plan.planId)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        selectedPlans.includes(plan.planId)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-sm font-medium">{plan.planName}</div>
                      <div className="text-xs text-gray-500">
                        {formatPrice(plan.priceAmount, plan.currency)}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Comparison Table */}
              {selectedPlans.length > 0 && (
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-900">
                            Features
                          </th>
                          {plans
                            .filter(plan => selectedPlans.includes(plan.planId))
                            .map(plan => (
                              <th key={plan.planId} className="text-center py-3 px-4">
                                <div className="font-semibold text-gray-900">{plan.planName}</div>
                                <div className="text-sm text-gray-500">
                                  {formatPrice(plan.priceAmount, plan.currency)}
                                </div>
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.map((row, index) => (
                          <motion.tr
                            key={row.feature}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="py-3 px-4 text-gray-900">{row.feature}</td>
                            {plans
                              .filter(plan => selectedPlans.includes(plan.planId))
                              .map(plan => {
                                const planType = plan.planName.toLowerCase();
                                let hasFeature = false;
                                
                                if (planType.includes('free')) {
                                  hasFeature = row.free as boolean;
                                } else if (planType.includes('standard')) {
                                  hasFeature = row.standard as boolean;
                                } else if (planType.includes('premium')) {
                                  hasFeature = row.premium as boolean;
                                } else if (planType.includes('enterprise')) {
                                  hasFeature = row.enterprise as boolean;
                                }

                                return (
                                  <td key={plan.planId} className="py-3 px-4 text-center">
                                    {hasFeature ? (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: index * 0.05 + 0.1 }}
                                        className="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded-full"
                                      >
                                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </motion.div>
                                    ) : (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: index * 0.05 + 0.1 }}
                                        className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full"
                                      >
                                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                      </motion.div>
                                    )}
                                  </td>
                                );
                              })}
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedPlans.length === 0 && (
                <div className="p-12 text-center">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select Plans to Compare</h3>
                  <p className="text-gray-600">Choose two or more plans above to see a detailed feature comparison.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  All prices are in Indian Rupees (INR) and exclude applicable taxes.
                </div>
                <button
                  onClick={onClose}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close Comparison
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}