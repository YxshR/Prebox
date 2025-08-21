import AWS from 'aws-sdk';
import { EmailProvider, EmailJob, EmailSendResult, BatchSendResult, EmailStatus } from '../types';

export class SESProvider implements EmailProvider {
  public readonly name = 'amazon-ses';
  private ses: AWS.SES;

  constructor() {
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.ses = new AWS.SES({ apiVersion: '2010-12-01' });
  }

  async verifyConfiguration(): Promise<boolean> {
    try {
      await this.ses.getSendQuota().promise();
      return true;
    } catch (error) {
      console.error('SES configuration verification failed:', error);
      return false;
    }
  }

  async sendEmail(job: EmailJob): Promise<EmailSendResult> {
    try {
      const params: AWS.SES.SendEmailRequest = {
        Source: job.from,
        Destination: {
          ToAddresses: [job.to]
        },
        Message: {
          Subject: {
            Data: job.subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: job.htmlContent,
              Charset: 'UTF-8'
            }
          }
        },
        ReplyToAddresses: job.replyTo ? [job.replyTo] : undefined,
        Tags: [
          {
            Name: 'TenantId',
            Value: job.tenantId
          },
          {
            Name: 'CampaignId',
            Value: job.campaignId || 'single-email'
          },
          {
            Name: 'JobId',
            Value: job.id
          }
        ]
      };

      // Add text content if provided
      if (job.textContent) {
        params.Message.Body.Text = {
          Data: job.textContent,
          Charset: 'UTF-8'
        };
      }

      const result = await this.ses.sendEmail(params).promise();

      return {
        messageId: result.MessageId,
        status: EmailStatus.SENT,
        provider: this.name,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('SES send email error:', error);
      
      return {
        messageId: '',
        status: EmailStatus.FAILED,
        provider: this.name,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async sendBatch(jobs: EmailJob[]): Promise<BatchSendResult> {
    const results: EmailSendResult[] = [];
    let successful = 0;
    let failed = 0;

    // SES doesn't have a native batch send, so we'll send individually
    // In production, you might want to implement proper batching with rate limiting
    for (const job of jobs) {
      const result = await this.sendEmail(job);
      results.push(result);
      
      if (result.status === EmailStatus.SENT) {
        successful++;
      } else {
        failed++;
      }

      // Add small delay to respect SES rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      totalJobs: jobs.length,
      successful,
      failed,
      results
    };
  }

  async getSendingQuota(): Promise<{ max24HourSend: number; maxSendRate: number; sentLast24Hours: number }> {
    try {
      const quota = await this.ses.getSendQuota().promise();
      return {
        max24HourSend: quota.Max24HourSend || 0,
        maxSendRate: quota.MaxSendRate || 0,
        sentLast24Hours: quota.SentLast24Hours || 0
      };
    } catch (error) {
      console.error('Error getting SES quota:', error);
      throw error;
    }
  }

  async getSendingStatistics(): Promise<AWS.SES.SendDataPoint[]> {
    try {
      const stats = await this.ses.getSendStatistics().promise();
      return stats.SendDataPoints || [];
    } catch (error) {
      console.error('Error getting SES statistics:', error);
      throw error;
    }
  }
}