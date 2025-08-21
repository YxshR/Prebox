import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AdminAuthMiddleware } from '../auth/admin-auth.middleware';
import { AdminUserService } from './admin-user.service';
import { AdminSubscriptionService } from './admin-subscription.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminUsageService } from './admin-usage.service';
import { AdminScheduledEmailService } from './admin-scheduled-email.service';
import { AdminBillingService } from './admin-billing.service';
import { UserRole, SubscriptionTier, BillingSubscriptionStatus, ScheduledEmailStatus } from '../shared/types';

const router = Router();
const adminAuthMiddleware = new AdminAuthMiddleware();
const adminUserService = new AdminUserService();
const adminSubscriptionService = new AdminSubscriptionService();
const adminAnalyticsService = new AdminAnalyticsService();
const adminUsageService = new AdminUsageService();
const adminScheduledEmailService = new AdminScheduledEmailService();
const adminBillingService = new AdminBillingService();

// Apply admin authentication to all routes
router.use(adminAuthMiddleware.authenticate);

// User Management Routes
router.get('/users', async (req: Request, res: Response) => {
  try {
    const filters = {
      role: req.query.role as UserRole,
      subscriptionTier: req.query.subscriptionTier as SubscriptionTier,
      isEmailVerified: req.query.isEmailVerified === 'true' ? true : req.query.isEmailVerified === 'false' ? false : undefined,
      isPhoneVerified: req.query.isPhoneVerified === 'true' ? true : req.query.isPhoneVerified === 'false' ? false : undefined,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    };

    const result = await adminUserService.getUsers(filters);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_USERS_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/users/stats', async (req: Request, res: Response) => {
  try {
    const stats = await adminUserService.getUserStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_USER_STATS_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/users/:userId', async (req: Request, res: Response) => {
  try {
    const user = await adminUserService.getUserById(req.params.userId);
    res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: error.message
      }
    });
  }
});

const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  role: Joi.string().valid(...Object.values(UserRole)).optional(),
  subscriptionTier: Joi.string().valid(...Object.values(SubscriptionTier)).optional(),
  isEmailVerified: Joi.boolean().optional(),
  isPhoneVerified: Joi.boolean().optional()
});

router.put('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { error, value } = updateUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const user = await adminUserService.updateUser(req.params.userId, value);
    res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'UPDATE_USER_FAILED',
        message: error.message
      }
    });
  }
});

router.delete('/users/:userId', adminAuthMiddleware.requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    await adminUserService.deleteUser(req.params.userId);
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'DELETE_USER_FAILED',
        message: error.message
      }
    });
  }
});

// Subscription Management Routes
router.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as BillingSubscriptionStatus,
      tier: req.query.tier as SubscriptionTier,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    };

    const result = await adminSubscriptionService.getSubscriptions(filters);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_SUBSCRIPTIONS_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/subscriptions/stats', async (req: Request, res: Response) => {
  try {
    const stats = await adminSubscriptionService.getSubscriptionStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_SUBSCRIPTION_STATS_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/subscriptions/revenue-history', async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const history = await adminSubscriptionService.getRevenueHistory(months);
    res.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_REVENUE_HISTORY_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/subscriptions/:subscriptionId', async (req: Request, res: Response) => {
  try {
    const subscription = await adminSubscriptionService.getSubscriptionById(req.params.subscriptionId);
    res.json({
      success: true,
      data: subscription
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: error.message
      }
    });
  }
});

const updateSubscriptionSchema = Joi.object({
  status: Joi.string().valid(...Object.values(BillingSubscriptionStatus)).optional(),
  planId: Joi.string().uuid().optional(),
  currentPeriodEnd: Joi.date().optional(),
  rechargeBalance: Joi.number().min(0).optional()
});

