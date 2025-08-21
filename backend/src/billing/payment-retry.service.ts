import { PaymentService, PaymentResult } from './payment.service';
import { InvoiceService } from './invoice.service';
import { User, Subscription } from '../shared/types';

export interface PaymentRetryConfig {
  maxRetries: number;
  retryIntervals: number[]; // in minutes
  backoffMultiplier: number;
  maxRetryWindow: number; // in hours
}

export interface FailedPayment {
  id: string;
  tenantId: string;
  userId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  type: 'subscription' | 'recharge' | 'usage';
  failureReason: string;
  retryCount: number;
  nextRetryAt: Date;
  maxRetriesReached: boolean;
  createdAt: Date;
  lastAttemptAt: Date;
  metadata?: Record<string, any>;
}

export interface PaymentRetryResult {
  success: boolean;
  paymentResult?: PaymentResult;
  retryScheduled: boolean;
  nextRetryAt?: Date;
  maxRetriesReached: boolean;
  error?: string;
}

export interface DunningAction {
  type: 'email' | 'sms' | 'suspension' | 'cancellation';
  scheduledAt: Date;
  executed: boolean;
  executedAt?: Date;
}

export interface DunningProcess {
  id: string;
  tenantId: string;
  failedPaymentId: string;
  status: 'active' | 'resolved' | 'cancelled';
  actions: DunningAction[];
  createdAt: Date;
  resolvedAt?: Date;
}

/**
 * Payment Retry Service for handling payment failures and retry logic
 */
export class PaymentRetryService {
  private paymentService: PaymentService;
  private invoiceService: InvoiceService;
  private retryConfig: PaymentRetryConfig;

  constructor(paymentService: PaymentService, invoiceService: InvoiceService) {
    this.paymentService = paymentService;
    this.invoiceService = invoiceService;
    
    // Default retry configuration
    this.retryConfig = {
      maxRetries: 5,
      retryIntervals: [15, 60, 240, 720, 1440], // 15min, 1hr, 4hr, 12hr, 24hr
      backoffMultiplier: 1.5,
      maxRetryWindow: 168 // 7 days
    };
  }

  /**
   * Record a failed payment for retry processing
   */
  async recordFailedPayment(
    tenantId: string,
    userId: string,
    paymentIntentId: string,
    amount: number,
    currency: string,
    type: 'subscription' | 'recharge' | 'usage',
    failureReason: string,
    metadata?: Record<string, any>
  ): Promise<FailedPayment> {
    const failedPayment: FailedPayment = {
      id: this.generateFailedPaymentId(),
      tenantId,
      userId,
      paymentIntentId,
      amount,
      currency,
      type,
      failureReason,
      retryCount: 0,
      nextRetryAt: this.calculateNextRetryTime(0),
      maxRetriesReached: false,
      createdAt: new Date(),
      lastAttemptAt: new Date(),
      metadata
    };

    // TODO: Save failed payment to database
    await this.saveFailedPayment(failedPayment);

    // Start dunning process for subscription payments
    if (type === 'subscription') {
      await this.startDunningProcess(failedPayment);
    }

    console.log(`Recorded failed payment: ${failedPayment.id} for tenant ${tenantId}`);
    return failedPayment;
  }

