'use client';

import { useState, useEffect } from 'react';
import { adminPricingApi, PricingPlan } from '../../../lib/pricingApi';
import PricingPlanForm from '../../../components/pricing/PricingPlanForm';

interface PricingManagementPageProps {}

/**
 * Pricing Management Page for Admin Dashboard
 * Requirement 4.3: Build admin interface for pricing management
 * Requirement 4.5: Add audit logging for pricing changes
 */
export default function PricingManagementPage({}: PricingManagementPageProps) {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [serviceHealth, setServiceHealth] = useState<any>(null);

  // Load pricing plans on component mount
  useEffect(() => {
    loadPricingPlans();
    checkServiceHealth();
  }, []);

  const loadPricingPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const plansData = await adminPricingApi.getPricingPlans();
      setPlans(plansData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing plans');
    } finally {
      setLoading(false);
    }
  };

  const checkServiceHealth = async () => {
    try {
      const health = await adminPricingApi.checkServiceHealth();
      setServiceHealth(health);
    } catch (err) {
      console.error('Failed to check service health:', err);
    }
  };

  const handleRefreshCache = async () => {
    try {
      setRefreshingCache(true);
      const result = await adminPricingApi.refreshPricingCache();
      
      if (result.success) {
        alert('Pricing cache refreshed successfully');
        await loadPricingPlans();
      } else {
        alert(`Failed to refresh cache: ${result.error}`);
      }
    } catch (err) {
      alert('Failed to refresh cache');
    } finally {
      setRefreshingCache(false);
    }
  };

  const handleEditPlan = (plan: PricingPlan) => {
    setSelectedPlan(plan);
    setShowEditModal(true);
  };

  const handleSavePlan = (plan: PricingPlan) => {
    // Update the plans list
    setPlans(prevPlans => {
      const existingIndex = prevPlans.findIndex(p => p.id === plan.id);
      if (existingIndex >= 0) {
        // Update existing plan
        const newPlans = [...prevPlans];
        newPlans[existingIndex] = plan;
        return newPlans;
      } else {
        // Add new plan
        return [...prevPlans, plan];
      }
    });
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-600">Loading pricing plans...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
          <p className="text-gray-600 mt-1">Manage subscription plans and pricing validation</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefreshCache}
            disabled={refreshingCache}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {refreshingCache ? (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span>Refresh Cache</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Plan</span>
          </button>
        </div>
      </div>

      {/* Service Health Status */}
      {serviceHealth && (
        <div className={`p-4 rounded-lg border ${
          serviceHealth.status === 'healthy' 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              serviceHealth.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className={`font-medium ${
              serviceHealth.status === 'healthy' ? 'text-green-800' : 'text-red-800'
            }`}>
              Pricing Service: {serviceHealth.status}
            </span>
            {serviceHealth.planCount && (
              <span className="text-gray-600">
                • {serviceHealth.planCount} plans loaded
              </span>
            )}
            {serviceHealth.cacheStatus && (
              <span className="text-gray-600">
                • Cache: {serviceHealth.cacheStatus}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-800 font-medium">Error: {error}</span>
          </div>
          <button
            onClick={loadPricingPlans}
            className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
          >
            Retry loading plans
          </button>
        </div>
      )}

      {/* Pricing Plans Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Pricing Plans</h2>
          <p className="text-sm text-gray-600 mt-1">
            {plans.length} plan{plans.length !== 1 ? 's' : ''} configured
          </p>
        </div>

        {plans.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pricing plans</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new pricing plan.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Plan
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Features
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center">
                            {plan.name}
                            {plan.isPopular && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Popular
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{plan.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatPrice(plan.priceInr, plan.currency)}
                      </div>
                      <div className="text-sm text-gray-500">
                        per {plan.billingCycle}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        plan.tier === 'free' 
                          ? 'bg-gray-100 text-gray-800'
                          : plan.tier === 'paid_standard'
                          ? 'bg-blue-100 text-blue-800'
                          : plan.tier === 'premium'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {plan.tier.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        plan.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {plan.features.slice(0, 2).map((feature, index) => (
                          <div key={index} className="truncate max-w-xs">
                            • {feature}
                          </div>
                        ))}
                        {plan.features.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{plan.features.length - 2} more
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(plan.updatedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEditPlan(plan)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Implement plan validation
                            console.log('Validate plan:', plan.id);
                          }}
                          className="text-green-600 hover:text-green-900"
                        >
                          Validate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Plans</p>
              <p className="text-2xl font-semibold text-gray-900">{plans.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Plans</p>
              <p className="text-2xl font-semibold text-gray-900">
                {plans.filter(p => p.isActive).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Popular Plans</p>
              <p className="text-2xl font-semibold text-gray-900">
                {plans.filter(p => p.isPopular).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg. Price</p>
              <p className="text-2xl font-semibold text-gray-900">
                {plans.length > 0 
                  ? formatPrice(
                      plans.reduce((sum, p) => sum + p.priceInr, 0) / plans.length,
                      'INR'
                    )
                  : '₹0'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Plan Modal */}
      <PricingPlanForm
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleSavePlan}
        mode="create"
      />

      {/* Edit Plan Modal */}
      <PricingPlanForm
        plan={selectedPlan}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPlan(null);
        }}
        onSave={handleSavePlan}
        mode="edit"
      />
    </div>
  );
}