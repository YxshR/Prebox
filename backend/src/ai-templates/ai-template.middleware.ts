import { Request, Response, NextFunction } from 'express';
import { AITemplateService } from './ai-template.service';
import { SubscriptionService } from '../billing/subscription.service';
import { ApiResponse } from '../shared/types';

export class AITemplateMiddleware {
  private aiTemplateService: AITemplateService;

  constructor(aiTemplateService: AITemplateService) {
    this.aiTemplateService = aiTemplateService;
  }

  /**
   * Middleware to check if user can generate AI templates
   */
  async checkTemplateQuota(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Tenant ID not found in request'
          }
        } as ApiResponse);
        return;
      }

      const canGenerate = await this.aiTemplateService.validateTemplateQuota(tenantId);
      
      if (!canGenerate) {
        const usage = await this.aiTemplateService.getTemplateUsage(tenantId);
        
        res.status(429).json({
          success: false,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: 'Template generation quota exceeded for current subscription tier',
            details: {
              dailyUsage: usage.dailyUsage,
              dailyLimit: usage.limits.dailyLimit,
              tier: usage.tier,
              hasUnlimitedAccess: usage.limits.hasUnlimitedAccess
            }
          }
        } as ApiResponse);
        return;
      }

      next();
    } catch (error) {
      console.error('Template quota check error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'QUOTA_CHECK_FAILED',
          message: 'Failed to validate template quota'
        }
      } as ApiResponse);
    }
  }

  /**
   * Middleware to validate AI template feature is enabled
   */
  async checkFeatureEnabled(req: Request, res: Response, next: NextFunction): Promise<void> {
    const aiTemplatesEnabled = process.env.ENABLE_AI_TEMPLATES === 'true';
    
    if (!aiTemplatesEnabled) {
      res.status(503).json({
        success: false,
        error: {
          code: 'FEATURE_DISABLED',
          message: 'AI template generation is currently disabled'
        }
      } as ApiResponse);
      return;
    }

    next();
  }

  /**
   * Middleware to validate request size for AI generation
   */
  validateRequestSize(req: Request, res: Response, next: NextFunction): void {
    const maxPromptLength = 1000;
    const maxContextLength = 500;

    if (req.body.prompt && req.body.prompt.length > maxPromptLength) {
      res.status(400).json({
        success: false,
        error: {
          code: 'PROMPT_TOO_LONG',
          message: `Prompt exceeds maximum length of ${maxPromptLength} characters`
        }
      } as ApiResponse);
      return;
    }

    if (req.body.additionalContext && req.body.additionalContext.length > maxContextLength) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CONTEXT_TOO_LONG',
          message: `Additional context exceeds maximum length of ${maxContextLength} characters`
        }
      } as ApiResponse);
      return;
    }

    next();
  }
}

// Factory function to create middleware with dependencies
export function createAITemplateMiddleware(): AITemplateMiddleware {
  const subscriptionService = new SubscriptionService();
  const aiTemplateService = new AITemplateService(subscriptionService);
  return new AITemplateMiddleware(aiTemplateService);
}

// Export individual middleware functions for easier use
export const aiTemplateMiddleware = createAITemplateMiddleware();

export const checkTemplateQuota = aiTemplateMiddleware.checkTemplateQuota.bind(aiTemplateMiddleware);
export const checkFeatureEnabled = aiTemplateMiddleware.checkFeatureEnabled.bind(aiTemplateMiddleware);
export const validateRequestSize = aiTemplateMiddleware.validateRequestSize.bind(aiTemplateMiddleware);