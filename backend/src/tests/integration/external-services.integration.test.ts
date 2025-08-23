/**
 * External Services Integration Tests
 * Tests integration with Auth0, Twilio, and SendGrid
 */

import { Auth0Service } from '../../auth/auth0.service';
import { EnhancedPhoneVerificationService } from '../../auth/enhanced-phone-verification.service';
import { SendGridEmailService } from '../../auth/services/sendgrid-email.service';
import { DatabaseService } from '../../database/database.service';
import { TestDataSeeder } from '../utils/test-data-seeder';
import { TestCleanup } from '../utils/test-cleanup';

// Mock external services for testing
jest.mock('auth0', () => ({
  ManagementClient: jest.fn().mockImplementation(() => ({
    getUser: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn()
  }))
}));

jest.mock('twilio', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'test-message-sid',
        status: 'sent',
        to: '+1234567890'
      })
    },
    verify: {
      v2: {
        services: jest.fn().mockReturnValue({
          verifications: {
            create: jest.fn().mockResolvedValue({
              sid: 'test-verification-sid',
              status: 'pending'
            })
          },
          verificationChecks: {
            create: jest.fn().mockResolvedValue({
              sid: 'test-check-sid',
              status: 'approved'
            })
          }
        })
      }
    }
  }))
}));

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{
    statusCode: 202,
    body: '',
    headers: {}
  }])
}));