router.put('/subscriptions/:subscriptionId', async (req: Request, res: Response) => {
  try {
    const { error, value } = updateSubscriptionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const subscription = await adminSubscriptionService.updateSubscription(req.params.subscriptionId, value);
    res.json({
      success: true,
      data: subscription
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'UPDATE_SUBSCRIPTION_FAILED',
        message: error.message
      }
    });
  }
});

router.post('/subscriptions/:subscriptionId/cancel', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    await adminSubscriptionService.cancelSubscription(req.params.subscriptionId, reason);
    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'CANCEL_SUBSCRIPTION_FAILED',
        message: error.message
      }
    });
  }
});

// Analytics and Monitoring Routes
router.get('/analytics/system-metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await adminAnalyticsService.getSystemMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_SYSTEM_METRICS_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/analytics/email-volume', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await adminAnalyticsService.getEmailVolumeData(days);
    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_EMAIL_VOLUME_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/analytics/top-campaigns', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const campaigns = await adminAnalyticsService.getTopPerformingCampaigns(limit);
    res.json({
      success: true,
      data: campaigns
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_TOP_CAMPAIGNS_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/analytics/system-health', async (req: Request, res: Response) => {
  try {
    const health = await adminAnalyticsService.getSystemHealth();
    res.json({
      success: true,
      data: health
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_SYSTEM_HEALTH_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/analytics/tenant-usage', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const usage = await adminAnalyticsService.getTenantUsageStats(limit);
    res.json({
      success: true,
      data: usage
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_TENANT_USAGE_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/analytics/deliverability-trends', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const trends = await adminAnalyticsService.getDeliverabilityTrends(days);
    res.json({
      success: true,
      data: trends
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_DELIVERABILITY_TRENDS_FAILED',
        message: error.message
      }
    });
  }
});

// Usage Monitoring Routes
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const filters = {
      tenantId: req.query.tenantId as string,
      subscriptionTier: req.query.subscriptionTier as SubscriptionTier,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    };

    const result = await adminUsageService.getTenantUsage(filters);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_USAGE_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/usage/stats', async (req: Request, res: Response) => {
  try {
    const stats = await adminUsageService.getUsageStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_USAGE_STATS_FAILED',
        message: error.message
      }
    });
  }
});

router.put('/usage/:tenantId/quota', async (req: Request, res: Response) => {
  try {
    const { dailyLimit, monthlyEmailLimit, monthlyRecipientLimit, templateLimit, customDomainLimit } = req.body;
    
    await adminUsageService.updateTenantQuota(req.params.tenantId, {
      dailyLimit,
      monthlyEmailLimit,
      monthlyRecipientLimit,
      templateLimit,
      customDomainLimit
    });

    res.json({
      success: true,
      message: 'Quota updated successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'UPDATE_QUOTA_FAILED',
        message: error.message
      }
    });
  }
});

router.post('/usage/:tenantId/reset', async (req: Request, res: Response) => {
  try {
    const { resetType } = req.body;
    
    if (!['daily', 'monthly', 'all'].includes(resetType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RESET_TYPE',
          message: 'Reset type must be daily, monthly, or all'
        }
      });
    }

    await adminUsageService.resetTenantUsage(req.params.tenantId, resetType);

    res.json({
      success: true,
      message: 'Usage reset successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'RESET_USAGE_FAILED',
        message: error.message
      }
    });
  }
});

// Scheduled Email Monitoring Routes
router.get('/scheduled-emails', async (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as ScheduledEmailStatus,
      subscriptionTier: req.query.subscriptionTier as SubscriptionTier,
      userType: req.query.userType as 'subscription' | 'recharge',
      search: req.query.search as string,
      scheduledAfter: req.query.scheduledAfter ? new Date(req.query.scheduledAfter as string) : undefined,
      scheduledBefore: req.query.scheduledBefore ? new Date(req.query.scheduledBefore as string) : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    };

    const result = await adminScheduledEmailService.getScheduledEmails(filters);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_SCHEDULED_EMAILS_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/scheduled-emails/stats', async (req: Request, res: Response) => {
  try {
    const stats = await adminScheduledEmailService.getScheduledEmailStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_SCHEDULED_EMAIL_STATS_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/scheduled-emails/:scheduledEmailId', async (req: Request, res: Response) => {
  try {
    const scheduledEmail = await adminScheduledEmailService.getScheduledEmailById(req.params.scheduledEmailId);
    res.json({
      success: true,
      data: scheduledEmail
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: {
        code: 'SCHEDULED_EMAIL_NOT_FOUND',
        message: error.message
      }
    });
  }
});

