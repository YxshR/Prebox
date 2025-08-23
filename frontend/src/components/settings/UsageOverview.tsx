'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChartBarIcon,
    CreditCardIcon,
    CalendarIcon,
    ArrowUpIcon,
    CheckCircleIcon,
    ClockIcon,
    BanknotesIcon,
    DocumentTextIcon,
    ArrowTrendingUpIcon as TrendingUpIcon,
    ArrowTrendingDownIcon as TrendingDownIcon,
    ArrowPathIcon as RefreshIcon
} from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import ProgressRing, { AnimatedCounter } from '@/components/ui/ProgressRing';
import { settingsApi } from '@/lib/settingsApi';

interface UsageStats {
    currentPeriod: {
        emailsSent: number;
        recipientsReached: number;
        templatesCreated: number;
        apiCalls: number;
        dailyEmailsSent: number;
    };
    limits: {
        dailyEmails: number;
        monthlyEmails: number;
        monthlyRecipients: number;
        templatesPerDay: number;
        apiCallsPerHour: number;
    };
    percentageUsed: {
        emails: number;
        recipients: number;
        templates: number;
        apiCalls: number;
        dailyEmails: number;
    };
    resetDates: {
        dailyReset: string;
        monthlyReset: string;
    };
}

interface SubscriptionInfo {
    tier: string;
    tierName: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextBillingDate: string;
    amount: number;
    currency: string;
    rechargeBalance: number;
    limits: {
        dailyEmailLimit: number;
        monthlyEmailLimit: number;
        monthlyRecipientLimit: number;
        templateLimit: number;
        hasLogoCustomization: boolean;
        hasCustomDomains: boolean;
    };
}

interface BillingHistory {
    id: string;
    date: string;
    description: string;
    amount: number;
    status: 'paid' | 'pending' | 'failed';
    type: 'subscription' | 'recharge';
    currency: string;
    recipientsAdded?: number;
}

interface HistoricalData {
    date: string;
    emailsSent: number;
    recipientsReached: number;
    templatesCreated: number;
    apiCalls: number;
}

interface Analytics {
    totalSpent: number;
    totalEmails: number;
    totalRecipients: number;
    averageCostPerEmail: number;
    trends: {
        spendingTrend: number;
        emailTrend: number;
        recipientTrend: number;
    };
    topCategories: Array<{
        category: string;
        amount: number;
        percentage: number;
    }>;
}

interface RechargeInfo {
    standardRate: {
        recipients: number;
        cost: number;
    };
    minimumRecharge: number;
    description: string;
}

