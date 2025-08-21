import { EmailProvider, EmailJob, EmailSendResult, BatchSendResult, EmailStatus } from '../types';

// Note: This is a basic implementation. In production, you'd want to use @sendgrid/mail
export class SendGridProvider implements EmailProvider {
  public readonly name = 'sendgrid';
  private apiKey: string;
  private baseUrl = 'https://api.sendgrid.com/v3';

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('SENDGRID_API_KEY environment variable is required');
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch (error) {
      console.error('SendGrid configuration verification failed:', error);
      return false;
    }
  }

  async sendEmail(job: EmailJob): Promise<EmailSendResult> {
    try {
      const payload = {
        personalizations: [
          {
            to: [{ email: job.to }],
            subject: job.subject
          }
        ],
        from: { email: job.from },
        content: [
          {
            type: 'text/html',
            value: job.htmlContent
          }
        ],
        custom_args: {
          tenant_id: job.tenantId,
          campaign_id: job.campaignId || 'single-email',
          job_id: job.id
        }
      };

      // Add text content if provided
      if (job.textContent) {
        payload.content.unshift({
          type: 'text/plain',
          value: job.textContent
        });
      }

      // Add reply-to if provided
      if (job.replyTo) {
        (payload as any).reply_to = { email: job.replyTo };
      }

      const response = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // SendGrid returns X-Message-Id header
        const messageId = response.headers.get('X-Message-Id') || `sg_${Date.now()}_${job.id}`;
        
        return {
          messageId,
          status: EmailStatus.SENT,
          provider: this.name,
          timestamp: new Date()
        };
      } else {
        const errorText = await response.text();
        throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('SendGrid send email error:', error);
      
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

    // SendGrid supports batch sending, but for simplicity we'll send individually
    // In production, you'd want to use their batch API
    for (const job of jobs) {
      const result = await this.sendEmail(job);
      results.push(result);
      
      if (result.status === EmailStatus.SENT) {
        successful++;
      } else {
        failed++;
      }

      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return {
      totalJobs: jobs.length,
      successful,
      failed,
      results
    };
  }
}