router.post('/scheduled-emails/:scheduledEmailId/cancel', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    await adminScheduledEmailService.cancelScheduledEmail(req.params.scheduledEmailId, reason || 'Admin cancellation');
    res.json({
      success: true,
      message: 'Scheduled email cancelled successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'CANCEL_SCHEDULED_EMAIL_FAILED',
        message: error.message
      }
    });
  }
});

router.post('/scheduled-emails/:scheduledEmailId/reschedule', async (req: Request, res: Response) => {
  try {
    const { newScheduledAt } = req.body;
    
    if (!newScheduledAt) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SCHEDULE_TIME',
          message: 'New scheduled time is required'
        }
      });
    }

    await adminScheduledEmailService.rescheduleEmail(req.params.scheduledEmailId, new Date(newScheduledAt));
    res.json({
      success: true,
      message: 'Scheduled email rescheduled successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'RESCHEDULE_EMAIL_FAILED',
        message: error.message
      }
    });
  }
});

router.post('/scheduled-emails/bulk-cancel', async (req: Request, res: Response) => {
  try {
    const { filters, reason } = req.body;
    const cancelledCount = await adminScheduledEmailService.bulkCancelScheduledEmails(filters, reason || 'Bulk admin cancellation');
    res.json({
      success: true,
      message: `${cancelledCount} scheduled emails cancelled successfully`,
      data: { cancelledCount }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BULK_CANCEL_FAILED',
        message: error.message
      }
    });
  }
});

// Enhanced Billing Routes
router.get('/billing/invoices', async (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as 'paid' | 'pending' | 'failed' | 'refunded',
      subscriptionTier: req.query.subscriptionTier as SubscriptionTier,
      search: req.query.search as string,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    };

    const result = await adminBillingService.getInvoices(filters);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_INVOICES_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/billing/recharge-transactions', async (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as 'completed' | 'pending' | 'failed' | 'refunded',
      subscriptionTier: req.query.subscriptionTier as SubscriptionTier,
      search: req.query.search as string,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    };

    const result = await adminBillingService.getRechargeTransactions(filters);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_RECHARGE_TRANSACTIONS_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/billing/stats', async (req: Request, res: Response) => {
  try {
    const stats = await adminBillingService.getBillingStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_BILLING_STATS_FAILED',
        message: error.message
      }
    });
  }
});

router.post('/billing/invoices/:invoiceId/mark-paid', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.body;
    await adminBillingService.markInvoiceAsPaid(req.params.invoiceId, transactionId);
    res.json({
      success: true,
      message: 'Invoice marked as paid successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MARK_INVOICE_PAID_FAILED',
        message: error.message
      }
    });
  }
});

router.post('/billing/invoices/:invoiceId/refund', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    await adminBillingService.refundInvoice(req.params.invoiceId, reason || 'Admin refund');
    res.json({
      success: true,
      message: 'Invoice refunded successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'REFUND_INVOICE_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/billing/reports/invoices', async (req: Request, res: Response) => {
  try {
    const filters = {
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      subscriptionTier: req.query.subscriptionTier as SubscriptionTier
    };

    const report = await adminBillingService.generateInvoiceReport(filters);
    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'GENERATE_INVOICE_REPORT_FAILED',
        message: error.message
      }
    });
  }
});

export default router;