  /**
   * Retry a failed payment
   */
  async retryPayment(failedPaymentId: string): Promise<PaymentRetryResult> {
    const failedPayment = await this.getFailedPayment(failedPaymentId);
    
    if (!failedPayment) {
      throw new Error('Failed payment not found');
    }

    if (failedPayment.maxRetriesReached) {
      return {
        success: false,
        retryScheduled: false,
        maxRetriesReached: true,
        error: 'Maximum retry attempts reached'
      };
    }

    if (new Date() < failedPayment.nextRetryAt) {
      return {
        success: false,
        retryScheduled: true,
        nextRetryAt: failedPayment.nextRetryAt,
        maxRetriesReached: false,
        error: 'Retry not yet due'
      };
    }

    try {
      console.log(`Retrying payment ${failedPaymentId} (attempt ${failedPayment.retryCount + 1})`);

      // Attempt to retry the payment based on type
      let paymentResult: PaymentResult;

      switch (failedPayment.type) {
        case 'subscription':
          paymentResult = await this.retrySubscriptionPayment(failedPayment);
          break;
        case 'recharge':
          paymentResult = await this.retryRechargePayment(failedPayment);
          break;
        case 'usage':
          paymentResult = await this.retryUsagePayment(failedPayment);
          break;
        default:
          throw new Error(`Unsupported payment type: ${failedPayment.type}`);
      }

      if (paymentResult.success) {
        // Payment succeeded - mark as resolved
        await this.markPaymentResolved(failedPaymentId, paymentResult);
        await this.resolveDunningProcess(failedPaymentId);

        return {
          success: true,
          paymentResult,
          retryScheduled: false,
          maxRetriesReached: false
        };
      } else {
        // Payment failed again - schedule next retry
        return await this.scheduleNextRetry(failedPayment, paymentResult.error);
      }
    } catch (error) {
      console.error(`Payment retry failed for ${failedPaymentId}:`, error);
      return await this.scheduleNextRetry(
        failedPayment,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Process all pending payment retries
   */
  async processRetryQueue(): Promise<void> {
    const pendingRetries = await this.getPendingRetries();
    
    console.log(`Processing ${pendingRetries.length} pending payment retries`);

    for (const failedPayment of pendingRetries) {
      try {
        await this.retryPayment(failedPayment.id);
      } catch (error) {
        console.error(`Error processing retry for payment ${failedPayment.id}:`, error);
      }
    }
  }

  /**
   * Start dunning process for failed subscription payments
   */
  async startDunningProcess(failedPayment: FailedPayment): Promise<DunningProcess> {
    const dunningProcess: DunningProcess = {
      id: this.generateDunningProcessId(),
      tenantId: failedPayment.tenantId,
      failedPaymentId: failedPayment.id,
      status: 'active',
      actions: this.createDunningActions(),
      createdAt: new Date()
    };

    // TODO: Save dunning process to database
    await this.saveDunningProcess(dunningProcess);

    console.log(`Started dunning process ${dunningProcess.id} for failed payment ${failedPayment.id}`);
    return dunningProcess;
  }

  /**
   * Execute dunning actions (emails, account suspension, etc.)
   */
  async executeDunningActions(): Promise<void> {
    const activeDunningProcesses = await this.getActiveDunningProcesses();

    for (const process of activeDunningProcesses) {
      for (const action of process.actions) {
        if (!action.executed && new Date() >= action.scheduledAt) {
          try {
            await this.executeDunningAction(process, action);
            action.executed = true;
            action.executedAt = new Date();
            
            // TODO: Update dunning process in database
            await this.updateDunningProcess(process);
          } catch (error) {
            console.error(`Error executing dunning action for process ${process.id}:`, error);
          }
        }
      }
    }
  }

  /**
   * Cancel payment retry attempts
   */
  async cancelPaymentRetry(failedPaymentId: string, reason: string): Promise<void> {
    const failedPayment = await this.getFailedPayment(failedPaymentId);
    
    if (failedPayment) {
      failedPayment.maxRetriesReached = true;
      failedPayment.metadata = {
        ...failedPayment.metadata,
        cancellationReason: reason,
        cancelledAt: new Date().toISOString()
      };

      // TODO: Update failed payment in database
      await this.updateFailedPayment(failedPayment);

      // Cancel associated dunning process
      await this.cancelDunningProcess(failedPaymentId, reason);
    }
  }

  // Private helper methods

  private async retrySubscriptionPayment(failedPayment: FailedPayment): Promise<PaymentResult> {
    return await this.paymentService.processSubscriptionPayment(
      failedPayment.userId,
      failedPayment.tenantId,
      failedPayment.amount,
      failedPayment.metadata?.planId || 'unknown'
    );
  }

  private async retryRechargePayment(failedPayment: FailedPayment): Promise<PaymentResult> {
    return await this.paymentService.processRecharge({
      userId: failedPayment.userId,
      tenantId: failedPayment.tenantId,
      amount: failedPayment.amount,
      currency: failedPayment.currency,
      provider: 'stripe'
    });
  }

  private async retryUsagePayment(failedPayment: FailedPayment): Promise<PaymentResult> {
    // For usage payments, we might need to create a new payment intent
    // This is a simplified implementation
    return await this.paymentService.processSubscriptionPayment(
      failedPayment.userId,
      failedPayment.tenantId,
      failedPayment.amount,
      'usage-overage'
    );
  }

  private async scheduleNextRetry(
    failedPayment: FailedPayment,
    errorMessage?: string
  ): Promise<PaymentRetryResult> {
    failedPayment.retryCount++;
    failedPayment.lastAttemptAt = new Date();
    failedPayment.failureReason = errorMessage || failedPayment.failureReason;

    if (failedPayment.retryCount >= this.retryConfig.maxRetries) {
      failedPayment.maxRetriesReached = true;
      failedPayment.nextRetryAt = new Date(0); // Never retry

      // TODO: Update failed payment in database
      await this.updateFailedPayment(failedPayment);

      return {
        success: false,
        retryScheduled: false,
        maxRetriesReached: true,
        error: 'Maximum retry attempts reached'
      };
    } else {
      failedPayment.nextRetryAt = this.calculateNextRetryTime(failedPayment.retryCount);

      // TODO: Update failed payment in database
      await this.updateFailedPayment(failedPayment);

      return {
        success: false,
        retryScheduled: true,
        nextRetryAt: failedPayment.nextRetryAt,
        maxRetriesReached: false,
        error: errorMessage
      };
    }
  }

  private calculateNextRetryTime(retryCount: number): Date {
    const intervalMinutes = this.retryConfig.retryIntervals[retryCount] || 
                           this.retryConfig.retryIntervals[this.retryConfig.retryIntervals.length - 1];
    
    const nextRetry = new Date();
    nextRetry.setMinutes(nextRetry.getMinutes() + intervalMinutes);
    
    return nextRetry;
  }

  private createDunningActions(): DunningAction[] {
    const now = new Date();
    
    return [
      {
        type: 'email',
        scheduledAt: new Date(now.getTime() + 1 * 60 * 60 * 1000), // 1 hour
        executed: false
      },
      {
        type: 'email',
        scheduledAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 1 day
        executed: false
      },
      {
        type: 'email',
        scheduledAt: new Date(now.getTime() + 72 * 60 * 60 * 1000), // 3 days
        executed: false
      },
      {
        type: 'suspension',
        scheduledAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
        executed: false
      },
      {
        type: 'cancellation',
        scheduledAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
        executed: false
      }
    ];
  }

  private async executeDunningAction(process: DunningProcess, action: DunningAction): Promise<void> {
    console.log(`Executing dunning action: ${action.type} for process ${process.id}`);

    switch (action.type) {
      case 'email':
        await this.sendPaymentFailureEmail(process);
        break;
      case 'sms':
        await this.sendPaymentFailureSMS(process);
        break;
      case 'suspension':
        await this.suspendAccount(process.tenantId);
        break;
      case 'cancellation':
        await this.cancelSubscription(process.tenantId);
        break;
    }
  }

  private async sendPaymentFailureEmail(process: DunningProcess): Promise<void> {
    // TODO: Implement email sending
    console.log(`Sending payment failure email for process ${process.id}`);
  }

  private async sendPaymentFailureSMS(process: DunningProcess): Promise<void> {
    // TODO: Implement SMS sending
    console.log(`Sending payment failure SMS for process ${process.id}`);
  }

  private async suspendAccount(tenantId: string): Promise<void> {
    // TODO: Implement account suspension
    console.log(`Suspending account for tenant ${tenantId}`);
  }

  private async cancelSubscription(tenantId: string): Promise<void> {
    // TODO: Implement subscription cancellation
    console.log(`Cancelling subscription for tenant ${tenantId}`);
  }

  // Database operation placeholders
  private generateFailedPaymentId(): string {
    return `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDunningProcessId(): string {
    return `dp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveFailedPayment(failedPayment: FailedPayment): Promise<void> {
    // TODO: Implement database save
    console.log(`Saving failed payment: ${failedPayment.id}`);
  }

  private async updateFailedPayment(failedPayment: FailedPayment): Promise<void> {
    // TODO: Implement database update
    console.log(`Updating failed payment: ${failedPayment.id}`);
  }

  private async getFailedPayment(id: string): Promise<FailedPayment | null> {
    // TODO: Implement database query
    console.log(`Fetching failed payment: ${id}`);
    return null;
  }

  private async getPendingRetries(): Promise<FailedPayment[]> {
    // TODO: Implement database query for pending retries
    return [];
  }

  private async markPaymentResolved(failedPaymentId: string, paymentResult: PaymentResult): Promise<void> {
    // TODO: Implement database update
    console.log(`Marking payment ${failedPaymentId} as resolved`);
  }

  private async saveDunningProcess(process: DunningProcess): Promise<void> {
    // TODO: Implement database save
    console.log(`Saving dunning process: ${process.id}`);
  }

  private async updateDunningProcess(process: DunningProcess): Promise<void> {
    // TODO: Implement database update
    console.log(`Updating dunning process: ${process.id}`);
  }

  private async getActiveDunningProcesses(): Promise<DunningProcess[]> {
    // TODO: Implement database query
    return [];
  }

  private async resolveDunningProcess(failedPaymentId: string): Promise<void> {
    // TODO: Implement database update
    console.log(`Resolving dunning process for failed payment: ${failedPaymentId}`);
  }

  private async cancelDunningProcess(failedPaymentId: string, reason: string): Promise<void> {
    // TODO: Implement database update
    console.log(`Cancelling dunning process for failed payment: ${failedPaymentId}. Reason: ${reason}`);
  }
}