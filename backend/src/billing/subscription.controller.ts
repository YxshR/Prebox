import { Request, Response } from 'express';
import { SubscriptionService, TierUpgradeRequest } from './subscription.service';
import { SubscriptionTier, User } from '../shared/types';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export class SubscriptionController {
  private subscriptionService: SubscriptionService;

  constructor(subscriptionService: SubscriptionService) {
    this.subscriptionService = subscriptionService;
  }

  /**
   * Get all available subscription plans
   */
  getPlans = async (req: Request, res: Response) => {
    try {
      const plans = this.subscriptionService.getAllSubscriptionPlans();
      
      res.json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PLANS_FETCH_FAILED',
          message: 'Failed to fetch subscription plans'
        }
      });
    }
  };

  /**
   * Get current user's subscription details
   */
  getCurrentSubscription = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.tenantId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // TODO: Get subscription from database
      // For now, return mock data based on user's tier
      const plan = this.subscriptionService.getSubscriptionPlan(req.user.subscriptionTier);
      
      if (!plan) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_NOT_FOUND',
            message: 'Subscription not found'
          }
        });
      }

      // Mock subscription data
      const subscription = {
        id: `sub_${req.user.tenantId}`,
        tenantId: req.user.tenantId,
        planId: plan.id,
        tier: plan.tier,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        limits: plan.limits,
        usage: {
          dailyEmailsSent: 0,
          monthlyEmailsSent: 0,
          uniqueRecipients: 0,
          templatesCreated: 0,
          customDomainsUsed: 0,
          lastResetDate: new Date()
        },
        rechargeBalance: 0,
        plan: plan
      };

      res.json({
        success: true,
        data: subscription
      });
    } catch (error) {
      console.error('Error fetching current subscription:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_FETCH_FAILED',
          message: 'Failed to fetch subscription details'
        }
      });
    }
  };

  /**
   * Get current usage statistics
   */
  getUsageStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.tenantId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // TODO: Get actual usage from database
      // For now, return mock usage data
      const plan = this.subscriptionService.getSubscriptionPlan(req.user.subscriptionTier);
      
      const usage = {
        dailyEmails: {
          used: 0,
          limit: plan?.limits.dailyEmailLimit || 0,
          resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
        },
        monthlyEmails: {
          used: 0,
          limit: plan?.limits.monthlyEmailLimit || 0,
          resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) // Next month
        },
        monthlyRecipients: {
          used: 0,
          limit: plan?.limits.monthlyRecipientLimit || 0,
          resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) // Next month
        },
        templates: {
          used: 0,
          limit: plan?.limits.templateLimit || 0,
          resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow (daily reset)
        },
        customDomains: {
          used: 0,
          limit: plan?.limits.customDomainLimit || 0
        }
      };

      res.json({
        success: true,
        data: usage
      });
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'USAGE_FETCH_FAILED',
          message: 'Failed to fetch usage statistics'
        }
      });
    }
  };

  /**
   * Upgrade or downgrade subscription tier
   */
  changeTier = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id || !req.user?.tenantId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { targetTier, paymentMethod } = req.body;

      // Validate target tier
      if (!Object.values(SubscriptionTier).includes(targetTier)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TIER',
            message: 'Invalid subscription tier'
          }
        });
      }

      const upgradeRequest: TierUpgradeRequest = {
        userId: req.user.id,
        currentTier: req.user.subscriptionTier,
        targetTier,
        paymentMethod
      };

      const updatedSubscription = await this.subscriptionService.changeTier(upgradeRequest);

      res.json({
        success: true,
        data: updatedSubscription,
        message: `Successfully ${this.isUpgrade(req.user.subscriptionTier, targetTier) ? 'upgraded' : 'downgraded'} to ${targetTier}`
      });
    } catch (error) {
      console.error('Error changing subscription tier:', error);
      
      let errorCode = 'TIER_CHANGE_FAILED';
      let statusCode = 500;
      
      if (error instanceof Error) {
        if (error.message.includes('payment')) {
          errorCode = 'PAYMENT_FAILED';
          statusCode = 402;
        } else if (error.message.includes('not found')) {
          errorCode = 'SUBSCRIPTION_NOT_FOUND';
          statusCode = 404;
        } else if (error.message.includes('same as current')) {
          errorCode = 'INVALID_TIER_CHANGE';
          statusCode = 400;
        }
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Failed to change subscription tier'
        }
      });
    }
  };

  /**
   * Add recharge balance to subscription
   */
  addRecharge = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.tenantId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { amount, paymentMethod } = req.body;

      // Validate amount
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: 'Invalid recharge amount'
          }
        });
      }

      // TODO: Process payment before adding balance
      
      const updatedSubscription = await this.subscriptionService.addRechargeBalance(
        req.user.tenantId,
        amount
      );

      res.json({
        success: true,
        data: updatedSubscription,
        message: `Successfully added ₹${amount} to your account balance`
      });
    } catch (error) {
      console.error('Error adding recharge balance:', error);
      
      let errorCode = 'RECHARGE_FAILED';
      let statusCode = 500;
      
      if (error instanceof Error) {
        if (error.message.includes('not available')) {
          errorCode = 'RECHARGE_NOT_AVAILABLE';
          statusCode = 403;
        } else if (error.message.includes('amount must be between')) {
          errorCode = 'INVALID_RECHARGE_AMOUNT';
          statusCode = 400;
        } else if (error.message.includes('not found')) {
          errorCode = 'SUBSCRIPTION_NOT_FOUND';
          statusCode = 404;
        }
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Failed to add recharge balance'
        }
      });
    }
  };

  /**
   * Check quota for specific action
   */
  checkQuota = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.tenantId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { quotaType, amount = 1 } = req.query;

      if (!quotaType || typeof quotaType !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_QUOTA_TYPE',
            message: 'Valid quota type is required'
          }
        });
      }

      const quotaResult = await this.subscriptionService.checkQuota(
        req.user.tenantId,
        quotaType as any,
        Number(amount)
      );

      res.json({
        success: true,
        data: quotaResult
      });
    } catch (error) {
      console.error('Error checking quota:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'QUOTA_CHECK_FAILED',
          message: 'Failed to check quota'
        }
      });
    }
  };

  // Helper method
  private isUpgrade(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
    const tierOrder = [
      SubscriptionTier.FREE,
      SubscriptionTier.PAID_STANDARD,
      SubscriptionTier.PREMIUM,
      SubscriptionTier.ENTERPRISE
    ];
    
    const currentIndex = tierOrder.indexOf(currentTier);
    const targetIndex = tierOrder.indexOf(targetTier);
    
    return targetIndex > currentIndex;
  }
}