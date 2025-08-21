'use client';

import { useState, useEffect } from 'react';
import { adminPricingApi, PricingPlan } from '../../lib/pricingApi';

interface PricingPlanFormProps {
  plan?: PricingPlan | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (plan: PricingPlan) => void;
  mode: 'create' | 'edit';
}

interface FormData {
  planId: string;
  planName: string;
  description: string;
  priceInr: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  tier: string;
  isPopular: boolean;
  isActive: boolean;
  features: string[];
  limits: {
    dailyEmailLimit: number;
    monthlyRecipientLimit: number;
    monthlyEmailLimit: number;
    templateLimit: number;
    customDomainLimit: number;
    hasLogoCustomization: boolean;
    hasCustomDomains: boolean;
    hasAdvancedAnalytics: boolean;
  };
}

/**
 * Pricing Plan Form Component
 * Requirement 4.3: Implement pricing update functionality with validation
 */
export default function PricingPlanForm({
  plan,
  isOpen,
  onClose,
  onSave,
  mode
}: PricingPlanFormProps) {
  const [formData, setFormData] = useState<FormData>({
    planId: '',
    planName: '',
    description: '',
    priceInr: 0,
    currency: 'INR',
    billingCycle: 'monthly',
    tier: 'free',
    isPopular: false,
    isActive: true,
    features: [''],
    limits: {
      dailyEmailLimit: 100,
      monthlyRecipientLimit: 300,
      monthlyEmailLimit: 2000,
      templateLimit: 1,
      customDomainLimit: 0,
      hasLogoCustomization: false,
      hasCustomDomains: false,
      hasAdvancedAnalytics: false
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize form data when plan changes
  useEffect(() => {
    if (plan && mode === 'edit') {
      setFormData({
        planId: plan.id,
        planName: plan.name,
        description: plan.description,
        priceInr: plan.priceInr,
        currency: plan.currency,
        billingCycle: plan.billingCycle,
        tier: plan.tier,
        isPopular: plan.isPopular,
        isActive: plan.isActive,
        features: plan.features.length > 0 ? plan.features : [''],
        limits: plan.limits
      });
    } else if (mode === 'create') {
      // Reset form for create mode
      setFormData({
        planId: '',
        planName: '',
        description: '',
        priceInr: 0,
        currency: 'INR',
        billingCycle: 'monthly',
        tier: 'free',
        isPopular: false,
        isActive: true,
        features: [''],
        limits: {
          dailyEmailLimit: 100,
          monthlyRecipientLimit: 300,
          monthlyEmailLimit: 2000,
          templateLimit: 1,
          customDomainLimit: 0,
          hasLogoCustomization: false,
          hasCustomDomains: false,
          hasAdvancedAnalytics: false
        }
      });
    }
  }, [plan, mode]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.planId.trim()) {
      errors.planId = 'Plan ID is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.planId)) {
      errors.planId = 'Plan ID must contain only lowercase letters, numbers, and hyphens';
    }

    if (!formData.planName.trim()) {
      errors.planName = 'Plan name is required';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }

    if (formData.priceInr < 0) {
      errors.priceInr = 'Price cannot be negative';
    }

    if (formData.limits.dailyEmailLimit < 0) {
      errors.dailyEmailLimit = 'Daily email limit cannot be negative';
    }

    if (formData.limits.monthlyEmailLimit < 0) {
      errors.monthlyEmailLimit = 'Monthly email limit cannot be negative';
    }

    if (formData.limits.monthlyRecipientLimit < 0) {
      errors.monthlyRecipientLimit = 'Monthly recipient limit cannot be negative';
    }

    if (formData.limits.templateLimit < -1) {
      errors.templateLimit = 'Template limit cannot be less than -1 (use -1 for unlimited)';
    }

    if (formData.limits.customDomainLimit < -1) {
      errors.customDomainLimit = 'Custom domain limit cannot be less than -1 (use -1 for unlimited)';
    }

    const validFeatures = formData.features.filter(f => f.trim());
    if (validFeatures.length === 0) {
      errors.features = 'At least one feature is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Filter out empty features
      const validFeatures = formData.features.filter(f => f.trim());

      const planData = {
        planId: formData.planId,
        planName: formData.planName,
        priceAmount: formData.priceInr,
        currency: formData.currency,
        billingCycle: formData.billingCycle,
        features: validFeatures,
        limits: formData.limits,
        isPopular: formData.isPopular,
        description: formData.description
      };

      const savedPlan = await adminPricingApi.createOrUpdatePricingPlan(planData);
      onSave(savedPlan);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing plan');
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  const addFeature = () => {
    setFormData({ ...formData, features: [...formData.features, ''] });
  };

  const removeFeature = (index: number) => {
    if (formData.features.length > 1) {
      const newFeatures = formData.features.filter((_, i) => i !== index);
      setFormData({ ...formData, features: newFeatures });
    }
  };

  const handleLimitChange = (field: keyof typeof formData.limits, value: number | boolean) => {
    setFormData({
      ...formData,
      limits: {
        ...formData.limits,
        [field]: value
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Create New Pricing Plan' : `Edit ${plan?.name}`}
          </h2>
          <p className="text-gray-600 mt-1">
            {mode === 'create' 
              ? 'Configure a new subscription plan with pricing and limits'
              : 'Update the pricing plan configuration'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800 font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plan ID *
              </label>
              <input
                type="text"
                value={formData.planId}
                onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.planId ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., premium-tier"
                disabled={mode === 'edit'}
              />
              {validationErrors.planId && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.planId}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plan Name *
              </label>
              <input
                type="text"
                value={formData.planName}
                onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.planName ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., Premium Plan"
              />
              {validationErrors.planName && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.planName}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.description ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Describe the plan benefits and target audience"
            />
            {validationErrors.description && (
              <p className="text-red-600 text-sm mt-1">{validationErrors.description}</p>
            )}
          </div>

          {/* Pricing Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price (INR) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.priceInr}
                onChange={(e) => setFormData({ ...formData, priceInr: parseFloat(e.target.value) || 0 })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.priceInr ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {validationErrors.priceInr && (
                <p className="text-red-600 text-sm mt-1">{validationErrors.priceInr}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Billing Cycle
              </label>
              <select
                value={formData.billingCycle}
                onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value as 'monthly' | 'yearly' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {/* Plan Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tier
              </label>
              <select
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="free">Free</option>
                <option value="paid_standard">Paid Standard</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPopular"
                  checked={formData.isPopular}
                  onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isPopular" className="ml-2 block text-sm text-gray-700">
                  Mark as popular plan
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                  Plan is active
                </label>
              </div>
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Features *
            </label>
            <div className="space-y-2">
              {formData.features.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={feature}
                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter feature description"
                  />
                  {formData.features.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addFeature}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Feature</span>
              </button>
            </div>
            {validationErrors.features && (
              <p className="text-red-600 text-sm mt-1">{validationErrors.features}</p>
            )}
          </div>

          {/* Limits */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Limits</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Daily Email Limit
                </label>
                <input
                  type="number"
                  min="-1"
                  value={formData.limits.dailyEmailLimit}
                  onChange={(e) => handleLimitChange('dailyEmailLimit', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Use -1 for unlimited</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Email Limit
                </label>
                <input
                  type="number"
                  min="-1"
                  value={formData.limits.monthlyEmailLimit}
                  onChange={(e) => handleLimitChange('monthlyEmailLimit', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Use -1 for unlimited</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Recipient Limit
                </label>
                <input
                  type="number"
                  min="-1"
                  value={formData.limits.monthlyRecipientLimit}
                  onChange={(e) => handleLimitChange('monthlyRecipientLimit', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Use -1 for unlimited</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Limit
                </label>
                <input
                  type="number"
                  min="-1"
                  value={formData.limits.templateLimit}
                  onChange={(e) => handleLimitChange('templateLimit', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Use -1 for unlimited</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Domain Limit
                </label>
                <input
                  type="number"
                  min="-1"
                  value={formData.limits.customDomainLimit}
                  onChange={(e) => handleLimitChange('customDomainLimit', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Use -1 for unlimited</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="hasLogoCustomization"
                  checked={formData.limits.hasLogoCustomization}
                  onChange={(e) => handleLimitChange('hasLogoCustomization', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="hasLogoCustomization" className="ml-2 block text-sm text-gray-700">
                  Logo customization allowed
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="hasCustomDomains"
                  checked={formData.limits.hasCustomDomains}
                  onChange={(e) => handleLimitChange('hasCustomDomains', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="hasCustomDomains" className="ml-2 block text-sm text-gray-700">
                  Custom domains allowed
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="hasAdvancedAnalytics"
                  checked={formData.limits.hasAdvancedAnalytics}
                  onChange={(e) => handleLimitChange('hasAdvancedAnalytics', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="hasAdvancedAnalytics" className="ml-2 block text-sm text-gray-700">
                  Advanced analytics enabled
                </label>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{mode === 'create' ? 'Create Plan' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}