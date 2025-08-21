import Bull from 'bull';
import redisClient from '../../config/redis';
import { EmailJob, EmailSendResult, QueueConfig, EmailStatus } from '../types';
import { EmailService } from '../email.service';

interface BatchJobData {
  jobs: EmailJob[];
  campaignId?: string;
}

interface CampaignTrackingCallback {
  onEmailSent?: (campaignId: string, emailJob: EmailJob, result: EmailSendResult) => Promise<void>;
  onEmailFailed?: (campaignId: string, emailJob: EmailJob, error: Error) => Promise<void>;
  onBatchCompleted?: (campaignId: string, results: EmailSendResult[]) => Promise<void>;
}

export class EmailQueue {
  private queue: Bull.Queue;
  private emailService: EmailService;
  private campaignCallbacks: CampaignTrackingCallback = {};

  constructor(emailService: EmailService, config?: Partial<QueueConfig>) {
    const queueConfig: QueueConfig = {
      name: 'email-processing',
      concurrency: 5,
      retryAttempts: 3,
      retryDelay: 5000,
      removeOnComplete: 100,
      removeOnFail: 50,
      ...config
    };

    this.emailService = emailService;
    
    // Create Bull queue with Redis connection
    this.queue = new Bull(queueConfig.name, {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        attempts: queueConfig.retryAttempts,
        backoff: {
          type: 'exponential',
          delay: queueConfig.retryDelay
        },
        removeOnComplete: queueConfig.removeOnComplete,
        removeOnFail: queueConfig.removeOnFail
      }
    });

