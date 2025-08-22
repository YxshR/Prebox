import { EmailProvider, EmailSendResult, EmailJob } from '../types/email.types';

export class MockProvider implements EmailProvider {
  name = 'mock';

  async verifyConfiguration(): Promise<boolean> {
    // Mock provider is always available in demo mode
    return true;
  }

  async sendEmail(job: EmailJob): Promise<EmailSendResult> {
    // Simulate email sending with mock response
    console.log(`📧 [MOCK] Sending email to: ${job.to.join(', ')}`);
    console.log(`📧 [MOCK] Subject: ${job.subject}`);
    console.log(`📧 [MOCK] From: ${job.from}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      provider: 'mock',
      timestamp: new Date(),
      metadata: {
        to: job.to,
        subject: job.subject,
        from: job.from,
        mockSent: true
      }
    };
  }

  async sendBulkEmail(jobs: EmailJob[]): Promise<EmailSendResult[]> {
    console.log(`📧 [MOCK] Sending bulk email to ${jobs.length} recipients`);
    
    // Simulate bulk processing
    const results: EmailSendResult[] = [];
    
    for (const job of jobs) {
      const result = await this.sendEmail(job);
      results.push(result);
    }
    
    return results;
  }

  async getDeliveryStatus(messageId: string): Promise<any> {
    // Mock delivery status
    return {
      messageId,
      status: 'delivered',
      timestamp: new Date(),
      provider: 'mock',
      events: [
        {
          event: 'sent',
          timestamp: new Date(Date.now() - 5000),
        },
        {
          event: 'delivered',
          timestamp: new Date(),
        }
      ]
    };
  }

  async handleWebhook(payload: any): Promise<void> {
    console.log('📧 [MOCK] Webhook received:', payload);
    // Mock webhook handling - no actual processing needed
  }
}