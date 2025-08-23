import { Router } from 'express';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { InvoiceService } from './invoice.service';
import { authMiddleware } from '../auth/auth.middleware';
import { ApiResponse, SubscriptionTier } from '../shared/types';

const router = Router();
const subscriptionService = new SubscriptionService();
const paymentService = new PaymentService();
const invoiceService = new InvoiceService();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * GET /billing/subscription - Get current subscription info
 */
router.get('/subscription', async (req, res) => {
  try {
    const { tenantId } = req.user!;
    
    // Get subscription from database
    const subscription = await subscriptionService.getSubscriptionByTenantId(tenantId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      } as ApiResponse);
    }

    const plan = subscriptionService.getSubscriptionPlan(subscription.limits as any);
    const rechargeInfo = subscriptionService.getRechargeInfo();

    const response = {
      subscription: {
        id: subscription.id,
        tier: plan?.tier || SubscriptionTier.FREE,
        tierName: plan?.name || 'Free',
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        rechargeBalance: subscription.rechargeBalance,
        limits: subscription.limits,
        usage: subscription.usage
      },
      plan: plan ? {
        name: plan.name,
        description: plan.description,
        priceInr: plan.priceInr,
        features: plan.features,
        rechargeOptions: plan.rechargeOptions
      } : null,
      rechargeInfo
    };

    res.json({
      success: true,
      data: response
    } as ApiResponse);

  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch subscription information'
      }
    } as ApiResponse);
  }
});

/**
 * GET /billing/usage - Get detailed usage statistics
 */
router.get('/usage', async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const { period = '30d' } = req.query;
    
    const subscription = await subscriptionService.getSubscriptionByTenantId(tenantId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      } as ApiResponse);
    }

    // Calculate usage percentages
    const calculatePercentage = (current: number, limit: number): number => {
      if (limit === -1) return 0; // Unlimited
      return limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
    };

    const usageStats = {
      currentPeriod: {
        emailsSent: subscription.usage.monthlyEmailsSent,
        recipientsReached: subscription.usage.uniqueRecipients,
        templatesCreated: subscription.usage.templatesCreated,
        apiCalls: 0, // TODO: Implement API call tracking
        dailyEmailsSent: subscription.usage.dailyEmailsSent
      },
      limits: {
        dailyEmails: subscription.limits.dailyEmailLimit,
        monthlyEmails: subscription.limits.monthlyEmailLimit,
        monthlyRecipients: subscription.limits.monthlyRecipientLimit,
        templatesPerDay: subscription.limits.templateLimit,
        apiCallsPerHour: 500 // TODO: Make this configurable per tier
      },
      percentageUsed: {
        emails: calculatePercentage(subscription.usage.monthlyEmailsSent, subscription.limits.monthlyEmailLimit),
        recipients: calculatePercentage(subscription.usage.uniqueRecipients, subscription.limits.monthlyRecipientLimit),
        templates: calculatePercentage(subscription.usage.templatesCreated, subscription.limits.templateLimit),
        apiCalls: 0, // TODO: Calculate API usage percentage
        dailyEmails: calculatePercentage(subscription.usage.dailyEmailsSent, subscription.limits.dailyEmailLimit)
      },
      resetDates: {
        dailyReset: getNextDayReset(),
        monthlyReset: getNextMonthReset()
      }
    };

    // TODO: Add historical usage data based on period parameter
    const historicalData = await generateMockHistoricalData(period as string);

    res.json({
      success: true,
      data: {
        usage: usageStats,
        historical: historicalData,
        period
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch usage statistics'
      }
    } as ApiResponse);
  }
});

/**
 * GET /billing/history - Get billing and transaction history
 */
router.get('/history', async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const { limit = 50, offset = 0, type } = req.query;
    
    // Get invoices from database
    const invoices = await invoiceService.getInvoicesByTenant(
      tenantId,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    // TODO: Get recharge transactions from database
    const rechargeTransactions = await getMockRechargeHistory(tenantId);

    // Combine and sort by date
    let allTransactions = [
      ...invoices.map(invoice => ({
        id: invoice.id,
        date: invoice.paidAt || invoice.dueDate,
        description: getInvoiceDescription(invoice),
        amount: invoice.amount,
        status: invoice.status,
        type: invoice.metadata?.type || 'subscription',
        currency: invoice.currency,
        invoiceId: invoice.id
      })),
      ...rechargeTransactions
    ];

    // Filter by type if specified
    if (type && type !== 'all') {
      allTransactions = allTransactions.filter(t => t.type === type);
    }

    // Sort by date (newest first)
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply pagination
    const paginatedTransactions = allTransactions.slice(
      parseInt(offset as string),
      parseInt(offset as string) + parseInt(limit as string)
    );

    res.json({
      success: true,
      data: {
        transactions: paginatedTransactions,
        total: allTransactions.length,
        hasMore: (parseInt(offset as string) + parseInt(limit as string)) < allTransactions.length
      },
      meta: {
        page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
        limit: parseInt(limit as string),
        total: allTransactions.length
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Get billing history error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch billing history'
      }
    } as ApiResponse);
  }
});

