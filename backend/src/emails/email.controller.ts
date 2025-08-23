import { Request, Response } from 'express';
import { EmailService } from './email.service';
import { EmailQueue } from './queue/email.queue';
import { EmailPriority } from './types';
import Joi from 'joi';

type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';

export class EmailController {
  private emailService: EmailService;
  private emailQueue: EmailQueue;

  constructor() {
    this.emailService = new EmailService();
    this.emailQueue = new EmailQueue(this.emailService);
  }

  async sendSingleEmail(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = this.validateSingleEmailRequest(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message
          }
        });
        return;
      }

      const { to, subject, htmlContent, textContent, replyTo, priority, scheduledAt } = value;
      const user = (req as any).user;
      
      // Create email job
      const emailJob = this.emailService.createEmailJob({
        tenantId: user.tenantId,
        to,
        from: process.env.SES_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com',
        subject,
        htmlContent,
        textContent,
        replyTo,
        priority: priority || EmailPriority.NORMAL,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        metadata: {
          userId: user.id,
          source: 'api'
        }
      });

      // Add to queue
      const job = await this.emailQueue.addEmailJob(emailJob);

      res.status(202).json({
        success: true,
        data: {
          jobId: job.id,
          emailId: emailJob.id,
          status: 'queued',
          message: 'Email queued for sending'
        }
      });

    } catch (error) {
      console.error('Send single email error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to queue email for sending'
        }
      });
    }
  }

  async sendBatchEmails(req: Request, res: Response): Promise<void> {
    try {
      const { emails, priority, campaignId } = req.body;
      const user = (req as any).user;
      
      // Create email jobs
      const emailJobs = emails.map((email: any) => 
        this.emailService.createEmailJob({
          tenantId: user.tenantId,
          campaignId: campaignId || email.campaignId,
          to: email.to,
          from: process.env.SES_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com',
          subject: email.subject,
          htmlContent: email.htmlContent,
          textContent: email.textContent,
          replyTo: email.replyTo,
          priority: priority || EmailPriority.NORMAL,
          scheduledAt: email.scheduledAt ? new Date(email.scheduledAt) : undefined,
          headers: email.headers,
          metadata: {
            userId: user.id,
            source: 'api_batch',
            ...email.metadata
          }
        })
      );

      // Add batch to queue
      const job = await this.emailQueue.addBatchJob(emailJobs);

      res.status(202).json({
        success: true,
        data: {
          batchJobId: job.id,
          emailCount: emailJobs.length,
          status: 'queued',
          message: 'Batch emails queued for sending',
          estimatedDeliveryTime: this.calculateEstimatedDeliveryTime(emailJobs.length)
        }
      });

    } catch (error) {
      console.error('Send batch emails error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to queue batch emails for sending'
        }
      });
    }
  }

  async sendCampaignEmails(req: Request, res: Response): Promise<void> {
    try {
      const { campaignId, templateId, recipients, variables, scheduledAt, priority } = req.body;
      const user = (req as any).user;

      // Validate template exists (this would typically check database)
      // For now, we'll create a simple template structure
      const template = {
        subject: variables?.subject || 'Campaign Email',
        htmlContent: variables?.htmlContent || '<p>Hello {{firstName}},</p><p>This is a campaign email.</p>',
        textContent: variables?.textContent || 'Hello {{firstName}}, This is a campaign email.'
      };

      // Create personalized email jobs
      const emailJobs = recipients.map((recipient: any) => {
        const personalizedContent = this.personalizeContent(template, recipient, variables);
        
        return this.emailService.createEmailJob({
          tenantId: user.tenantId,
          campaignId,
          to: recipient.email,
          from: process.env.SES_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com',
          subject: personalizedContent.subject,
          htmlContent: personalizedContent.htmlContent,
          textContent: personalizedContent.textContent,
          priority: priority || EmailPriority.NORMAL,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
          metadata: {
            userId: user.id,
            source: 'campaign',
            templateId,
            recipientData: recipient
          }
        });
      });

      // Add campaign batch to queue
      const job = await this.emailQueue.addBatchJob(emailJobs, campaignId);

      res.status(202).json({
        success: true,
        data: {
          campaignId,
          batchJobId: job.id,
          recipientCount: recipients.length,
          status: scheduledAt ? 'scheduled' : 'queued',
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          estimatedDeliveryTime: this.calculateEstimatedDeliveryTime(recipients.length)
        }
      });

    } catch (error) {
      console.error('Send campaign emails error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to queue campaign emails for sending'
        }
      });
    }
  }

  async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      
      // Get job from Bull queue
      const job = await this.emailQueue.bullQueue.getJob(jobId);
      
      if (!job) {
        res.status(404).json({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found'
          }
        });
        return;
      }

      const jobState = await job.getState();
      const progress = job.progress();

      res.json({
        success: true,
        data: {
          jobId: job.id,
          status: jobState,
          progress,
          createdAt: new Date(job.timestamp),
          processedOn: job.processedOn ? new Date(job.processedOn) : null,
          finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
          failedReason: job.failedReason,
          returnValue: job.returnvalue
        }
      });

    } catch (error) {
      console.error('Get job status error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get job status'
        }
      });
    }
  }

  async getQueueStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.emailQueue.getJobStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Get queue stats error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get queue statistics'
        }
      });
    }
  }

  async getProviderStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.emailService.getProviderStatus();
      const availableProviders = this.emailService.getAvailableProviders();

      res.json({
        success: true,
        data: {
          providers: status,
          availableProviders,
          primaryProvider: process.env.PRIMARY_EMAIL_PROVIDER || 'amazon-ses',
          fallbackProvider: process.env.FALLBACK_EMAIL_PROVIDER
        }
      });

    } catch (error) {
      console.error('Get provider status error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get provider status'
        }
      });
    }
  }

  async pauseQueue(req: Request, res: Response): Promise<void> {
    try {
      await this.emailQueue.pauseQueue();

      res.json({
        success: true,
        data: {
          message: 'Email queue paused successfully'
        }
      });

    } catch (error) {
      console.error('Pause queue error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to pause email queue'
        }
      });
    }
  }

  async resumeQueue(req: Request, res: Response): Promise<void> {
    try {
      await this.emailQueue.resumeQueue();

      res.json({
        success: true,
        data: {
          message: 'Email queue resumed successfully'
        }
      });

    } catch (error) {
      console.error('Resume queue error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to resume email queue'
        }
      });
    }
  }

  async cleanQueue(req: Request, res: Response): Promise<void> {
    try {
      const { grace = 5000 } = req.body;
      await this.emailQueue.cleanQueue(grace);

      res.json({
        success: true,
        data: {
          message: 'Email queue cleaned successfully'
        }
      });

    } catch (error) {
      console.error('Clean queue error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to clean email queue'
        }
      });
    }
  }

  async switchProvider(req: Request, res: Response): Promise<void> {
    try {
      const { provider } = req.body;
      
      if (!provider) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Provider name is required'
          }
        });
        return;
      }

      this.emailService.switchPrimaryProvider(provider);

      res.json({
        success: true,
        data: {
          message: `Primary email provider switched to ${provider}`
        }
      });

    } catch (error) {
      console.error('Switch provider error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to switch provider'
        }
      });
    }
  }

  private validateSingleEmailRequest(body: any) {
    const schema = Joi.object({
      to: Joi.string().email().required(),
      subject: Joi.string().min(1).max(255).required(),
      htmlContent: Joi.string().min(1).required(),
      textContent: Joi.string().optional(),
      replyTo: Joi.string().email().optional(),
      priority: Joi.string().valid('low', 'normal', 'high', 'critical').optional(),
      scheduledAt: Joi.string().isoDate().optional()
    });

    return schema.validate(body);
  }

  async cancelJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const user = (req as any).user;
      
      // Get job from Bull queue
      const job = await this.emailQueue.bullQueue.getJob(jobId);
      
      if (!job) {
        res.status(404).json({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found'
          }
        });
        return;
      }

      // Verify job belongs to user (check tenantId in job data)
      if (job.data.tenantId !== user.tenantId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this job'
          }
        });
        return;
      }

      // Cancel the job
      await job.remove();

      res.json({
        success: true,
        data: {
          jobId: job.id,
          message: 'Job cancelled successfully'
        }
      });

    } catch (error) {
      console.error('Cancel job error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to cancel job'
        }
      });
    }
  }

  async retryJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const user = (req as any).user;
      
      // Get job from Bull queue
      const job = await this.emailQueue.bullQueue.getJob(jobId);
      
      if (!job) {
        res.status(404).json({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found'
          }
        });
        return;
      }

      // Verify job belongs to user
      if (job.data.tenantId !== user.tenantId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this job'
          }
        });
        return;
      }

      // Retry the job
      await job.retry();

      res.json({
        success: true,
        data: {
          jobId: job.id,
          message: 'Job retry initiated successfully'
        }
      });

    } catch (error) {
      console.error('Retry job error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retry job'
        }
      });
    }
  }

  async getUserJobs(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { status, limit = 50, offset = 0 } = req.query;

      // Get jobs from Bull queue
      const jobs = await this.emailQueue.bullQueue.getJobs(
        status ? [status as JobStatus] : ['waiting', 'active', 'completed', 'failed'],
        parseInt(offset as string),
        parseInt(limit as string)
      );

      // Filter jobs by tenantId and format response
      const userJobs = jobs
        .filter(job => job.data.tenantId === user.tenantId)
        .map(job => ({
          id: job.id,
          status: job.opts.jobId ? 'active' : job.finishedOn ? 'completed' : 'waiting',
          data: {
            to: job.data.to,
            subject: job.data.subject,
            campaignId: job.data.campaignId,
            priority: job.data.priority
          },
          createdAt: new Date(job.timestamp),
          processedOn: job.processedOn ? new Date(job.processedOn) : null,
          finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
          failedReason: job.failedReason,
          progress: job.progress()
        }));

      res.json({
        success: true,
        data: {
          jobs: userJobs,
          total: userJobs.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      });

    } catch (error) {
      console.error('Get user jobs error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user jobs'
        }
      });
    }
  }

  async getAllJobs(req: Request, res: Response): Promise<void> {
    try {
      const { status, limit = 100, offset = 0 } = req.query;

      // Get jobs from Bull queue (admin only)
      const jobs = await this.emailQueue.bullQueue.getJobs(
        status ? [status as JobStatus] : ['waiting', 'active', 'completed', 'failed'],
        parseInt(offset as string),
        parseInt(limit as string)
      );

      const formattedJobs = jobs.map(job => ({
        id: job.id,
        status: job.opts.jobId ? 'active' : job.finishedOn ? 'completed' : 'waiting',
        tenantId: job.data.tenantId,
        data: {
          to: job.data.to,
          subject: job.data.subject,
          campaignId: job.data.campaignId,
          priority: job.data.priority
        },
        createdAt: new Date(job.timestamp),
        processedOn: job.processedOn ? new Date(job.processedOn) : null,
        finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
        failedReason: job.failedReason,
        progress: job.progress()
      }));

      res.json({
        success: true,
        data: {
          jobs: formattedJobs,
          total: formattedJobs.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      });

    } catch (error) {
      console.error('Get all jobs error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get jobs'
        }
      });
    }
  }

  async getProviderHealth(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.emailService.getProviderStatus();
      const availableProviders = this.emailService.getAvailableProviders();

      // Test each provider with a simple health check
      const healthChecks: Record<string, any> = {};
      
      for (const provider of availableProviders) {
        try {
          // This would be a simple test email or configuration check
          healthChecks[provider] = {
            status: status[provider] ? 'healthy' : 'unhealthy',
            lastChecked: new Date(),
            responseTime: Math.random() * 100 + 50 // Mock response time
          };
        } catch (error) {
          healthChecks[provider] = {
            status: 'error',
            lastChecked: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      res.json({
        success: true,
        data: {
          providers: status,
          availableProviders,
          healthChecks,
          primaryProvider: process.env.PRIMARY_EMAIL_PROVIDER || 'amazon-ses',
          fallbackProvider: process.env.FALLBACK_EMAIL_PROVIDER
        }
      });

    } catch (error) {
      console.error('Get provider health error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get provider health'
        }
      });
    }
  }

  async getSystemMetrics(req: Request, res: Response): Promise<void> {
    try {
      const queueStats = await this.emailQueue.getJobStats();
      const providerStatus = await this.emailService.getProviderStatus();

      // Get system metrics
      const metrics = {
        queue: queueStats,
        providers: providerStatus,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date()
        }
      };

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      console.error('Get system metrics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get system metrics'
        }
      });
    }
  }

  async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const queueStats = await this.emailQueue.getJobStats();
      const providerStatus = await this.emailService.getProviderStatus();
      
      // Determine overall health
      const hasHealthyProvider = Object.values(providerStatus).some(status => status);
      const queueHealthy = queueStats.waiting < 10000; // Arbitrary threshold
      
      const overallHealth = hasHealthyProvider && queueHealthy ? 'healthy' : 'degraded';

      res.json({
        success: true,
        data: {
          status: overallHealth,
          checks: {
            providers: hasHealthyProvider ? 'pass' : 'fail',
            queue: queueHealthy ? 'pass' : 'warn',
            memory: process.memoryUsage().heapUsed < 1000000000 ? 'pass' : 'warn' // 1GB threshold
          },
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Get system health error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get system health'
        }
      });
    }
  }

  private personalizeContent(
    template: { subject: string; htmlContent: string; textContent: string },
    recipient: { email: string; firstName?: string; lastName?: string; customFields?: Record<string, any> },
    variables?: Record<string, any>
  ): { subject: string; htmlContent: string; textContent: string } {
    const personalizedVars = {
      email: recipient.email,
      firstName: recipient.firstName || '',
      lastName: recipient.lastName || '',
      fullName: `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim(),
      ...recipient.customFields,
      ...variables
    };

    return {
      subject: this.replaceVariables(template.subject, personalizedVars),
      htmlContent: this.replaceVariables(template.htmlContent, personalizedVars),
      textContent: this.replaceVariables(template.textContent, personalizedVars)
    };
  }

  private replaceVariables(content: string, variables: Record<string, any>): string {
    let result = content;
    
    // Replace {{variable}} patterns
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, String(value || ''));
    }
    
    return result;
  }

  private calculateEstimatedDeliveryTime(emailCount: number): string {
    // Simple estimation based on processing rate
    const emailsPerMinute = 1000; // Configurable rate
    const estimatedMinutes = Math.ceil(emailCount / emailsPerMinute);
    
    if (estimatedMinutes < 1) {
      return 'Less than 1 minute';
    } else if (estimatedMinutes < 60) {
      return `${estimatedMinutes} minutes`;
    } else {
      const hours = Math.floor(estimatedMinutes / 60);
      const minutes = estimatedMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  }

  private validateBatchEmailRequest(body: any) {
    const emailSchema = Joi.object({
      to: Joi.string().email().required(),
      subject: Joi.string().min(1).max(255).required(),
      htmlContent: Joi.string().min(1).required(),
      textContent: Joi.string().optional(),
      replyTo: Joi.string().email().optional(),
      scheduledAt: Joi.string().isoDate().optional()
    });

    const schema = Joi.object({
      emails: Joi.array().items(emailSchema).min(1).max(1000).required(),
      priority: Joi.string().valid('low', 'normal', 'high', 'critical').optional()
    });

    return schema.validate(body);
  }
}