describe('External Services Integration Tests', () => {
  let dbService: DatabaseService;
  let seeder: TestDataSeeder;
  let cleanup: TestCleanup;
  let auth0Service: Auth0Service;
  let phoneService: EnhancedPhoneVerificationService;
  let emailService: SendGridEmailService;

  beforeAll(async () => {
    dbService = new DatabaseService();
    seeder = new TestDataSeeder(dbService);
    cleanup = new TestCleanup(dbService);
    
    await dbService.connect();
    await seeder.seedTestData();

    // Initialize services with test configuration
    auth0Service = new Auth0Service();
    phoneService = new EnhancedPhoneVerificationService(dbService);
    emailService = new SendGridEmailService();
  });

  afterAll(async () => {
    await cleanup.cleanupAll();
    await dbService.disconnect();
  });

  afterEach(async () => {
    await cleanup.cleanupUserData();
    jest.clearAllMocks();
  });

  describe('Auth0 Service Integration', () => {
    it('should handle Auth0 user creation', async () => {
      const mockAuth0User = {
        user_id: 'auth0|test123',
        email: 'auth0test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg'
      };

      // Mock Auth0 response
      const mockManagementClient = require('auth0').ManagementClient;
      mockManagementClient.mockImplementation(() => ({
        createUser: jest.fn().mockResolvedValue(mockAuth0User),
        getUser: jest.fn().mockResolvedValue(mockAuth0User)
      }));

      const result = await auth0Service.createUser({
        email: mockAuth0User.email,
        name: mockAuth0User.name,
        connection: 'Username-Password-Authentication'
      });

      expect(result).toMatchObject({
        user_id: mockAuth0User.user_id,
        email: mockAuth0User.email,
        name: mockAuth0User.name
      });
    });

    it('should handle Auth0 user retrieval', async () => {
      const auth0Id = 'auth0|retrieve123';
      const mockUser = {
        user_id: auth0Id,
        email: 'retrieve@example.com',
        name: 'Retrieve User'
      };

      const mockManagementClient = require('auth0').ManagementClient;
      mockManagementClient.mockImplementation(() => ({
        getUser: jest.fn().mockResolvedValue(mockUser)
      }));

      const result = await auth0Service.getUser(auth0Id);

      expect(result).toMatchObject(mockUser);
    });

    it('should handle Auth0 service errors gracefully', async () => {
      const mockManagementClient = require('auth0').ManagementClient;
      mockManagementClient.mockImplementation(() => ({
        getUser: jest.fn().mockRejectedValue(new Error('Auth0 API Error'))
      }));

      await expect(auth0Service.getUser('invalid-id'))
        .rejects.toThrow('Auth0 API Error');
    });

    it('should validate Auth0 profile data', async () => {
      const invalidProfile = {
        email: 'invalid-email',
        name: ''
      };

      await expect(auth0Service.validateProfile(invalidProfile))
        .rejects.toThrow(/Invalid profile data/);
    });
  });

  describe('Phone Verification Service Integration', () => {
    it('should send SMS verification successfully', async () => {
      const phone = '+1234567890';
      
      const result = await phoneService.sendVerification(phone);

      expect(result).toMatchObject({
        success: true,
        phone,
        message: expect.stringContaining('sent')
      });

      // Verify OTP was stored in database
      const verification = await seeder.getLatestPhoneVerification(phone);
      expect(verification).toBeTruthy();
      expect(verification.phone).toBe(phone);
    });

    it('should verify OTP successfully', async () => {
      const phone = '+1987654321';
      const otp = '123456';

      // Create verification record
      await seeder.createPhoneVerification(phone, otp);

      const result = await phoneService.verifyOTP(phone, otp);

      expect(result).toMatchObject({
        success: true,
        verified: true
      });

      // Verify database was updated
      const verification = await seeder.getLatestPhoneVerification(phone);
      expect(verification.verified_at).toBeTruthy();
    });

    it('should handle invalid OTP', async () => {
      const phone = '+1555123456';
      const correctOtp = '123456';
      const wrongOtp = '654321';

      await seeder.createPhoneVerification(phone, correctOtp);

      const result = await phoneService.verifyOTP(phone, wrongOtp);

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid')
      });
    });

    it('should handle expired OTP', async () => {
      const phone = '+1555987654';
      const otp = '123456';

      // Create expired verification
      await dbService.query(`
        INSERT INTO phone_verifications (phone, otp_code, expires_at)
        VALUES ($1, $2, $3)
      `, [phone, otp, new Date(Date.now() - 60000)]); // 1 minute ago

      const result = await phoneService.verifyOTP(phone, otp);

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('expired')
      });
    });

    it('should handle rate limiting for SMS', async () => {
      const phone = '+1555000000';

      // Send multiple requests quickly
      const requests = Array(5).fill(null).map(() =>
        phoneService.sendVerification(phone)
      );

      const results = await Promise.allSettled(requests);
      
      // Some should be rate limited
      const rejected = results.filter(r => r.status === 'rejected');
      expect(rejected.length).toBeGreaterThan(0);
    });

    it('should handle Twilio service errors', async () => {
      const mockTwilio = require('twilio').default;
      mockTwilio.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockRejectedValue(new Error('Twilio API Error'))
        }
      }));

      await expect(phoneService.sendVerification('+1invalid'))
        .rejects.toThrow();
    });
  });

  describe('Email Service Integration', () => {
    it('should send email verification successfully', async () => {
      const email = 'test@example.com';
      const code = '123456';

      const result = await emailService.sendVerificationEmail(email, code);

      expect(result).toMatchObject({
        success: true,
        messageId: expect.any(String)
      });

      // Verify SendGrid was called
      const mockSendGrid = require('@sendgrid/mail');
      expect(mockSendGrid.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          subject: expect.stringContaining('verification'),
          html: expect.stringContaining(code)
        })
      );
    });

    it('should send welcome email after signup', async () => {
      const user = {
        email: 'welcome@example.com',
        name: 'Welcome User'
      };

      const result = await emailService.sendWelcomeEmail(user.email, user.name);

      expect(result).toMatchObject({
        success: true,
        messageId: expect.any(String)
      });

      const mockSendGrid = require('@sendgrid/mail');
      expect(mockSendGrid.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: user.email,
          subject: expect.stringContaining('Welcome'),
          html: expect.stringContaining(user.name)
        })
      );
    });

    it('should handle SendGrid API errors', async () => {
      const mockSendGrid = require('@sendgrid/mail');
      mockSendGrid.send.mockRejectedValueOnce(new Error('SendGrid API Error'));

      await expect(emailService.sendVerificationEmail('error@example.com', '123456'))
        .rejects.toThrow('SendGrid API Error');
    });

    it('should validate email templates', async () => {
      const invalidTemplate = {
        to: 'invalid-email',
        subject: '',
        html: ''
      };

      await expect(emailService.validateTemplate(invalidTemplate))
        .rejects.toThrow(/Invalid template/);
    });

    it('should handle email delivery status tracking', async () => {
      const email = 'track@example.com';
      const code = '654321';

      const mockSendGrid = require('@sendgrid/mail');
      mockSendGrid.send.mockResolvedValueOnce([{
        statusCode: 202,
        body: '',
        headers: {
          'x-message-id': 'test-message-id'
        }
      }]);

      const result = await emailService.sendVerificationEmail(email, code);

      expect(result).toMatchObject({
        success: true,
        messageId: 'test-message-id'
      });
    });
  });

  describe('Service Integration Workflows', () => {
    it('should handle complete Auth0 + phone verification flow', async () => {
      const auth0Profile = {
        sub: 'auth0|integration123',
        email: 'integration@example.com',
        name: 'Integration User'
      };
      const phone = '+1555integration';

      // Step 1: Create Auth0 user
      const mockManagementClient = require('auth0').ManagementClient;
      mockManagementClient.mockImplementation(() => ({
        createUser: jest.fn().mockResolvedValue({
          user_id: auth0Profile.sub,
          email: auth0Profile.email,
          name: auth0Profile.name
        })
      }));

      const auth0User = await auth0Service.createUser({
        email: auth0Profile.email,
        name: auth0Profile.name,
        connection: 'Username-Password-Authentication'
      });

      // Step 2: Send phone verification
      const phoneResult = await phoneService.sendVerification(phone);
      expect(phoneResult.success).toBe(true);

      // Step 3: Verify phone
      const verification = await seeder.getLatestPhoneVerification(phone);
      const verifyResult = await phoneService.verifyOTP(phone, verification.otp_code);
      expect(verifyResult.success).toBe(true);

      // Step 4: Send welcome email
      const emailResult = await emailService.sendWelcomeEmail(
        auth0Profile.email,
        auth0Profile.name
      );
      expect(emailResult.success).toBe(true);
    });

    it('should handle multi-step phone signup with email verification', async () => {
      const phone = '+1555multistep';
      const email = 'multistep@example.com';

      // Step 1: Phone verification
      const phoneResult = await phoneService.sendVerification(phone);
      expect(phoneResult.success).toBe(true);

      const phoneVerification = await seeder.getLatestPhoneVerification(phone);
      const phoneVerifyResult = await phoneService.verifyOTP(phone, phoneVerification.otp_code);
      expect(phoneVerifyResult.success).toBe(true);

      // Step 2: Email verification
      const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
      await seeder.createEmailVerification(email, emailCode);

      const emailResult = await emailService.sendVerificationEmail(email, emailCode);
      expect(emailResult.success).toBe(true);

      // Step 3: Welcome email after completion
      const welcomeResult = await emailService.sendWelcomeEmail(email, 'Multi Step User');
      expect(welcomeResult.success).toBe(true);
    });

    it('should handle service failures gracefully in workflows', async () => {
      const phone = '+1555failure';
      const email = 'failure@example.com';

      // Mock Twilio failure
      const mockTwilio = require('twilio').default;
      mockTwilio.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockRejectedValue(new Error('Twilio Service Unavailable'))
        }
      }));

      // Phone verification should fail
      await expect(phoneService.sendVerification(phone))
        .rejects.toThrow();

      // But email service should still work
      const emailCode = '123456';
      await seeder.createEmailVerification(email, emailCode);
      
      const emailResult = await emailService.sendVerificationEmail(email, emailCode);
      expect(emailResult.success).toBe(true);
    });

    it('should handle concurrent service requests', async () => {
      const requests = Array(10).fill(null).map((_, i) => ({
        phone: `+155500000${i}`,
        email: `concurrent${i}@example.com`
      }));

      // Send concurrent phone verifications
      const phonePromises = requests.map(req => 
        phoneService.sendVerification(req.phone)
      );

      // Send concurrent email verifications
      const emailPromises = requests.map(async (req) => {
        const code = '123456';
        await seeder.createEmailVerification(req.email, code);
        return emailService.sendVerificationEmail(req.email, code);
      });

      const [phoneResults, emailResults] = await Promise.all([
        Promise.allSettled(phonePromises),
        Promise.allSettled(emailPromises)
      ]);

      // Most should succeed (some might be rate limited)
      const phoneSuccesses = phoneResults.filter(r => r.status === 'fulfilled');
      const emailSuccesses = emailResults.filter(r => r.status === 'fulfilled');

      expect(phoneSuccesses.length).toBeGreaterThan(5);
      expect(emailSuccesses.length).toBeGreaterThan(8);
    });
  });

  describe('Service Configuration and Health Checks', () => {
    it('should validate service configurations', async () => {
      // Test Auth0 configuration
      expect(() => auth0Service.validateConfig()).not.toThrow();

      // Test phone service configuration
      expect(() => phoneService.validateConfig()).not.toThrow();

      // Test email service configuration
      expect(() => emailService.validateConfig()).not.toThrow();
    });

    it('should perform health checks on external services', async () => {
      // Mock successful health checks
      const mockTwilio = require('twilio').default;
      mockTwilio.mockImplementation(() => ({
        api: {
          accounts: jest.fn().mockResolvedValue({ sid: 'test-account-sid' })
        }
      }));

      const mockSendGrid = require('@sendgrid/mail');
      mockSendGrid.send.mockResolvedValueOnce([{ statusCode: 202 }]);

      const healthChecks = await Promise.allSettled([
        phoneService.healthCheck(),
        emailService.healthCheck()
      ]);

      const successfulChecks = healthChecks.filter(check => 
        check.status === 'fulfilled' && check.value.healthy
      );

      expect(successfulChecks.length).toBeGreaterThan(0);
    });

    it('should handle service timeouts', async () => {
      // Mock timeout scenarios
      const mockTwilio = require('twilio').default;
      mockTwilio.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockImplementation(() => 
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 100)
            )
          )
        }
      }));

      await expect(phoneService.sendVerification('+1timeout'))
        .rejects.toThrow();
    }, 10000);
  });
});