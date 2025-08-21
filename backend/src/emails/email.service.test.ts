import { EmailService } from './email.service';
import { EmailPriority } from './types';

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    // Mock environment variables
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
    process.env.AWS_REGION = 'us-east-1';
    process.env.SES_FROM_EMAIL = 'test@example.com';
    process.env.PRIMARY_EMAIL_PROVIDER = 'amazon-ses';
    
    emailService = new EmailService();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
    delete process.env.SES_FROM_EMAIL;
    delete process.env.PRIMARY_EMAIL_PROVIDER;
  });

  describe('createEmailJob', () => {
    it('should create a valid email job', () => {
      const emailJob = emailService.createEmailJob({
        tenantId: 'tenant-123',
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test Email',
        htmlContent: '<h1>Hello World</h1>',
        textContent: 'Hello World',
        priority: EmailPriority.HIGH
      });

      expect(emailJob).toMatchObject({
        tenantId: 'tenant-123',
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test Email',
        htmlContent: '<h1>Hello World</h1>',
        textContent: 'Hello World',
        priority: EmailPriority.HIGH,
        retryCount: 0,
        maxRetries: 3
      });

      expect(emailJob.id).toMatch(/^email_\d+_[a-z0-9]+$/);
    });

    it('should set default priority to NORMAL', () => {
      const emailJob = emailService.createEmailJob({
        tenantId: 'tenant-123',
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test Email',
        htmlContent: '<h1>Hello World</h1>'
      });

      expect(emailJob.priority).toBe(EmailPriority.NORMAL);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return available providers', () => {
      const providers = emailService.getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
    });
  });

  describe('switchPrimaryProvider', () => {
    it('should throw error for unavailable provider', () => {
      expect(() => {
        emailService.switchPrimaryProvider('invalid-provider');
      }).toThrow('Provider \'invalid-provider\' is not available');
    });
  });
});