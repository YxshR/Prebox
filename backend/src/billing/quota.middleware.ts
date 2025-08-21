import { Request, Response, NextFunction } from 'express';
import { SubscriptionService, QuotaCheckResult } from './subscription.service';
import { User } from '../shared/types';

export interface QuotaRequest extends Request {
  user?: User;
  quotaCheck?: QuotaCheckResult;
}

export interface QuotaMiddlewareOptions {
  quotaType: 'daily_emails' | 'monthly_emails' | 'monthly_recipients' | 'templates' | 'custom_domains';
  requestedAmount?: number;
  skipOnUnlimited?: boolean;
}

export class QuotaMiddleware {
  private subscriptionService: SubscriptionService;

  constructor(subscriptionService: SubscriptionService) {
    this.subscriptionService = subscriptionService;
  }

  /**
   * Middleware to check quota before allowing action
   */
  checkQuota(options: QuotaMiddlewareOptions) {
    return async (req: QuotaRequest, res: Response, next: NextFunction) => {
      try {
        // Ensure user is authenticated
        if (!req.user?.tenantId) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          });
        }

        const { quotaType, requestedAmount = 1, skipOnUnlimited = true } = options;
        
        // Check quota
        const quotaResult = await this.subscriptionService.checkQuota(
          req.user.tenantId,
          quotaType,
          requestedAmount
        );

        // If unlimited and skipOnUnlimited is true, skip quota check
        if (skipOnUnlimited && quotaResult.limit === -1) {
          req.quotaCheck = quotaResult;
          return next();
        }

        // If quota exceeded, return error
        if (!quotaResult.allowed) {
          return res.status(429).json({
            success: false,
            error: {
              code: 'QUOTA_EXCEEDED',
              message: this.getQuotaExceededMessage(quotaResult),
              details: {
                quotaType: quotaResult.quotaType,
                currentUsage: quotaResult.currentUsage,
                limit: quotaResult.limit,
                resetDate: quotaResult.resetDate,
                upgradeRequired: true
              }
            }
          });
        }

        // Attach quota check result to request for further processing
        req.quotaCheck = quotaResult;
        next();
      } catch (error) {
        console.error('Quota check error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'QUOTA_CHECK_FAILED',
            message: 'Failed to check quota limits'
          }
        });
      }
    };
  }

  /**
   * Middleware to track usage after successful action
   */
  trackUsage(options: { 
    quotaType: 'daily_emails' | 'monthly_emails' | 'monthly_recipients' | 'templates' | 'custom_domains';
    getAmount?: (req: QuotaRequest) => number;
  }) {
    return async (req: QuotaRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.tenantId) {
          return next();
        }

        const { quotaType, getAmount } = options;
        const amount = getAmount ? getAmount(req) : 1;

        // Track the usage
        await this.subscriptionService.trackUsage({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          emailsSent: quotaType.includes('emails') ? amount : 0,
          recipientsReached: quotaType === 'monthly_recipients' ? amount : 0,
          templatesCreated: quotaType === 'templates' ? amount : 0,
          customDomainsUsed: quotaType === 'custom_domains' ? amount : 0,
          timestamp: new Date()
        });

        next();
      } catch (error) {
        console.error('Usage tracking error:', error);
        // Don't fail the request if usage tracking fails
        next();
      }
    };
  }

  /**
   * Combined middleware for quota check and usage tracking
   */
  enforceQuota(options: QuotaMiddlewareOptions & { 
    trackAfter?: boolean;
    getAmount?: (req: QuotaRequest) => number;
  }) {
    const { trackAfter = true, getAmount, ...quotaOptions } = options;
    
    const middlewares = [this.checkQuota(quotaOptions)];
    
    if (trackAfter) {
      middlewares.push(this.trackUsage({
        quotaType: quotaOptions.quotaType,
        getAmount
      }));
    }

    return middlewares;
  }

  /**
   * Get user-friendly quota exceeded message
   */
  private getQuotaExceededMessage(quotaResult: QuotaCheckResult): string {
    const { quotaType, currentUsage, limit, resetDate } = quotaResult;
    
    const resetInfo = resetDate ? ` Resets on ${resetDate.toLocaleDateString()}.` : '';
    
    switch (quotaType) {
      case 'daily_emails':
        return `Daily email limit exceeded (${currentUsage}/${limit}).${resetInfo} Upgrade your plan for higher limits.`;
      case 'monthly_emails':
        return `Monthly email limit exceeded (${currentUsage}/${limit}).${resetInfo} Upgrade your plan or add recharge balance.`;
      case 'monthly_recipients':
        return `Monthly recipient limit exceeded (${currentUsage}/${limit}).${resetInfo} Upgrade your plan for more recipients.`;
      case 'templates':
        return `Daily template creation limit exceeded (${currentUsage}/${limit}).${resetInfo} Upgrade your plan for more templates.`;
      case 'custom_domains':
        return `Custom domain limit exceeded (${currentUsage}/${limit}). Upgrade to Premium or Enterprise for custom domains.`;
      default:
        return `Usage limit exceeded (${currentUsage}/${limit}). Please upgrade your plan.`;
    }
  }
}

/**
 * Factory function to create quota middleware with subscription service
 */
export function createQuotaMiddleware(subscriptionService: SubscriptionService): QuotaMiddleware {
  return new QuotaMiddleware(subscriptionService);
}

/**
 * Utility function to extract email count from request body
 */
export function getEmailCountFromRequest(req: QuotaRequest): number {
  // For single email
  if (req.body.email || req.body.to) {
    return 1;
  }
  
  // For bulk emails
  if (req.body.emails && Array.isArray(req.body.emails)) {
    return req.body.emails.length;
  }
  
  // For campaign with recipient lists
  if (req.body.listIds && Array.isArray(req.body.listIds)) {
    // This would need to be calculated based on actual list sizes
    // For now, return 1 as placeholder
    return 1;
  }
  
  return 1;
}

/**
 * Utility function to extract recipient count from request body
 */
export function getRecipientCountFromRequest(req: QuotaRequest): number {
  // For contact import
  if (req.body.contacts && Array.isArray(req.body.contacts)) {
    return req.body.contacts.length;
  }
  
  // For single contact
  if (req.body.email) {
    return 1;
  }
  
  return 1;
}

// Create and export quota middleware instance
const subscriptionService = new SubscriptionService();
const quotaMiddlewareInstance = new QuotaMiddleware(subscriptionService);

// Export quota middleware function
export const quotaMiddleware = (quotaType: string) => {
  const quotaTypeMap: { [key: string]: 'daily_emails' | 'monthly_emails' | 'monthly_recipients' | 'templates' | 'custom_domains' } = {
    'template_generation': 'templates',
    'email_send': 'daily_emails',
    'bulk_email': 'monthly_emails',
    'recipients': 'monthly_recipients',
    'custom_domain': 'custom_domains'
  };

  const mappedQuotaType = quotaTypeMap[quotaType] || 'templates';
  
  return quotaMiddlewareInstance.checkQuota({
    quotaType: mappedQuotaType,
    requestedAmount: 1,
    skipOnUnlimited: true
  });
};