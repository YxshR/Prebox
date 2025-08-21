import cron from 'node-cron';
import { ScheduledEmailService } from './scheduled-email.service';
import { ProcessScheduledEmailsResult } from './scheduled-email.types';

export class ScheduledEmailCron {
  private scheduledEmailService: ScheduledEmailService;
  private isRunning: boolean = false;

  constructor() {
    this.scheduledEmailService = new ScheduledEmailService();
  }

  /**
   * Start the cron job for processing scheduled emails
   * Requirements: 17.2 - Automatic email sending without user intervention
   */
  start(): void {
    // Run every minute to check for due scheduled emails
    cron.schedule('* * * * *', async () => {
      if (this.isRunning) {
        console.log('Scheduled email processing already running, skipping...');
        return;
      }

      this.isRunning = true;
      
      try {
        console.log('Processing scheduled emails...');
        const result = await this.scheduledEmailService.processScheduledEmails();
        
        if (result.totalProcessed > 0) {
          console.log(`Processed ${result.totalProcessed} scheduled emails. Success: ${result.successful}, Failed: ${result.failed}`);
          
          if (result.errors.length > 0) {
            console.error('Scheduled email processing errors:', result.errors);
          }
        }
      } catch (error) {
        console.error('Error in scheduled email cron job:', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ Scheduled email cron job started (runs every minute)');
  }

  /**
   * Start a more frequent cron job for high-priority processing
   */
  startHighFrequency(): void {
    // Run every 30 seconds for more responsive processing
    cron.schedule('*/30 * * * * *', async () => {
      if (this.isRunning) {
        return;
      }

      this.isRunning = true;
      
      try {
        const result = await this.scheduledEmailService.processScheduledEmails();
        
        if (result.totalProcessed > 0) {
          console.log(`High-frequency processing: ${result.totalProcessed} emails processed`);
        }
      } catch (error) {
        console.error('Error in high-frequency scheduled email processing:', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ High-frequency scheduled email processing started (runs every 30 seconds)');
  }

  /**
   * Start cleanup cron job for old scheduled emails
   */
  startCleanup(): void {
    // Run daily at 2 AM to clean up old records
    cron.schedule('0 2 * * *', async () => {
      try {
        console.log('Starting scheduled email cleanup...');
        await this.cleanupOldScheduledEmails();
        console.log('Scheduled email cleanup completed');
      } catch (error) {
        console.error('Error in scheduled email cleanup:', error);
      }
    });

    console.log('✅ Scheduled email cleanup cron job started (runs daily at 2 AM)');
  }

  /**
   * Cleanup old scheduled emails (sent/failed/cancelled emails older than 30 days)
   */
  private async cleanupOldScheduledEmails(): Promise<void> {
    // This would typically involve database operations to remove old records
    // For now, just log the action
    console.log('Cleaning up scheduled emails older than 30 days...');
    
    // TODO: Implement database cleanup
    // DELETE FROM scheduled_emails 
    // WHERE status IN ('sent', 'failed', 'cancelled') 
    // AND updated_at < NOW() - INTERVAL '30 days'
  }

  /**
   * Manual trigger for processing (useful for testing or recovery)
   */
  async manualTrigger(): Promise<ProcessScheduledEmailsResult> {
    if (this.isRunning) {
      throw new Error('Scheduled email processing is already running');
    }

    this.isRunning = true;
    
    try {
      console.log('Manual trigger: Processing scheduled emails...');
      const result = await this.scheduledEmailService.processScheduledEmails();
      console.log(`Manual trigger completed. Processed: ${result.totalProcessed}, Success: ${result.successful}, Failed: ${result.failed}`);
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get current processing status
   */
  getStatus(): { isRunning: boolean; lastRun?: Date } {
    return {
      isRunning: this.isRunning
    };
  }
}

// Export singleton instance
export const scheduledEmailCron = new ScheduledEmailCron();