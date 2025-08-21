import { 
  ScheduledEmail, 
  ScheduledEmailRequest, 
  ScheduleStatus, 
  ScheduleValidationResult,
  ProcessScheduledEmailsResult,
  SchedulingLimits
} from './scheduled-email.types';
import { EmailService } from './email.service';
import { SubscriptionService } from '../billing/subscription.service';
import { WalletService } from '../billing/wallet.service';
import { SubscriptionTier, BillingSubscriptionStatus } from '../shared/types';
import pool from '../config/database';

export class ScheduledEmailService {
  private emailService: EmailService;
  private subscriptionService: SubscriptionService;
  private walletService: WalletService;

  constructor() {
    this.emailService = new EmailService();
    this.subscriptionService = new SubscriptionService();
    this.walletService = new WalletService();
  }

  /**
   * Schedule an email for future delivery
   * Requirements: 17.1 - Allow scheduling up to 14 days for subscription users, unlimited for recharge users
   */
  async scheduleEmail(request: ScheduledEmailRequest): Promise<ScheduledEmail> {
    const { tenantId, campaignId, emailJob, scheduledAt, userType } = request;

    // Validate scheduling request
    const validation = await this.validateScheduling(tenantId, scheduledAt, userType, emailJob.to.length);
    if (!validation.isValid) {
      throw new Error(`Scheduling validation failed: ${validation.reason}`);
    }

    // Create scheduled email record
    const scheduledEmail: ScheduledEmail = {
      id: this.generateScheduleId(),
      tenantId,
      campaignId,
      emailJob,
      scheduledAt,
      status: ScheduleStatus.PENDING,
      userType,
      estimatedCost: validation.estimatedCost,
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      maxRetries: 3
    };

    // Save to database
    await this.saveScheduledEmail(scheduledEmail);

    console.log(`Scheduled email ${scheduledEmail.id} for ${scheduledAt.toISOString()}`);
    return scheduledEmail;
  }

  /**
   * Cancel a scheduled email
   */
  async cancelScheduledEmail(scheduleId: string, reason?: string): Promise<void> {
    const scheduledEmail = await this.getScheduledEmailById(scheduleId);
    if (!scheduledEmail) {
      throw new Error('Scheduled email not found');
    }

    if (scheduledEmail.status !== ScheduleStatus.PENDING) {
      throw new Error(`Cannot cancel email with status: ${scheduledEmail.status}`);
    }

    // Update status to cancelled
    await this.updateScheduledEmailStatus(scheduleId, ScheduleStatus.CANCELLED, reason);

    console.log(`Cancelled scheduled email ${scheduleId}. Reason: ${reason || 'User requested'}`);
  }

  /**
   * Process scheduled emails that are due for sending
   * Requirements: 17.2 - Automatic email sending without user intervention
   */
  async processScheduledEmails(): Promise<ProcessScheduledEmailsResult> {
    const now = new Date();
    const dueEmails = await this.getDueScheduledEmails(now);

    const result: ProcessScheduledEmailsResult = {
      totalProcessed: dueEmails.length,
      successful: 0,
      failed: 0,
      cancelled: 0,
      errors: []
    };

    for (const scheduledEmail of dueEmails) {
      try {
        await this.processSingleScheduledEmail(scheduledEmail);
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          scheduleId: scheduledEmail.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Update status to failed
        await this.updateScheduledEmailStatus(
          scheduledEmail.id, 
          ScheduleStatus.FAILED, 
          error instanceof Error ? error.message : 'Processing failed'
        );
      }
    }

    console.log(`Processed ${result.totalProcessed} scheduled emails. Success: ${result.successful}, Failed: ${result.failed}`);
    return result;
  }