export default function UsageOverview() {
    const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
    const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
    const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
    const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [rechargeInfo, setRechargeInfo] = useState<RechargeInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
    const [selectedHistoryType, setSelectedHistoryType] = useState<'all' | 'subscription' | 'recharge'>('all');
    const [rechargeAmount, setRechargeAmount] = useState<string>('50');

    useEffect(() => {
        loadData();
    }, [selectedPeriod]);

    const loadData = async (refresh = false) => {
        try {
            if (refresh) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }

            const [subscriptionResponse, usageResponse, historyResponse, analyticsResponse] = await Promise.all([
                settingsApi.getSubscriptionInfo(),
                settingsApi.getUsageStats(selectedPeriod),
                settingsApi.getBillingHistory({ type: selectedHistoryType, limit: 20 }),
                settingsApi.getAnalytics(selectedPeriod)
            ]);

            if (subscriptionResponse.success) {
                setSubscriptionInfo(subscriptionResponse.data.subscription);
                setRechargeInfo(subscriptionResponse.data.rechargeInfo);
            }

            if (usageResponse.success) {
                setUsageStats(usageResponse.data.usage);
                setHistoricalData(usageResponse.data.historical || []);
            }

            if (historyResponse.success) {
                setBillingHistory(historyResponse.data.transactions || []);
            }

            if (analyticsResponse.success) {
                setAnalytics(analyticsResponse.data);
            }

        } catch (error) {
            console.error('Failed to load usage data:', error);
            // Fallback to mock data for demo
            loadMockData();
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const loadMockData = () => {
        setUsageStats({
            currentPeriod: {
                emailsSent: 8750,
                recipientsReached: 3200,
                templatesCreated: 15,
                apiCalls: 1250,
                dailyEmailsSent: 245
            },
            limits: {
                dailyEmails: 1000,
                monthlyEmails: 30000,
                monthlyRecipients: 5000,
                templatesPerDay: 10,
                apiCallsPerHour: 500
            },
            percentageUsed: {
                emails: 29.2,
                recipients: 64.0,
                templates: 50.0,
                apiCalls: 25.0,
                dailyEmails: 24.5
            },
            resetDates: {
                dailyReset: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                monthlyReset: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
            }
        });

        setSubscriptionInfo({
            tier: 'paid_standard',
            tierName: 'Paid Standard',
            status: 'active',
            currentPeriodStart: '2024-01-01',
            currentPeriodEnd: '2024-01-31',
            nextBillingDate: '2024-02-01',
            amount: 59,
            currency: 'inr',
            rechargeBalance: 125.50,
            limits: {
                dailyEmailLimit: 1000,
                monthlyEmailLimit: 30000,
                monthlyRecipientLimit: 5000,
                templateLimit: 10,
                hasLogoCustomization: true,
                hasCustomDomains: false
            }
        });

        setRechargeInfo({
            standardRate: { recipients: 500, cost: 10 },
            minimumRecharge: 10,
            description: 'All users get 500 recipients for ₹10. Available for both subscription and recharge users.'
        });

        setBillingHistory([
            {
                id: '1',
                date: '2024-01-01',
                description: 'Paid Standard - Monthly Subscription',
                amount: 59,
                status: 'paid',
                type: 'subscription',
                currency: 'inr'
            },
            {
                id: '2',
                date: '2023-12-15',
                description: 'Account Recharge - 2500 recipients',
                amount: 50,
                status: 'paid',
                type: 'recharge',
                currency: 'inr',
                recipientsAdded: 2500
            },
            {
                id: '3',
                date: '2023-12-01',
                description: 'Paid Standard - Monthly Subscription',
                amount: 59,
                status: 'paid',
                type: 'subscription',
                currency: 'inr'
            }
        ]);

        setAnalytics({
            totalSpent: 149,
            totalEmails: 25000,
            totalRecipients: 8500,
            averageCostPerEmail: 0.006,
            trends: {
                spendingTrend: 15.2,
                emailTrend: 8.7,
                recipientTrend: 12.3
            },
            topCategories: [
                { category: 'Subscription', amount: 59, percentage: 39.6 },
                { category: 'Recharge', amount: 90, percentage: 60.4 }
            ]
        });

        // Generate mock historical data
        const mockHistorical = [];
        const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            mockHistorical.push({
                date: date.toISOString().split('T')[0],
                emailsSent: Math.floor(Math.random() * 500) + 100,
                recipientsReached: Math.floor(Math.random() * 200) + 50,
                templatesCreated: Math.floor(Math.random() * 5),
                apiCalls: Math.floor(Math.random() * 100) + 20
            });
        }
        setHistoricalData(mockHistorical);
    };

    const getUsageColor = (percentage: number) => {
        if (percentage >= 90) return 'red';
        if (percentage >= 75) return 'yellow';
        return 'green';
    };

    const formatCurrency = (amount: number, currency: string = 'INR') => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency
        }).format(amount);
    };

    const handleRecharge = async () => {
        try {
            const amount = parseFloat(rechargeAmount);
            if (amount < 10) {
                alert('Minimum recharge amount is ₹10');
                return;
            }

            // In a real implementation, this would integrate with payment gateway
            const result = await settingsApi.processRecharge({
                amount,
                paymentMethodId: 'demo_payment_method',
                provider: 'stripe'
            });

            if (result.success) {
                alert(`Successfully recharged ₹${amount}! Added ${result.data.recipientsAdded} recipients.`);
                loadData(true); // Refresh data
            } else {
                alert('Recharge failed. Please try again.');
            }
        } catch (error) {
            console.error('Recharge error:', error);
            alert('Recharge failed. Please try again.');
        }
    };

    const calculateRechargeRecipients = (amount: number): number => {
        if (!rechargeInfo) return 0;
        return Math.floor((amount / rechargeInfo.standardRate.cost) * rechargeInfo.standardRate.recipients);
    };

    const getTrendIcon = (trend: number) => {
        if (trend > 0) {
            return <TrendingUpIcon className="h-4 w-4 text-green-500" />;
        } else if (trend < 0) {
            return <TrendingDownIcon className="h-4 w-4 text-red-500" />;
        }
        return null;
    };

    const getTrendColor = (trend: number) => {
        if (trend > 0) return 'text-green-600';
        if (trend < 0) return 'text-red-600';
        return 'text-gray-600';
    };

    if (isLoading) {
        return <LoadingSkeleton lines={4} height="h-16" className="space-y-4" />;
    }

    return (
        <div className="space-y-6">
            {/* Header with Refresh */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Usage & Billing</h1>
                    <p className="text-gray-600 mt-1">Monitor your usage, billing history, and account balance</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadData(true)}
                    disabled={isRefreshing}
                    className="flex items-center space-x-2"
                >
                    <RefreshIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                </Button>
            </div>

            {/* Subscription Overview */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6"
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <CreditCardIcon className="h-6 w-6 text-blue-600" />
                        <h2 className="text-xl font-semibold text-gray-900">Subscription Overview</h2>
                    </div>
                    <div className="flex items-center space-x-3">
                        <Button variant="outline" size="sm">
                            Manage Subscription
                        </Button>
                        <Button 
                            className="bg-gradient-to-r from-green-600 to-blue-600 text-white"
                            size="sm"
                            onClick={() => document.getElementById('recharge-section')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                            Quick Recharge
                        </Button>
                    </div>
                </div>

                {subscriptionInfo && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-blue-600 font-medium">Current Plan</p>
                                    <p className="text-2xl font-bold text-blue-900">{subscriptionInfo.tierName}</p>
                                    <p className="text-sm text-blue-700 mt-1">
                                        {subscriptionInfo.amount > 0 ? `${formatCurrency(subscriptionInfo.amount)}/month` : 'Free'}
                                    </p>
                                </div>
                                <CheckCircleIcon className="h-8 w-8 text-blue-600" />
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-green-600 font-medium">Recharge Balance</p>
                                    <motion.p 
                                        key={subscriptionInfo.rechargeBalance}
                                        initial={{ scale: 1.2, color: '#10b981' }}
                                        animate={{ scale: 1, color: '#065f46' }}
                                        transition={{ duration: 0.3 }}
                                        className="text-2xl font-bold text-green-900"
                                    >
                                        {formatCurrency(subscriptionInfo.rechargeBalance)}
                                    </motion.p>
                                    <p className="text-sm text-green-700 mt-1">
                                        ≈ {rechargeInfo ? Math.floor(subscriptionInfo.rechargeBalance / (rechargeInfo.standardRate.cost / rechargeInfo.standardRate.recipients)) : 0} recipients
                                    </p>
                                </div>
                                <BanknotesIcon className="h-8 w-8 text-green-600" />
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-purple-600 font-medium">Next Billing</p>
                                    <p className="text-lg font-bold text-purple-900">
                                        {new Date(subscriptionInfo.nextBillingDate).toLocaleDateString('en-IN')}
                                    </p>
                                    <p className="text-sm text-purple-700 mt-1">
                                        {Math.ceil((new Date(subscriptionInfo.nextBillingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                                    </p>
                                </div>
                                <CalendarIcon className="h-8 w-8 text-purple-600" />
                            </div>
                        </div>

                        {analytics && (
                            <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-orange-600 font-medium">Total Spent</p>
                                        <p className="text-2xl font-bold text-orange-900">
                                            {formatCurrency(analytics.totalSpent)}
                                        </p>
                                        <div className="flex items-center mt-1">
                                            {getTrendIcon(analytics.trends.spendingTrend)}
                                            <p className={`text-sm ml-1 ${getTrendColor(analytics.trends.spendingTrend)}`}>
                                                {Math.abs(analytics.trends.spendingTrend).toFixed(1)}% this period
                                            </p>
                                        </div>
                                    </div>
                                    <TrendingUpIcon className="h-8 w-8 text-orange-600" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </motion.div>

            {/* Enhanced Usage Statistics with Real-time Updates */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6"
            >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
                    <div className="flex items-center space-x-3">
                        <ChartBarIcon className="h-6 w-6 text-green-600" />
                        <h2 className="text-xl font-semibold text-gray-900">Usage Statistics</h2>
                        {usageStats?.resetDates && (
                            <div className="text-sm text-gray-500">
                                • Resets {new Date(usageStats.resetDates.monthlyReset).toLocaleDateString('en-IN')}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        {(['7d', '30d', '90d'] as const).map((period) => (
                            <button
                                key={period}
                                onClick={() => {
                                    setSelectedPeriod(period);
                                    loadData(true);
                                }}
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${selectedPeriod === period
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
                            </button>
                        ))}
                    </div>
                </div>

                {usageStats && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                            {[
                                {
                                    label: 'Daily Emails',
                                    current: usageStats.currentPeriod.dailyEmailsSent,
                                    limit: usageStats.limits.dailyEmails,
                                    percentage: usageStats.percentageUsed.dailyEmails,
                                    icon: '📧',
                                    resetInfo: 'Resets daily'
                                },
                                {
                                    label: 'Monthly Emails',
                                    current: usageStats.currentPeriod.emailsSent,
                                    limit: usageStats.limits.monthlyEmails,
                                    percentage: usageStats.percentageUsed.emails,
                                    icon: '📬',
                                    resetInfo: 'Resets monthly'
                                },
                                {
                                    label: 'Recipients',
                                    current: usageStats.currentPeriod.recipientsReached,
                                    limit: usageStats.limits.monthlyRecipients,
                                    percentage: usageStats.percentageUsed.recipients,
                                    icon: '👥',
                                    resetInfo: 'Resets monthly'
                                },
                                {
                                    label: 'Templates',
                                    current: usageStats.currentPeriod.templatesCreated,
                                    limit: usageStats.limits.templatesPerDay,
                                    percentage: usageStats.percentageUsed.templates,
                                    icon: '📄',
                                    resetInfo: 'Resets daily'
                                },
                                {
                                    label: 'API Calls',
                                    current: usageStats.currentPeriod.apiCalls,
                                    limit: usageStats.limits.apiCallsPerHour,
                                    percentage: usageStats.percentageUsed.apiCalls,
                                    icon: '🔌',
                                    resetInfo: 'Per hour limit'
                                }
                            ].map((stat, index) => {
                                const color = getUsageColor(stat.percentage);
                                const isUnlimited = stat.limit === -1;
                                
                                return (
                                    <motion.div
                                        key={stat.label}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-2xl">{stat.icon}</span>
                                            {!isUnlimited && (
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${color === 'red' ? 'bg-red-100 text-red-800' :
                                                    color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-green-100 text-green-800'
                                                    }`}>
                                                    {stat.percentage.toFixed(1)}%
                                                </span>
                                            )}
                                            {isUnlimited && (
                                                <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                                                    Unlimited
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-medium text-gray-900 mb-1 text-sm">{stat.label}</h3>
                                        <motion.p 
                                            key={stat.current}
                                            initial={{ scale: 1.1 }}
                                            animate={{ scale: 1 }}
                                            className="text-xl font-bold text-gray-900 mb-2"
                                        >
                                            {stat.current.toLocaleString()}
                                        </motion.p>
                                        
                                        {!isUnlimited && (
                                            <>
                                                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${Math.min(stat.percentage, 100)}%` }}
                                                        transition={{ duration: 1, delay: index * 0.1 }}
                                                        className={`h-2 rounded-full ${color === 'red' ? 'bg-red-500' :
                                                            color === 'yellow' ? 'bg-yellow-500' :
                                                                'bg-green-500'
                                                            }`}
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-600">
                                                    of {stat.limit.toLocaleString()} limit
                                                </p>
                                            </>
                                        )}
                                        
                                        <p className="text-xs text-gray-500 mt-1">
                                            {stat.resetInfo}
                                        </p>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Animated Progress Rings for Key Metrics */}
                        <div className="bg-white rounded-lg p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-6">Usage Overview</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="text-center">
                                    <ProgressRing
                                        progress={usageStats.percentageUsed.emails}
                                        size={100}
                                        className={`${getUsageColor(usageStats.percentageUsed.emails) === 'red' ? 'text-red-500' : 
                                               getUsageColor(usageStats.percentageUsed.emails) === 'yellow' ? 'text-yellow-500' : 'text-green-500'}`}
                                    >
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-gray-900">
                                                {usageStats.percentageUsed.emails.toFixed(1)}%
                                            </div>
                                            <div className="text-xs text-gray-600">Used</div>
                                        </div>
                                    </ProgressRing>
                                    <div className="mt-3">
                                        <p className="font-medium text-gray-900">Monthly Emails</p>
                                        <p className="text-sm text-gray-600">
                                            <AnimatedCounter value={usageStats.currentPeriod.emailsSent} /> / {usageStats.limits.monthlyEmails.toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="text-center">
                                    <ProgressRing
                                        progress={usageStats.percentageUsed.recipients}
                                        size={100}
                                        className={`${getUsageColor(usageStats.percentageUsed.recipients) === 'red' ? 'text-red-500' : 
                                               getUsageColor(usageStats.percentageUsed.recipients) === 'yellow' ? 'text-yellow-500' : 'text-green-500'}`}
                                    >
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-gray-900">
                                                {usageStats.percentageUsed.recipients.toFixed(1)}%
                                            </div>
                                            <div className="text-xs text-gray-600">Used</div>
                                        </div>
                                    </ProgressRing>
                                    <div className="mt-3">
                                        <p className="font-medium text-gray-900">Recipients</p>
                                        <p className="text-sm text-gray-600">
                                            <AnimatedCounter value={usageStats.currentPeriod.recipientsReached} /> / {usageStats.limits.monthlyRecipients.toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="text-center">
                                    <ProgressRing
                                        progress={usageStats.percentageUsed.dailyEmails}
                                        size={100}
                                        className={`${getUsageColor(usageStats.percentageUsed.dailyEmails) === 'red' ? 'text-red-500' : 
                                               getUsageColor(usageStats.percentageUsed.dailyEmails) === 'yellow' ? 'text-yellow-500' : 'text-green-500'}`}
                                    >
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-gray-900">
                                                {usageStats.percentageUsed.dailyEmails.toFixed(1)}%
                                            </div>
                                            <div className="text-xs text-gray-600">Used</div>
                                        </div>
                                    </ProgressRing>
                                    <div className="mt-3">
                                        <p className="font-medium text-gray-900">Daily Emails</p>
                                        <p className="text-sm text-gray-600">
                                            <AnimatedCounter value={usageStats.currentPeriod.dailyEmailsSent} /> / {usageStats.limits.dailyEmails.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Usage Trend Chart */}
                        {historicalData.length > 0 && (
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Trends ({selectedPeriod})</h3>
                                <div className="h-64 flex items-end justify-between space-x-1">
                                    {historicalData.slice(-14).map((data, index) => {
                                        const maxEmails = Math.max(...historicalData.map(d => d.emailsSent));
                                        const height = (data.emailsSent / maxEmails) * 100;
                                        
                                        return (
                                            <motion.div
                                                key={data.date}
                                                initial={{ height: 0 }}
                                                animate={{ height: `${height}%` }}
                                                transition={{ duration: 0.5, delay: index * 0.05 }}
                                                className="bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-sm flex-1 min-h-[4px] relative group"
                                                title={`${data.date}: ${data.emailsSent} emails`}
                                            >
                                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                    {new Date(data.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}: {data.emailsSent} emails
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-2">
                                    <span>{historicalData[Math.max(0, historicalData.length - 14)] ? new Date(historicalData[Math.max(0, historicalData.length - 14)].date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : ''}</span>
                                    <span>Today</span>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </motion.div>

            {/* Enhanced Billing History */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6"
            >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
                    <div className="flex items-center space-x-3">
                        <ClockIcon className="h-6 w-6 text-purple-600" />
                        <h2 className="text-xl font-semibold text-gray-900">Transaction History</h2>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                            {(['all', 'subscription', 'recharge'] as const).map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setSelectedHistoryType(type)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${selectedHistoryType === type
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    {type === 'all' ? 'All' : type === 'subscription' ? 'Subscriptions' : 'Recharges'}
                                </button>
                            ))}
                        </div>
                        <Button variant="outline" size="sm">
                            <DocumentTextIcon className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Description
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Amount
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Recipients
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            <AnimatePresence>
                                {billingHistory
                                    .filter(transaction => selectedHistoryType === 'all' || transaction.type === selectedHistoryType)
                                    .map((transaction, index) => (
                                    <motion.tr
                                        key={transaction.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="hover:bg-gray-50/50 transition-colors"
                                    >
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {new Date(transaction.date).toLocaleDateString('en-IN')}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-900">
                                            {transaction.description}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${transaction.type === 'subscription'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-green-100 text-green-800'
                                                }`}>
                                                {transaction.type === 'subscription' ? 'Subscription' : 'Recharge'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {formatCurrency(transaction.amount, transaction.currency)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {transaction.recipientsAdded ? 
                                                `+${transaction.recipientsAdded.toLocaleString()}` : 
                                                '-'
                                            }
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${transaction.status === 'paid'
                                                ? 'bg-green-100 text-green-800'
                                                : transaction.status === 'pending'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                    
                    {billingHistory.filter(t => selectedHistoryType === 'all' || t.type === selectedHistoryType).length === 0 && (
                        <div className="text-center py-8">
                            <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No transactions found for the selected filter.</p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Enhanced Recharge Section */}
            <motion.div
                id="recharge-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200 shadow-lg p-6"
            >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
                    <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                            <BanknotesIcon className="h-6 w-6 text-green-600" />
                            <h3 className="text-xl font-semibold text-gray-900">
                                Recharge Your Account
                            </h3>
                        </div>
                        
                        {rechargeInfo && (
                            <div className="mb-4">
                                <p className="text-gray-600 mb-3">
                                    {rechargeInfo.description}
                                </p>
                                <div className="bg-white rounded-lg p-4 border border-green-200">
                                    <div className="flex items-center justify-center space-x-8">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-green-600">
                                                {rechargeInfo.standardRate.recipients}
                                            </p>
                                            <p className="text-sm text-gray-600">Recipients</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg text-gray-400">=</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-blue-600">
                                                ₹{rechargeInfo.standardRate.cost}
                                            </p>
                                            <p className="text-sm text-gray-600">Cost</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-lg p-3 border border-green-200">
                                <p className="text-sm text-gray-600">Current Balance</p>
                                <p className="text-xl font-bold text-green-600">
                                    {subscriptionInfo ? formatCurrency(subscriptionInfo.rechargeBalance) : '₹0.00'}
                                </p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-blue-200">
                                <p className="text-sm text-gray-600">Available Recipients</p>
                                <p className="text-xl font-bold text-blue-600">
                                    {subscriptionInfo && rechargeInfo ? 
                                        Math.floor(subscriptionInfo.rechargeBalance / (rechargeInfo.standardRate.cost / rechargeInfo.standardRate.recipients)) : 0
                                    }
                                </p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-purple-200">
                                <p className="text-sm text-gray-600">Cost per Recipient</p>
                                <p className="text-xl font-bold text-purple-600">
                                    ₹{rechargeInfo ? (rechargeInfo.standardRate.cost / rechargeInfo.standardRate.recipients).toFixed(2) : '0.02'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="lg:ml-8">
                        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm min-w-[300px]">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Quick Recharge</h4>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Recharge Amount (₹)
                                    </label>
                                    <input
                                        type="number"
                                        min="10"
                                        step="10"
                                        value={rechargeAmount}
                                        onChange={(e) => setRechargeAmount(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Enter amount"
                                    />
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">Recipients you'll get:</span>
                                        <span className="font-semibold text-green-600">
                                            {calculateRechargeRecipients(parseFloat(rechargeAmount) || 0)}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {[50, 100, 200].map((amount) => (
                                        <button
                                            key={amount}
                                            onClick={() => setRechargeAmount(amount.toString())}
                                            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500"
                                        >
                                            ₹{amount}
                                        </button>
                                    ))}
                                </div>

                                <Button 
                                    className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white"
                                    onClick={handleRecharge}
                                    disabled={!rechargeAmount || parseFloat(rechargeAmount) < 10}
                                >
                                    Recharge ₹{rechargeAmount || '0'}
                                </Button>

                                <p className="text-xs text-gray-500 text-center">
                                    Minimum recharge: ₹10 • Secure payment via Stripe/Razorpay
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Analytics Dashboard */}
            {analytics && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                            <ChartBarIcon className="h-6 w-6 text-indigo-600" />
                            <h2 className="text-xl font-semibold text-gray-900">Analytics & Trends</h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-indigo-600 font-medium">Total Emails Sent</p>
                                    <p className="text-2xl font-bold text-indigo-900">
                                        {analytics.totalEmails.toLocaleString()}
                                    </p>
                                    <div className="flex items-center mt-1">
                                        {getTrendIcon(analytics.trends.emailTrend)}
                                        <p className={`text-sm ml-1 ${getTrendColor(analytics.trends.emailTrend)}`}>
                                            {Math.abs(analytics.trends.emailTrend).toFixed(1)}% vs last period
                                        </p>
                                    </div>
                                </div>
                                <DocumentTextIcon className="h-8 w-8 text-indigo-600" />
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-teal-50 to-teal-100 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-teal-600 font-medium">Total Recipients</p>
                                    <p className="text-2xl font-bold text-teal-900">
                                        {analytics.totalRecipients.toLocaleString()}
                                    </p>
                                    <div className="flex items-center mt-1">
                                        {getTrendIcon(analytics.trends.recipientTrend)}
                                        <p className={`text-sm ml-1 ${getTrendColor(analytics.trends.recipientTrend)}`}>
                                            {Math.abs(analytics.trends.recipientTrend).toFixed(1)}% vs last period
                                        </p>
                                    </div>
                                </div>
                                <ArrowUpIcon className="h-8 w-8 text-teal-600" />
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-amber-600 font-medium">Avg Cost per Email</p>
                                    <p className="text-2xl font-bold text-amber-900">
                                        ₹{analytics.averageCostPerEmail.toFixed(3)}
                                    </p>
                                    <p className="text-sm text-amber-700 mt-1">
                                        Highly cost-effective
                                    </p>
                                </div>
                                <TrendingDownIcon className="h-8 w-8 text-amber-600" />
                            </div>
                        </div>
                    </div>

                    {/* Spending Categories */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending Breakdown</h3>
                        <div className="space-y-3">
                            {analytics.topCategories.map((category, index) => (
                                <div key={category.category} className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-blue-500' : 'bg-green-500'}`} />
                                        <span className="text-gray-700">{category.category}</span>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <div className="w-32 bg-gray-200 rounded-full h-2">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${category.percentage}%` }}
                                                transition={{ duration: 1, delay: index * 0.2 }}
                                                className={`h-2 rounded-full ${index === 0 ? 'bg-blue-500' : 'bg-green-500'}`}
                                            />
                                        </div>
                                        <span className="text-sm font-medium text-gray-900 min-w-[60px] text-right">
                                            {formatCurrency(category.amount)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}