/**
 * POST /billing/recharge - Process recharge payment
 */
router.post('/recharge', async (req, res) => {
  try {
    const { id: userId, tenantId } = req.user!;
    const { amount, paymentMethodId, provider = 'stripe' } = req.body;

    if (!amount || amount < 10) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Minimum recharge amount is ₹10'
        }
      } as ApiResponse);
    }

    const rechargeRequest = {
      userId,
      tenantId,
      amount: parseFloat(amount),
      currency: 'inr',
      paymentMethodId,
      provider
    };

    const paymentResult = await paymentService.processRecharge(rechargeRequest);

    if (paymentResult.success) {
      // Calculate recipients added
      const recipientsAdded = subscriptionService.calculateRechargeRecipients(amount);
      
      res.json({
        success: true,
        data: {
          paymentResult,
          recipientsAdded,
          newBalance: await getUpdatedBalance(tenantId)
        }
      } as ApiResponse);
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'PAYMENT_FAILED',
          message: paymentResult.error || 'Payment processing failed'
        }
      } as ApiResponse);
    }

  } catch (error) {
    console.error('Recharge processing error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process recharge'
      }
    } as ApiResponse);
  }
});

/**
 * GET /billing/analytics - Get billing analytics and trends
 */
router.get('/analytics', async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const { period = '30d' } = req.query;
    
    // TODO: Implement real analytics from database
    const analytics = await generateMockAnalytics(tenantId, period as string);
    
    res.json({
      success: true,
      data: analytics
    } as ApiResponse);

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch analytics'
      }
    } as ApiResponse);
  }
});

// Helper functions

function getNextDayReset(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

function getNextMonthReset(): Date {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);
  return nextMonth;
}

function getInvoiceDescription(invoice: any): string {
  const type = invoice.metadata?.type || 'subscription';
  if (type === 'recharge') {
    return `Account Recharge - ₹${invoice.amount}`;
  } else if (type === 'subscription') {
    return `${invoice.metadata?.planName || 'Subscription'} - Monthly Plan`;
  } else {
    return `Usage Charges - ${invoice.metadata?.description || 'Additional usage'}`;
  }
}

async function getMockRechargeHistory(tenantId: string) {
  // TODO: Replace with real database query
  return [
    {
      id: 'rch_001',
      date: new Date('2024-01-15'),
      description: 'Account Recharge - 2500 recipients',
      amount: 50,
      status: 'paid',
      type: 'recharge',
      currency: 'inr',
      recipientsAdded: 2500
    },
    {
      id: 'rch_002',
      date: new Date('2023-12-20'),
      description: 'Account Recharge - 1000 recipients',
      amount: 20,
      status: 'paid',
      type: 'recharge',
      currency: 'inr',
      recipientsAdded: 1000
    }
  ];
}

async function generateMockHistoricalData(period: string) {
  // TODO: Replace with real database aggregation
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const data = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      emailsSent: Math.floor(Math.random() * 500) + 100,
      recipientsReached: Math.floor(Math.random() * 200) + 50,
      templatesCreated: Math.floor(Math.random() * 5),
      apiCalls: Math.floor(Math.random() * 100) + 20
    });
  }
  
  return data;
}

async function generateMockAnalytics(tenantId: string, period: string) {
  // TODO: Replace with real analytics calculation
  return {
    totalSpent: 149,
    totalEmails: 25000,
    totalRecipients: 8500,
    averageCostPerEmail: 0.006,
    trends: {
      spendingTrend: 15.2, // Percentage change
      emailTrend: 8.7,
      recipientTrend: 12.3
    },
    topCategories: [
      { category: 'Subscription', amount: 59, percentage: 39.6 },
      { category: 'Recharge', amount: 90, percentage: 60.4 }
    ]
  };
}

async function getUpdatedBalance(tenantId: string): Promise<number> {
  const subscription = await subscriptionService.getSubscriptionByTenantId(tenantId);
  return subscription?.rechargeBalance || 0;
}

export default router;