  /**
   * Manual trigger for scheduled emails (for system recovery)
   * Requirements: 17.5 - Manual execution function
   */
  async triggerScheduledEmails(scheduleIds?: string[]): Promise<ProcessScheduledEmailsResult> {
    let emailsToProcess: ScheduledEmail[];

    if (scheduleIds && scheduleIds.length > 0) {
      // Process specific scheduled emails
      emailsToProcess = await this.getScheduledEmailsByIds(scheduleIds);
    } else {
      // Process all due emails
      const now = new Date();
      emailsToProcess = await this.getDueScheduledEmails(now);
    }

    const result: ProcessScheduledEmailsResult = {
      totalProcessed: emailsToProcess.length,
      successful: 0,
      failed: 0,
      cancelled: 0,
      errors: []
    };

    for (const scheduledEmail of emailsToProcess) {
      try {
        await this.processSingleScheduledEmail(scheduledEmail, true); // Force processing
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          scheduleId: scheduledEmail.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`Manually triggered ${result.totalProcessed} scheduled emails. Success: ${result.successful}, Failed: ${result.failed}`);
    return result;
  }

  /**
   * Validate scheduling limits and requirements
   * Requirements: 17.3, 17.4 - Subscription and balance validation
   */
  async validateScheduling(
    tenantId: string, 
    scheduledAt: Date, 
    userType: 'subscription' | 'recharge',
    recipientCount: number
  ): Promise<ScheduleValidationResult> {
    const now = new Date();
    const daysInAdvance = Math.ceil((scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Check if scheduling date is in the past
    if (scheduledAt <= now) {
      return {
        isValid: false,
        reason: 'Scheduled time must be in the future'
      };
    }

    // Get subscription information
    const subscription = await this.subscriptionService.getSubscriptionByTenantId(tenantId);
    if (!subscription) {
      return {
        isValid: false,
        reason: 'No subscription found for tenant'
      };
    }

    const limits = this.getSchedulingLimits(userType);

    // Validate scheduling limits based on user type
    if (userType === 'subscription') {
      // Requirements 17.3 - Subscription users limited to 14 days in advance
      if (daysInAdvance > limits.maxDaysInAdvance) {
        return {
          isValid: false,
          reason: `Subscription users can only schedule emails up to ${limits.maxDaysInAdvance} days in advance`,
          maxScheduleDate: new Date(now.getTime() + (limits.maxDaysInAdvance * 24 * 60 * 60 * 1000))
        };
      }

      // Check if subscription will be active at scheduled time
      if (subscription.currentPeriodEnd < scheduledAt) {
        return {
          isValid: false,
          reason: 'Subscription will expire before scheduled send time. Please renew subscription or use recharge credits.'
        };
      }

      // Check subscription status
      if (subscription.status !== BillingSubscriptionStatus.ACTIVE) {
        return {
          isValid: false,
          reason: 'Subscription must be active to schedule emails'
        };
      }
    } else {
      // Requirements 17.4 - Recharge users: check wallet balance
      const estimatedCost = this.subscriptionService.calculateRecipientCost(recipientCount);
      const hasSufficientBalance = await this.walletService.hasSufficientBalance(tenantId, estimatedCost);

      if (!hasSufficientBalance) {
        const walletBalance = await this.walletService.getWalletBalance(tenantId);
        return {
          isValid: false,
          reason: `Insufficient wallet balance. Required: ₹${estimatedCost}, Available: ₹${walletBalance.balance}`,
          estimatedCost
        };
      }

      return {
        isValid: true,
        estimatedCost
      };
    }

    return {
      isValid: true
    };
  }

  /**
   * Get scheduling limits based on user type
   */
  private getSchedulingLimits(userType: 'subscription' | 'recharge'): SchedulingLimits {
    if (userType === 'subscription') {
      return {
        maxDaysInAdvance: 14,
        requiresActiveSubscription: true,
        requiresSufficientBalance: false
      };
    } else {
      return {
        maxDaysInAdvance: -1, // Unlimited
        requiresActiveSubscription: false,
        requiresSufficientBalance: true
      };
    }
  }

  /**
   * Process a single scheduled email
   */
  private async processSingleScheduledEmail(scheduledEmail: ScheduledEmail, forceProcess: boolean = false): Promise<void> {
    const { id, tenantId, emailJob, userType, estimatedCost } = scheduledEmail;

    // Update status to processing
    await this.updateScheduledEmailStatus(id, ScheduleStatus.PROCESSING);

    try {
      // Re-validate before sending (unless forced)
      if (!forceProcess) {
        const validation = await this.validateScheduling(tenantId, new Date(), userType, emailJob.to.length);
        if (!validation.isValid) {
          throw new Error(`Pre-send validation failed: ${validation.reason}`);
        }
      }

      // For recharge users, deduct wallet balance
      if (userType === 'recharge' && estimatedCost && estimatedCost > 0) {
        await this.walletService.deductFunds({
          tenantId,
          amount: estimatedCost,
          description: `Scheduled email send - ${emailJob.to.length} recipients`,
          reference: id,
          metadata: {
            scheduleId: id,
            recipientCount: emailJob.to.length,
            scheduledEmailSend: true
          }
        });
      }

      // Send emails
      const emailJobs = emailJob.to.map(recipient => 
        this.emailService.createEmailJob({
          tenantId,
          to: recipient,
          from: emailJob.from,
          subject: emailJob.subject,
          htmlContent: emailJob.htmlContent,
          textContent: emailJob.textContent,
          replyTo: emailJob.replyTo,
          headers: emailJob.headers,
          metadata: {
            ...emailJob.metadata,
            scheduleId: id,
            scheduledSend: true
          }
        })
      );

      // Send batch emails
      const batchResult = await this.emailService.sendBatchEmails(emailJobs);
      
      if (batchResult.failed > 0) {
        console.warn(`Scheduled email ${id}: ${batchResult.failed} out of ${batchResult.totalJobs} emails failed`);
      }

      // Update status to sent
      await this.updateScheduledEmailStatus(id, ScheduleStatus.SENT);
      await this.updateScheduledEmailSentAt(id, new Date());

      console.log(`Successfully processed scheduled email ${id}. Sent: ${batchResult.successful}, Failed: ${batchResult.failed}`);

    } catch (error) {
      // Increment retry count
      await this.incrementRetryCount(id);
      
      const updatedEmail = await this.getScheduledEmailById(id);
      if (updatedEmail && updatedEmail.retryCount >= updatedEmail.maxRetries) {
        // Max retries reached, mark as failed
        await this.updateScheduledEmailStatus(id, ScheduleStatus.FAILED, error instanceof Error ? error.message : 'Max retries exceeded');
      } else {
        // Reset to pending for retry
        await this.updateScheduledEmailStatus(id, ScheduleStatus.PENDING);
      }

      throw error;
    }
  }

  // Database operations

  private async saveScheduledEmail(scheduledEmail: ScheduledEmail): Promise<void> {
    const query = `
      INSERT INTO scheduled_emails (
        id, tenant_id, campaign_id, email_job, scheduled_at, status, 
        user_type, estimated_cost, created_at, updated_at, retry_count, max_retries
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;

    const values = [
      scheduledEmail.id,
      scheduledEmail.tenantId,
      scheduledEmail.campaignId,
      JSON.stringify(scheduledEmail.emailJob),
      scheduledEmail.scheduledAt,
      scheduledEmail.status,
      scheduledEmail.userType,
      scheduledEmail.estimatedCost,
      scheduledEmail.createdAt,
      scheduledEmail.updatedAt,
      scheduledEmail.retryCount,
      scheduledEmail.maxRetries
    ];

    await pool.query(query, values);
  }

  private async getScheduledEmailById(id: string): Promise<ScheduledEmail | null> {
    const query = 'SELECT * FROM scheduled_emails WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToScheduledEmail(result.rows[0]);
  }

  private async getScheduledEmailsByIds(ids: string[]): Promise<ScheduledEmail[]> {
    const query = 'SELECT * FROM scheduled_emails WHERE id = ANY($1)';
    const result = await pool.query(query, [ids]);
    
    return result.rows.map(row => this.mapRowToScheduledEmail(row));
  }

  private async getDueScheduledEmails(currentTime: Date): Promise<ScheduledEmail[]> {
    const query = `
      SELECT * FROM scheduled_emails 
      WHERE status = $1 AND scheduled_at <= $2
      ORDER BY scheduled_at ASC
    `;
    
    const result = await pool.query(query, [ScheduleStatus.PENDING, currentTime]);
    return result.rows.map(row => this.mapRowToScheduledEmail(row));
  }

  private async updateScheduledEmailStatus(id: string, status: ScheduleStatus, failureReason?: string): Promise<void> {
    const query = `
      UPDATE scheduled_emails 
      SET status = $1, updated_at = $2, failure_reason = $3, cancelled_at = $4
      WHERE id = $5
    `;

    const cancelledAt = status === ScheduleStatus.CANCELLED ? new Date() : null;
    const values = [status, new Date(), failureReason, cancelledAt, id];

    await pool.query(query, values);
  }

  private async updateScheduledEmailSentAt(id: string, sentAt: Date): Promise<void> {
    const query = 'UPDATE scheduled_emails SET sent_at = $1, updated_at = $2 WHERE id = $3';
    await pool.query(query, [sentAt, new Date(), id]);
  }

  private async incrementRetryCount(id: string): Promise<void> {
    const query = 'UPDATE scheduled_emails SET retry_count = retry_count + 1, updated_at = $1 WHERE id = $2';
    await pool.query(query, [new Date(), id]);
  }

  private mapRowToScheduledEmail(row: any): ScheduledEmail {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      campaignId: row.campaign_id,
      emailJob: JSON.parse(row.email_job),
      scheduledAt: new Date(row.scheduled_at),
      status: row.status as ScheduleStatus,
      userType: row.user_type,
      estimatedCost: row.estimated_cost,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      failureReason: row.failure_reason,
      retryCount: row.retry_count,
      maxRetries: row.max_retries
    };
  }

  private generateScheduleId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external access

  /**
   * Get scheduled emails for a tenant
   */
  async getScheduledEmailsByTenant(
    tenantId: string, 
    status?: ScheduleStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<ScheduledEmail[]> {
    let query = 'SELECT * FROM scheduled_emails WHERE tenant_id = $1';
    const values: any[] = [tenantId];

    if (status) {
      query += ' AND status = $2';
      values.push(status);
    }

    query += ' ORDER BY scheduled_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows.map(row => this.mapRowToScheduledEmail(row));
  }

  /**
   * Get scheduled email statistics for a tenant
   */
  async getScheduledEmailStats(tenantId: string): Promise<{
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM scheduled_emails 
      WHERE tenant_id = $1
    `;

    const result = await pool.query(query, [tenantId]);
    const row = result.rows[0];

    return {
      total: parseInt(row.total),
      pending: parseInt(row.pending),
      sent: parseInt(row.sent),
      failed: parseInt(row.failed),
      cancelled: parseInt(row.cancelled)
    };
  }
}