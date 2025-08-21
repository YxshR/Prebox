import { Request, Response } from 'express';
import { ScheduledEmailService } from './scheduled-email.service';
import { ScheduledEmailRequest, ScheduleStatus } from './scheduled-email.types';
import { ApiResponse } from '../shared/types';

export class ScheduledEmailController {
  private scheduledEmailService: ScheduledEmailService;

  constructor() {
    this.scheduledEmailService = new ScheduledEmailService();
  }

  /**
   * Schedule an email for future delivery
   * POST /api/emails/schedule
   */
  async scheduleEmail(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, campaignId, emailJob, scheduledAt, userType } = req.body;

      // Validate required fields
      if (!tenantId || !emailJob || !scheduledAt || !userType) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: tenantId, emailJob, scheduledAt, userType'
          }
        } as ApiResponse);
        return;
      }

      // Validate email job structure
      if (!emailJob.to || !Array.isArray(emailJob.to) || emailJob.to.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'emailJob.to must be a non-empty array of email addresses'
          }
        } as ApiResponse);
        return;
      }

      if (!emailJob.from || !emailJob.subject || !emailJob.htmlContent) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'emailJob must include from, subject, and htmlContent'
          }
        } as ApiResponse);
        return;
      }

      // Validate user type
      if (!['subscription', 'recharge'].includes(userType)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'userType must be either "subscription" or "recharge"'
          }
        } as ApiResponse);
        return;
      }

      const request: ScheduledEmailRequest = {
        tenantId,
        campaignId,
        emailJob,
        scheduledAt: new Date(scheduledAt),
        userType
      };

      const scheduledEmail = await this.scheduledEmailService.scheduleEmail(request);

      res.status(201).json({
        success: true,
        data: scheduledEmail
      } as ApiResponse);

    } catch (error) {
      console.error('Error scheduling email:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SCHEDULING_ERROR',
          message: error instanceof Error ? error.message : 'Failed to schedule email'
        }
      } as ApiResponse);
    }
  }

  /**
   * Cancel a scheduled email
   * DELETE /api/emails/schedule/:scheduleId
   */
  async cancelScheduledEmail(req: Request, res: Response): Promise<void> {
    try {
      const { scheduleId } = req.params;
      const { reason } = req.body;

      if (!scheduleId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Schedule ID is required'
          }
        } as ApiResponse);
        return;
      }

      await this.scheduledEmailService.cancelScheduledEmail(scheduleId, reason);

      res.status(200).json({
        success: true,
        data: { message: 'Scheduled email cancelled successfully' }
      } as ApiResponse);

    } catch (error) {
      console.error('Error cancelling scheduled email:', error);
      
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: 'CANCELLATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to cancel scheduled email'
        }
      } as ApiResponse);
    }
  }

  /**
   * Get scheduled emails for a tenant
   * GET /api/emails/schedule
   */
  async getScheduledEmails(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.query;
      const { status, limit = '50', offset = '0' } = req.query;

      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'tenantId is required'
          }
        } as ApiResponse);
        return;
      }

      const scheduledEmails = await this.scheduledEmailService.getScheduledEmailsByTenant(
        tenantId as string,
        status as ScheduleStatus,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.status(200).json({
        success: true,
        data: scheduledEmails,
        meta: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: scheduledEmails.length
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Error fetching scheduled emails:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch scheduled emails'
        }
      } as ApiResponse);
    }
  }

  /**
   * Get scheduled email statistics
   * GET /api/emails/schedule/stats
   */
  async getScheduledEmailStats(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.query;

      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'tenantId is required'
          }
        } as ApiResponse);
        return;
      }

      const stats = await this.scheduledEmailService.getScheduledEmailStats(tenantId as string);

      res.status(200).json({
        success: true,
        data: stats
      } as ApiResponse);

    } catch (error) {
      console.error('Error fetching scheduled email stats:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch scheduled email statistics'
        }
      } as ApiResponse);
    }
  }

  /**
   * Validate scheduling request
   * POST /api/emails/schedule/validate
   */
  async validateScheduling(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, scheduledAt, userType, recipientCount } = req.body;

      if (!tenantId || !scheduledAt || !userType || !recipientCount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: tenantId, scheduledAt, userType, recipientCount'
          }
        } as ApiResponse);
        return;
      }

      const validation = await this.scheduledEmailService.validateScheduling(
        tenantId,
        new Date(scheduledAt),
        userType,
        recipientCount
      );

      res.status(200).json({
        success: true,
        data: validation
      } as ApiResponse);

    } catch (error) {
      console.error('Error validating scheduling:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to validate scheduling'
        }
      } as ApiResponse);
    }
  }

  /**
   * Manual trigger for scheduled emails (admin only)
   * POST /api/emails/schedule/trigger
   */
  async triggerScheduledEmails(req: Request, res: Response): Promise<void> {
    try {
      const { scheduleIds } = req.body;

      const result = await this.scheduledEmailService.triggerScheduledEmails(scheduleIds);

      res.status(200).json({
        success: true,
        data: result
      } as ApiResponse);

    } catch (error) {
      console.error('Error triggering scheduled emails:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TRIGGER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to trigger scheduled emails'
        }
      } as ApiResponse);
    }
  }

  /**
   * Process scheduled emails (system endpoint)
   * POST /api/emails/schedule/process
   */
  async processScheduledEmails(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.scheduledEmailService.processScheduledEmails();

      res.status(200).json({
        success: true,
        data: result
      } as ApiResponse);

    } catch (error) {
      console.error('Error processing scheduled emails:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Failed to process scheduled emails'
        }
      } as ApiResponse);
    }
  }
}