    this.setupProcessors(queueConfig.concurrency);
    this.setupEventHandlers();
  }

  private setupProcessors(concurrency: number): void {
    // Process single email jobs
    this.queue.process('send-email', concurrency, async (job) => {
      const emailJob = job.data as EmailJob;
      console.log(`Processing email job ${emailJob.id} for ${emailJob.to}`);
      
      try {
        const result = await this.emailService.sendSingleEmail(emailJob);
        
        // Update job progress
        await job.progress(100);
        
        // Trigger campaign callback if this is part of a campaign
        if (emailJob.campaignId && this.campaignCallbacks.onEmailSent) {
          await this.campaignCallbacks.onEmailSent(emailJob.campaignId, emailJob, result);
        }
        
        return result;
      } catch (error) {
        console.error(`Failed to process email job ${emailJob.id}:`, error);
        
        // Trigger campaign failure callback
        if (emailJob.campaignId && this.campaignCallbacks.onEmailFailed) {
          await this.campaignCallbacks.onEmailFailed(emailJob.campaignId, emailJob, error as Error);
        }
        
        throw error;
      }
    });

    // Process batch email jobs
    this.queue.process('send-batch', Math.max(1, Math.floor(concurrency / 2)), async (job) => {
      const batchData = job.data as BatchJobData;
      const emailJobs: EmailJob[] = batchData.jobs;
      const campaignId = batchData.campaignId;
      
      console.log(`Processing batch email job with ${emailJobs.length} emails${campaignId ? ` for campaign ${campaignId}` : ''}`);
      
      try {
        const result = await this.emailService.sendBatchEmails(emailJobs);
        
        // Update progress based on completion
        const progress = Math.round((result.successful / result.totalJobs) * 100);
        await job.progress(progress);
        
        // Trigger campaign batch completion callback
        if (campaignId && this.campaignCallbacks.onBatchCompleted) {
          await this.campaignCallbacks.onBatchCompleted(campaignId, result.results);
        }
        
        return result;
      } catch (error) {
        console.error(`Failed to process batch email job:`, error);
        throw error;
      }
    });

    // Process scheduled email jobs
    this.queue.process('send-scheduled', concurrency, async (job) => {
      const emailJob = job.data as EmailJob;
      console.log(`Processing scheduled email job ${emailJob.id} for ${emailJob.to}`);
      
      try {
        // Check if this is still valid to send (subscription/balance checks would go here)
        const result = await this.emailService.sendSingleEmail(emailJob);
        
        await job.progress(100);
        
        if (emailJob.campaignId && this.campaignCallbacks.onEmailSent) {
          await this.campaignCallbacks.onEmailSent(emailJob.campaignId, emailJob, result);
        }
        
        return result;
      } catch (error) {
        console.error(`Failed to process scheduled email job ${emailJob.id}:`, error);
        
        if (emailJob.campaignId && this.campaignCallbacks.onEmailFailed) {
          await this.campaignCallbacks.onEmailFailed(emailJob.campaignId, emailJob, error as Error);
        }
        
        throw error;
      }
    });
  }

  private setupEventHandlers(): void {
    this.queue.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed successfully`);
    });

    this.queue.on('failed', (job, err) => {
      console.error(`❌ Job ${job.id} failed:`, err.message);
    });

    this.queue.on('stalled', (job) => {
      console.warn(`⚠️ Job ${job.id} stalled`);
    });

    this.queue.on('progress', (job, progress) => {
      console.log(`📊 Job ${job.id} progress: ${progress}%`);
    });
  }

  async addEmailJob(emailJob: EmailJob, options?: Bull.JobOptions): Promise<Bull.Job> {
    const jobOptions: Bull.JobOptions = {
      priority: this.getPriorityValue(emailJob.priority),
      delay: emailJob.scheduledAt ? emailJob.scheduledAt.getTime() - Date.now() : 0,
      ...options
    };

    return this.queue.add('send-email', emailJob, jobOptions);
  }

  async addBatchJob(emailJobs: EmailJob[], campaignId?: string, options?: Bull.JobOptions): Promise<Bull.Job> {
    const jobOptions: Bull.JobOptions = {
      priority: this.getHighestPriority(emailJobs),
      ...options
    };

    const batchData: BatchJobData = {
      jobs: emailJobs,
      campaignId
    };

    return this.queue.add('send-batch', batchData, jobOptions);
  }

  async addScheduledEmailJob(emailJob: EmailJob, scheduledAt: Date, options?: Bull.JobOptions): Promise<Bull.Job> {
    const delay = scheduledAt.getTime() - Date.now();
    
    if (delay <= 0) {
      throw new Error('Scheduled time must be in the future');
    }

    const jobOptions: Bull.JobOptions = {
      priority: this.getPriorityValue(emailJob.priority),
      delay,
      ...options
    };

    return this.queue.add('send-scheduled', emailJob, jobOptions);
  }

  async getJobStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
      this.queue.getDelayed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length
    };
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
  }

  async cleanQueue(grace: number = 5000): Promise<void> {
    await this.queue.clean(grace, 'completed');
    await this.queue.clean(grace, 'failed');
  }

  async closeQueue(): Promise<void> {
    await this.queue.close();
  }

  private getPriorityValue(priority: string): number {
    const priorityMap: Record<string, number> = {
      'critical': 1,
      'high': 2,
      'normal': 3,
      'low': 4
    };
    return priorityMap[priority] || 3;
  }

  private getHighestPriority(jobs: EmailJob[]): number {
    const priorities = jobs.map(job => this.getPriorityValue(job.priority));
    return Math.min(...priorities);
  }

  setCampaignCallbacks(callbacks: CampaignTrackingCallback): void {
    this.campaignCallbacks = callbacks;
  }

  async getJobById(jobId: string): Promise<Bull.Job | null> {
    return this.queue.getJob(jobId);
  }

  async getJobStatus(jobId: string): Promise<{
    id: string;
    status: string;
    progress: number;
    result?: any;
    error?: string;
  } | null> {
    const job = await this.getJobById(jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    
    return {
      id: job.id as string,
      status: state,
      progress: job.progress() as number,
      result: job.returnvalue,
      error: job.failedReason
    };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.getJobById(jobId);
    
    if (!job) {
      return false;
    }

    try {
      await job.remove();
      return true;
    } catch (error) {
      console.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  async retryFailedJob(jobId: string): Promise<Bull.Job | null> {
    const job = await this.getJobById(jobId);
    
    if (!job) {
      return null;
    }

    try {
      await job.retry();
      return job;
    } catch (error) {
      console.error(`Failed to retry job ${jobId}:`, error);
      return null;
    }
  }

  // Getter for the underlying Bull queue (for advanced operations)
  get bullQueue(): Bull.Queue {
    return this.queue;
  }
}