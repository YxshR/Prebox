import { Request, Response } from 'express';
import { AITemplateService } from './ai-template.service';
import { AITemplateRequest, TemplateCustomization } from './ai-template.types';
import { ApiResponse } from '../shared/types';
import { AIConnectivityService } from './ai-connectivity.service';
import Joi from 'joi';

export class AITemplateController {
  private aiTemplateService: AITemplateService;
  private connectivityService: AIConnectivityService;

  constructor(aiTemplateService: AITemplateService) {
    this.aiTemplateService = aiTemplateService;
    this.connectivityService = AIConnectivityService.getInstance();
  }

  async generateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = this.validateGenerateTemplateRequest(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message
          }
        } as ApiResponse);
        return;
      }

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

      const templateRequest: AITemplateRequest = {
        ...value,
        tenantId
      };

      const result = await this.aiTemplateService.generateTemplate(templateRequest);

      res.status(201).json({
        success: true,
        data: result
      } as ApiResponse);

    } catch (error) {
      console.error('Template generation error:', error);
      
      if (error instanceof Error && error.message.includes('quota exceeded')) {
        res.status(429).json({
          success: false,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: error.message
          }
        } as ApiResponse);
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Template generation failed'
        }
      } as ApiResponse);
    }
  }

  async customizeTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = this.validateCustomizeTemplateRequest(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message
          }
        } as ApiResponse);
        return;
      }

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

      const customization: TemplateCustomization = {
        ...value,
        tenantId
      };

      const result = await this.aiTemplateService.customizeTemplate(customization);

      res.status(200).json({
        success: true,
        data: result
      } as ApiResponse);

    } catch (error) {
      console.error('Template customization error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CUSTOMIZATION_FAILED',
          message: error instanceof Error ? error.message : 'Template customization failed'
        }
      } as ApiResponse);
    }
  }

  async getUsageStats(req: Request, res: Response): Promise<void> {
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

      const stats = await this.aiTemplateService.getUsageStats(tenantId);

      res.status(200).json({
        success: true,
        data: stats
      } as ApiResponse);

    } catch (error) {
      console.error('Usage stats error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get usage stats'
        }
      } as ApiResponse);
    }
  }

  async validateQuota(req: Request, res: Response): Promise<void> {
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
      const usage = await this.aiTemplateService.getTemplateUsage(tenantId);

      res.status(200).json({
        success: true,
        data: {
          canGenerate,
          usage: {
            dailyUsage: usage.dailyUsage,
            dailyLimit: usage.limits.dailyLimit,
            monthlyUsage: usage.monthlyUsage,
            monthlyLimit: usage.limits.monthlyLimit,
            hasUnlimitedAccess: usage.limits.hasUnlimitedAccess,
            tier: usage.tier
          }
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Quota validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'QUOTA_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Failed to validate quota'
        }
      } as ApiResponse);
    }
  }

  async getTemplateTypes(req: Request, res: Response): Promise<void> {
    try {
      const types = await this.aiTemplateService.getAvailableTemplateTypes();

      res.status(200).json({
        success: true,
        data: { types }
      } as ApiResponse);

    } catch (error) {
      console.error('Template types error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TYPES_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get template types'
        }
      } as ApiResponse);
    }
  }

  async getTemplateSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const { industry } = req.query;
      const suggestions = await this.aiTemplateService.getTemplateSuggestions(industry as string);

      res.status(200).json({
        success: true,
        data: { suggestions }
      } as ApiResponse);

    } catch (error) {
      console.error('Template suggestions error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SUGGESTIONS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get template suggestions'
        }
      } as ApiResponse);
    }
  }

  async getConnectivityStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.connectivityService.getConnectivityStatus(true);
      const message = this.connectivityService.getStatusMessage(status);

      res.status(200).json({
        success: true,
        data: {
          ...status,
          message,
          featuresAvailable: status.aiServiceStatus === 'available'
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Connectivity status error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CONNECTIVITY_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Failed to check connectivity status'
        }
      } as ApiResponse);
    }
  }

  async checkConnectivity(req: Request, res: Response): Promise<void> {
    try {
      // Force a fresh check (no cache)
      const status = await this.connectivityService.getConnectivityStatus(false);
      const message = this.connectivityService.getStatusMessage(status);

      res.status(200).json({
        success: true,
        data: {
          ...status,
          message,
          featuresAvailable: status.aiServiceStatus === 'available'
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Connectivity check error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CONNECTIVITY_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Failed to perform connectivity check'
        }
      } as ApiResponse);
    }
  }

  async validateApiKeys(req: Request, res: Response): Promise<void> {
    try {
      const validation = await this.connectivityService.validateAIServiceKeys();

      res.status(200).json({
        success: true,
        data: validation
      } as ApiResponse);

    } catch (error) {
      console.error('API key validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'KEY_VALIDATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to validate API keys'
        }
      } as ApiResponse);
    }
  }

  private validateGenerateTemplateRequest(body: any) {
    const schema = Joi.object({
      prompt: Joi.string().required().min(10).max(1000),
      templateType: Joi.string().valid(
        'promotional', 'transactional', 'newsletter', 'welcome', 
        'abandoned_cart', 'product_announcement', 'event_invitation',
        'survey_feedback', 'seasonal_campaign', 'custom'
      ).optional(),
      tone: Joi.string().valid(
        'professional', 'casual', 'friendly', 'formal', 'persuasive'
      ).optional(),
      industry: Joi.string().max(100).optional(),
      targetAudience: Joi.string().max(200).optional(),
      callToAction: Joi.string().max(200).optional(),
      brandName: Joi.string().max(100).optional(),
      additionalContext: Joi.string().max(500).optional()
    });

    return schema.validate(body);
  }

  private validateCustomizeTemplateRequest(body: any) {
    const schema = Joi.object({
      templateId: Joi.string().required(),
      modifications: Joi.object({
        subject: Joi.string().max(200).optional(),
        htmlContent: Joi.string().optional(),
        textContent: Joi.string().optional(),
        variables: Joi.array().items(
          Joi.object({
            name: Joi.string().required(),
            type: Joi.string().valid('text', 'number', 'date', 'boolean').required(),
            required: Joi.boolean().optional()
          })
        ).optional(),
        styling: Joi.object({
          primaryColor: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).optional(),
          secondaryColor: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).optional(),
          fontFamily: Joi.string().max(100).optional(),
          customCss: Joi.string().max(2000).optional()
        }).optional()
      }).required()
    });

    return schema.validate(body);
  }
}