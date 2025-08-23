'use client';

import { useState } from 'react';
import { PricingContainer, PricingDisplay, PricingFallback } from './index';

/**
 * Example component demonstrating usage of pricing components
 * Shows different integration patterns with authentication state
 */
export default function PricingExample() {
  const [selectedPlan, setSelectedPlan] = useState<{
    planId: string;
    amount: number;
  } | null>(null);

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [componentType, setComponentType] = useState<'container' | 'display' | 'fallback'>('container');

  const handlePlanSelect = (planId: string, amount: number) => {
    setSelectedPlan({ planId, amount });
    console.log('Plan selected:', { planId, amount });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Pricing Components Demo
        </h1>
        <p className="text-gray-600 mb-8">
          Demonstration of pricing components with database integration and authentication state
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Component Controls</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Component Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Component Type
            </label>
            <select
              value={componentType}
              onChange={(e) => setComponentType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="container">PricingContainer (Recommended)</option>
              <option value="display">PricingDisplay</option>
              <option value="fallback">PricingFallback</option>
            </select>
          </div>

          {/* Billing Cycle Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Billing Cycle
            </label>
            <select
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={componentType === 'fallback'}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Selected Plan Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selected Plan
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm">
              {selectedPlan ? (
                <span className="text-green-600">
                  {selectedPlan.planId} - ₹{selectedPlan.amount}
                </span>
              ) : (
                <span className="text-gray-500">None selected</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Component Display */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">
          {componentType === 'container' && 'PricingContainer Component'}
          {componentType === 'display' && 'PricingDisplay Component'}
          {componentType === 'fallback' && 'PricingFallback Component'}
        </h2>

        {componentType === 'container' && (
          <PricingContainer
            onPlanSelect={handlePlanSelect}
            billingCycle={billingCycle}
            showComparison={true}
            autoRetry={true}
            maxRetries={3}
          />
        )}

        {componentType === 'display' && (
          <PricingDisplay
            onPlanSelect={handlePlanSelect}
            billingCycle={billingCycle}
            showComparison={true}
            showFallbackOnError={true}
          />
        )}

        {componentType === 'fallback' && (
          <PricingFallback
            onRetry={() => console.log('Retry clicked')}
            showContactSupport={true}
          />
        )}
      </div>

      {/* Integration Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          Integration Notes
        </h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <strong>PricingContainer:</strong> Recommended for most use cases. 
            Includes automatic retry logic, health checking, and fallback handling.
          </p>
          <p>
            <strong>PricingDisplay:</strong> Core pricing display with database integration 
            and authentication state awareness.
          </p>
          <p>
            <strong>PricingFallback:</strong> Error state component shown when 
            database is unavailable or pricing service fails.
          </p>
          <p>
            <strong>Authentication Integration:</strong> Components automatically detect 
            user authentication state and adjust behavior accordingly.
          </p>
        </div>
      </div>

      {/* Usage Examples */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Usage Examples</h3>
        
        <div className="space-y-4">
          <div className="bg-gray-50 rounded p-4">
            <h4 className="font-medium mb-2">Basic Usage (Recommended)</h4>
            <pre className="text-sm text-gray-700 overflow-x-auto">
{`import { PricingContainer } from '@/components/pricing';

<PricingContainer
  onPlanSelect={(planId, amount) => {
    // Handle plan selection
    console.log('Selected:', planId, amount);
  }}
  billingCycle="monthly"
  autoRetry={true}
  maxRetries={3}
/>`}
            </pre>
          </div>

          <div className="bg-gray-50 rounded p-4">
            <h4 className="font-medium mb-2">Advanced Usage with Custom Error Handling</h4>
            <pre className="text-sm text-gray-700 overflow-x-auto">
{`import { PricingDisplay, PricingFallback } from '@/components/pricing';

// Custom error handling
const [showFallback, setShowFallback] = useState(false);

{showFallback ? (
  <PricingFallback 
    onRetry={() => setShowFallback(false)}
    showContactSupport={true}
  />
) : (
  <PricingDisplay
    onPlanSelect={handlePlanSelect}
    showFallbackOnError={false}
  />
)}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}