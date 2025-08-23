import { EmailProvider, EmailSendResult, EmailJob, BatchSendResult, EmailStatus } from '../types';

export class MockProvider implements EmailProvider {
  name = 'mock';

  async verifyConfiguration(): Promise<boolean> {
    // Mock provider is always available in demo mode
    return true;
  }

  async sendEmail(job: EmailJob): Promise<EmailSendResult> {
    // Simulate email sending with mock response
    console.log(`📧 [MOCK] Sending email to: ${job.to}`);
    console.log(`📧 [MOCK] Subject: ${job.subject}`);
    console.log(`📧 [MOCK] From: ${job.from}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: EmailStatus.SENT,
      provider: 'mock',
      timestamp: new Date()
    };
  }

  async sendBatch(jobs: EmailJob[]): Promise<BatchSendResult> {
    console.log(`📧 [MOCK] Sending bulk email to ${jobs.length} recipients`);
    
    // Simulate bulk processing
    const results: EmailSendResult[] = [];
    let successful = 0;
    let failed = 0;
    
    for (const job of jobs) {
      try {
        const result = await this.sendEmail(job);
        results.push(result);
        successful++;
      } catch (error) {
        failed++;
        results.push({
          messageId: '',
          status: EmailStatus.FAILED,
          provider: 'mock',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return {
      totalJobs: jobs.length,
      successful,
      failed,
      results
    };
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