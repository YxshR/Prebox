import { EmailProvider, EmailJob, EmailSendResult, BatchSendResult, EmailPriority } from './types';
import { SESProvider } from './providers/ses.provider';
import { SendGridProvider } from './providers/sendgrid.provider';
import { MockProvider } from './providers/mock.provider';

export class EmailService {
  private providers: Map<string, EmailProvider> = new Map();
  private primaryProvider: string;
  private fallbackProvider?: string;

  constructor() {
    // Initialize providers based on environment configuration
    this.initializeProviders();
    
    // Set primary and fallback providers
    this.primaryProvider = process.env.PRIMARY_EMAIL_PROVIDER || 'amazon-ses';
    this.fallbackProvider = process.env.FALLBACK_EMAIL_PROVIDER;
  }

  private async initializeProviders(): Promise<void> {
    try {
      // Initialize SES if configured
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        const sesProvider = new SESProvider();
        if (await sesProvider.verifyConfiguration()) {
          this.providers.set('amazon-ses', sesProvider);
          console.log('✅ Amazon SES provider initialized');
        } else {
          console.warn('⚠️ Amazon SES configuration invalid');
        }
      }

      // Initialize SendGrid if configured
      if (process.env.SENDGRID_API_KEY) {
        const sendGridProvider = new SendGridProvider();
        if (await sendGridProvider.verifyConfiguration()) {
          this.providers.set('sendgrid', sendGridProvider);
          console.log('✅ SendGrid provider initialized');
        } else {
          console.warn('⚠️ SendGrid configuration invalid');
        }
      }

      // Initialize Mock provider for demo mode
      if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
        const mockProvider = new MockProvider();
        if (await mockProvider.verifyConfiguration()) {
          this.providers.set('mock', mockProvider);
          console.log('✅ Mock email provider initialized (Demo Mode)');
        }
      }

      if (this.providers.size === 0) {
        throw new Error('No email providers configured. Please configure at least one email service provider.');
      }

    } catch (error) {
      console.error('Failed to initialize email providers:', error);
      throw error;
    }
  }

  async sendSingleEmail(job: EmailJob): Promise<EmailSendResult> {
    const provider = this.getProvider(this.primaryProvider);
    
    if (!provider) {
      throw new Error(`Primary email provider '${this.primaryProvider}' not available`);
    }

    try {
      const result = await provider.sendEmail(job);
      
      // If primary provider fails and we have a fallback, try it
      if (result.status === 'failed' && this.fallbackProvider) {
        console.log(`Primary provider failed, trying fallback: ${this.fallbackProvider}`);
        const fallbackProvider = this.getProvider(this.fallbackProvider);
        
        if (fallbackProvider) {
          return await fallbackProvider.sendEmail(job);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error sending single email:', error);
      
      // Try fallback provider if available
      if (this.fallbackProvider) {
        const fallbackProvider = this.getProvider(this.fallbackProvider);
        if (fallbackProvider) {
          try {
            return await fallbackProvider.sendEmail(job);
          } catch (fallbackError) {
            console.error('Fallback provider also failed:', fallbackError);
          }
        }
      }
      
      throw error;
    }
  }

  async sendBatchEmails(jobs: EmailJob[]): Promise<BatchSendResult> {
    const provider = this.getProvider(this.primaryProvider);
    
    if (!provider) {
      throw new Error(`Primary email provider '${this.primaryProvider}' not available`);
    }

    try {
      return await provider.sendBatch(jobs);
    } catch (error) {
      console.error('Error sending batch emails:', error);
      
      // For batch operations, we might want to fall back to individual sends
      if (this.fallbackProvider) {
        console.log('Batch send failed, trying individual sends with fallback provider');
        const fallbackProvider = this.getProvider(this.fallbackProvider);
        
        if (fallbackProvider) {
          const results: EmailSendResult[] = [];
          let successful = 0;
          let failed = 0;

          for (const job of jobs) {
            try {
              const result = await fallbackProvider.sendEmail(job);
              results.push(result);
              
              if (result.status === 'sent') {
                successful++;
              } else {
                failed++;
              }
            } catch (jobError) {
              results.push({
                messageId: '',
                status: 'failed' as any,
                provider: fallbackProvider.name,
                timestamp: new Date(),
                error: jobError instanceof Error ? jobError.message : 'Unknown error'
              });
              failed++;
            }
          }

          return {
            totalJobs: jobs.length,
            successful,
            failed,
            results
          };
        }
      }
      
      throw error;
    }
  }

  createEmailJob(params: {
    tenantId: string;
    to: string;
    from: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    campaignId?: string;
    replyTo?: string;
    headers?: Record<string, string>;
    metadata?: Record<string, any>;
    priority?: EmailPriority;
    scheduledAt?: Date;
  }): EmailJob {
    return {
      id: this.generateJobId(),
      tenantId: params.tenantId,
      campaignId: params.campaignId,
      to: params.to,
      from: params.from,
      subject: params.subject,
      htmlContent: params.htmlContent,
      textContent: params.textContent,
      replyTo: params.replyTo,
      headers: params.headers,
      metadata: params.metadata,
      priority: params.priority || EmailPriority.NORMAL,
      scheduledAt: params.scheduledAt,
      retryCount: 0,
      maxRetries: 3
    };
  }

  private getProvider(providerName: string): EmailProvider | undefined {
    return this.providers.get(providerName);
  }

  private generateJobId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async getProviderStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        status[name] = await provider.verifyConfiguration();
      } catch (error) {
        status[name] = false;
      }
    }
    
    return status;
  }

  switchPrimaryProvider(providerName: string): void {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider '${providerName}' is not available`);
    }
    
    this.primaryProvider = providerName;
    console.log(`Switched primary email provider to: ${providerName}`);
  }
}