import { Request, Response } from 'express';
import { CampaignService, CreateCampaignRequest, CreateTemplateRequest, CampaignSendRequest } from './campaign.service';
import { EmailService } from '../emails/email.service';
import { CampaignStatus } from '../shared/types';
import { ApiResponse } from '../shared/types';

export class CampaignController {
  private campaignService: CampaignService;

  constructor() {
    const emailService = new EmailService();
    this.campaignService = new CampaignService(emailService);
  }

  // Template Management
  createTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any; // From auth middleware
      const templateData: CreateTemplateRequest = {
        tenantId,
        ...req.body
      };

      const template = await this.campaignService.createTemplate(templateData);

      const response: ApiResponse = {
        success: true,
        data: template
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating template:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TEMPLATE_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create template'
        }
      };
      res.status(400).json(response);
    }
  };

  getTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { templateId } = req.params;

      const template = await this.campaignService.getTemplate(templateId, tenantId);

      if (!template) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Template not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: template
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting template:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TEMPLATE_FETCH_FAILED',
          message: 'Failed to fetch template'
        }
      };
      res.status(500).json(response);
    }
  };

  listTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const templates = await this.campaignService.listTemplates(tenantId);

      const response: ApiResponse = {
        success: true,
        data: templates,
        meta: {
          total: templates.length
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error listing templates:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TEMPLATES_FETCH_FAILED',
          message: 'Failed to fetch templates'
        }
      };
      res.status(500).json(response);
    }
  };

  updateTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { templateId } = req.params;

      const template = await this.campaignService.updateTemplate(templateId, tenantId, req.body);

      if (!template) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Template not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: template
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating template:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TEMPLATE_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to update template'
        }
      };
      res.status(400).json(response);
    }
  };

  // Campaign Management
  createCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const campaignData: CreateCampaignRequest = {
        tenantId,
        ...req.body
      };

      const campaign = await this.campaignService.createCampaign(campaignData);

      const response: ApiResponse = {
        success: true,
        data: campaign
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating campaign:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGN_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create campaign'
        }
      };
      res.status(400).json(response);
    }
  };

  getCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { campaignId } = req.params;

      const campaign = await this.campaignService.getCampaign(campaignId, tenantId);

      if (!campaign) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'CAMPAIGN_NOT_FOUND',
            message: 'Campaign not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: campaign
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting campaign:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGN_FETCH_FAILED',
          message: 'Failed to fetch campaign'
        }
      };
      res.status(500).json(response);
    }
  };

  listCampaigns = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const campaigns = await this.campaignService.listCampaigns(tenantId);

      const response: ApiResponse = {
        success: true,
        data: campaigns,
        meta: {
          total: campaigns.length
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error listing campaigns:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGNS_FETCH_FAILED',
          message: 'Failed to fetch campaigns'
        }
      };
      res.status(500).json(response);
    }
  };

  sendCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const sendRequest: CampaignSendRequest = {
        campaignId,
        ...req.body
      };

      const result = await this.campaignService.sendCampaign(sendRequest);

      const response: ApiResponse = {
        success: true,
        data: result
      };

      res.json(response);
    } catch (error) {
      console.error('Error sending campaign:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGN_SEND_FAILED',
          message: error instanceof Error ? error.message : 'Failed to send campaign'
        }
      };
      res.status(400).json(response);
    }
  };

  scheduleCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { campaignId } = req.params;
      const { scheduledAt } = req.body;

      if (!scheduledAt) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'MISSING_SCHEDULED_TIME',
            message: 'scheduledAt is required'
          }
        };
        res.status(400).json(response);
        return;
      }

      const campaign = await this.campaignService.scheduleCampaign(
        campaignId,
        tenantId,
        new Date(scheduledAt)
      );

      if (!campaign) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'CAMPAIGN_NOT_FOUND',
            message: 'Campaign not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: campaign
      };

      res.json(response);
    } catch (error) {
      console.error('Error scheduling campaign:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGN_SCHEDULE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to schedule campaign'
        }
      };
      res.status(400).json(response);
    }
  };

  updateCampaignStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { campaignId } = req.params;
      const { status } = req.body;

      if (!Object.values(CampaignStatus).includes(status)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Invalid status. Must be one of: ${Object.values(CampaignStatus).join(', ')}`
          }
        };
        res.status(400).json(response);
        return;
      }

      const campaign = await this.campaignService.updateCampaignStatus(campaignId, tenantId, status);

      if (!campaign) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'CAMPAIGN_NOT_FOUND',
            message: 'Campaign not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: campaign
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating campaign status:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGN_STATUS_UPDATE_FAILED',
          message: 'Failed to update campaign status'
        }
      };
      res.status(500).json(response);
    }
  };

  // Campaign Analytics and Monitoring
  getCampaignMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { campaignId } = req.params;

      const metrics = await this.campaignService.getCampaignMetrics(campaignId, tenantId);

      if (!metrics) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'CAMPAIGN_NOT_FOUND',
            message: 'Campaign not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: metrics
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting campaign metrics:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'METRICS_FETCH_FAILED',
          message: 'Failed to fetch campaign metrics'
        }
      };
      res.status(500).json(response);
    }
  };

  getQueueStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.campaignService.getQueueStats();

      const response: ApiResponse = {
        success: true,
        data: stats
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting queue stats:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'QUEUE_STATS_FAILED',
          message: 'Failed to fetch queue statistics'
        }
      };
      res.status(500).json(response);
    }
  };

  getJobStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const status = await this.campaignService.getJobStatus(jobId);

      if (!status) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found'
          }
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: status
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting job status:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'JOB_STATUS_FAILED',
          message: 'Failed to fetch job status'
        }
      };
      res.status(500).json(response);
    }
  };

  cancelJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const cancelled = await this.campaignService.cancelCampaignJob(jobId);

      const response: ApiResponse = {
        success: cancelled,
        data: { cancelled }
      };

      if (!cancelled) {
        response.error = {
          code: 'JOB_CANCEL_FAILED',
          message: 'Failed to cancel job'
        };
        res.status(400).json(response);
      } else {
        res.json(response);
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'JOB_CANCEL_ERROR',
          message: 'Error cancelling job'
        }
      };
      res.status(500).json(response);
    }
  };

  retryJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const job = await this.campaignService.retryCampaignJob(jobId);

      if (!job) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'JOB_RETRY_FAILED',
            message: 'Failed to retry job'
          }
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { jobId: job.id, status: 'retrying' }
      };

      res.json(response);
    } catch (error) {
      console.error('Error retrying job:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'JOB_RETRY_ERROR',
          message: 'Error retrying job'
        }
      };
      res.status(500).json(response);
    }
  };

  // Missing methods - adding placeholder implementations
  getCampaignEvents = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { campaignId } = req.params;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { events: [], campaignId }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting campaign events:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGN_EVENTS_ERROR',
          message: 'Error retrieving campaign events'
        }
      };
      res.status(500).json(response);
    }
  };

  getCampaignRecipients = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { campaignId } = req.params;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { recipients: [], campaignId }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting campaign recipients:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGN_RECIPIENTS_ERROR',
          message: 'Error retrieving campaign recipients'
        }
      };
      res.status(500).json(response);
    }
  };

  pauseCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { campaignId } = req.params;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { campaignId, status: 'paused' }
      };

      res.json(response);
    } catch (error) {
      console.error('Error pausing campaign:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGN_PAUSE_ERROR',
          message: 'Error pausing campaign'
        }
      };
      res.status(500).json(response);
    }
  };

  resumeCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { campaignId } = req.params;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { campaignId, status: 'resumed' }
      };

      res.json(response);
    } catch (error) {
      console.error('Error resuming campaign:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGN_RESUME_ERROR',
          message: 'Error resuming campaign'
        }
      };
      res.status(500).json(response);
    }
  };

  cancelCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { campaignId } = req.params;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { campaignId, status: 'cancelled' }
      };

      res.json(response);
    } catch (error) {
      console.error('Error cancelling campaign:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGN_CANCEL_ERROR',
          message: 'Error cancelling campaign'
        }
      };
      res.status(500).json(response);
    }
  };

  duplicateCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { campaignId } = req.params;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { originalCampaignId: campaignId, newCampaignId: `${campaignId}_copy` }
      };

      res.json(response);
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGN_DUPLICATE_ERROR',
          message: 'Error duplicating campaign'
        }
      };
      res.status(500).json(response);
    }
  };

  sendMultipleCampaigns = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { campaignIds } = req.body;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { campaignIds, status: 'queued' }
      };

      res.json(response);
    } catch (error) {
      console.error('Error sending multiple campaigns:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'BULK_SEND_ERROR',
          message: 'Error sending multiple campaigns'
        }
      };
      res.status(500).json(response);
    }
  };

  scheduleMultipleCampaigns = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { campaignIds, scheduledAt } = req.body;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { campaignIds, scheduledAt, status: 'scheduled' }
      };

      res.json(response);
    } catch (error) {
      console.error('Error scheduling multiple campaigns:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'BULK_SCHEDULE_ERROR',
          message: 'Error scheduling multiple campaigns'
        }
      };
      res.status(500).json(response);
    }
  };

  deleteTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { templateId } = req.params;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { templateId, status: 'deleted' }
      };

      res.json(response);
    } catch (error) {
      console.error('Error deleting template:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TEMPLATE_DELETE_ERROR',
          message: 'Error deleting template'
        }
      };
      res.status(500).json(response);
    }
  };

  duplicateTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { templateId } = req.params;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { originalTemplateId: templateId, newTemplateId: `${templateId}_copy` }
      };

      res.json(response);
    } catch (error) {
      console.error('Error duplicating template:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TEMPLATE_DUPLICATE_ERROR',
          message: 'Error duplicating template'
        }
      };
      res.status(500).json(response);
    }
  };

  previewTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { templateId } = req.params;
      const { variables } = req.body;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { 
          templateId, 
          preview: '<html><body>Template preview</body></html>',
          variables 
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error previewing template:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TEMPLATE_PREVIEW_ERROR',
          message: 'Error previewing template'
        }
      };
      res.status(500).json(response);
    }
  };

  getCampaignOverview = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { 
          totalCampaigns: 0,
          activeCampaigns: 0,
          totalEmailsSent: 0,
          averageOpenRate: 0
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting campaign overview:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CAMPAIGN_OVERVIEW_ERROR',
          message: 'Error retrieving campaign overview'
        }
      };
      res.status(500).json(response);
    }
  };

  getPerformanceStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;

      // Placeholder implementation
      const response: ApiResponse = {
        success: true,
        data: { 
          deliveryRate: 0,
          openRate: 0,
          clickRate: 0,
          bounceRate: 0
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting performance stats:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'PERFORMANCE_STATS_ERROR',
          message: 'Error retrieving performance statistics'
        }
      };
      res.status(500).json(response);
    }
  };
}