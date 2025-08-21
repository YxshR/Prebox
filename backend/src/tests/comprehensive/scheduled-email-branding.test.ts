/**
 * Comprehensive Tests for Scheduled Email and Branding Systems
 * Tests all aspects of scheduled emails and branding functionality
 */

import { ScheduledEmailService } from '../../emails/scheduled-email.service';
import { BrandingService } from '../../branding/branding.service';
import { TestUtils } from '../../config/test-config';

// Mock dependencies
const mockDatabase = TestUtils.mockDatabase();
const mockRedis = TestUtils.mockRedis();
const mockFileStorage = {
  upload: jest.fn(),
  delete: jest.fn(),
  getUrl: jest.fn()
};

jest.mock('../../database/database.service', () => ({
  DatabaseService: {
    getInstance: () => mockDatabase
  }
}));

jest.mock('../../shared/file-storage.service', () => ({
  FileStorageService: () => mockFileStorage
}));

describe('Scheduled Email System Tests', () => {
  let scheduledEmailService: ScheduledEmailService;
  const tenantId = 'test-tenant-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    scheduledEmailService = new ScheduledEmailService();
    jest.clearAllMocks();
  });

  describe('Email Scheduling', () => {
    it('should schedule email for subscription users within 14-day limit', async () => {
      const scheduleData = {
        tenantId,
        campaignId: 'campaign-1',
        scheduledAt: new Date(Date.now() + 86400000 * 10), // 10 days from now
        userType: 'subscription' as const,
        estimatedCost: 0
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM', subscription_expires_at: new Date(Date.now() + 86400000 * 30) }] })
        .mockResolvedValueOnce({ rows: [{ id: 'schedule-1', ...scheduleData, status: 'PENDING' }] });

      const result = await scheduledEmailService.scheduleEmail(scheduleData);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('PENDING');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO scheduled_emails'),
        expect.arrayContaining([
          scheduleData.tenantId,
          scheduleData.campaignId,
          scheduleData.scheduledAt,
          'PENDING',
          scheduleData.userType
        ])
      );
    });

    it('should reject scheduling beyond 14 days for subscription users', async () => {
      const scheduleData = {
        tenantId,
        campaignId: 'campaign-1',
        scheduledAt: new Date(Date.now() + 86400000 * 15), // 15 days from now
        userType: 'subscription' as const,
        estimatedCost: 0
      };

      await expect(scheduledEmailService.scheduleEmail(scheduleData))
        .rejects.toThrow('Subscription users can only schedule up to 14 days in advance');
    });

    it('should allow unlimited scheduling for recharge users', async () => {
      const scheduleData = {
        tenantId,
        campaignId: 'campaign-1',
        scheduledAt: new Date(Date.now() + 86400000 * 30), // 30 days from now
        userType: 'recharge' as const,
        estimatedCost: 1000 // $10.00 for 500 recipients
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ recharge_balance: 2000 }] }) // Sufficient balance
        .mockResolvedValueOnce({ rows: [{ id: 'schedule-2', ...scheduleData, status: 'PENDING' }] });

      const result = await scheduledEmailService.scheduleEmail(scheduleData);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('PENDING');
    });

    it('should validate recharge balance for recharge users', async () => {
      const scheduleData = {
        tenantId,
        campaignId: 'campaign-1',
        scheduledAt: new Date(Date.now() + 86400000 * 7),
        userType: 'recharge' as const,
        estimatedCost: 1500 // $15.00
      };

      mockDatabase.query.mockResolvedValueOnce({ rows: [{ recharge_balance: 1000 }] }); // Insufficient balance

      await expect(scheduledEmailService.scheduleEmail(scheduleData))
        .rejects.toThrow('Insufficient recharge balance');
    });
  });

  describe('Scheduled Email Processing', () => {
    it('should process pending scheduled emails at correct time', async () => {
      const now = new Date();
      const scheduledEmails = [
        {
          id: 'sched-1',
          tenantId,
          campaignId: 'campaign-1',
          scheduledAt: new Date(now.getTime() - 60000), // 1 minute ago
          status: 'PENDING',
          userType: 'subscription'
        },
        {
          id: 'sched-2',
          tenantId,
          campaignId: 'campaign-2',
          scheduledAt: new Date(now.getTime() + 60000), // 1 minute from now
          status: 'PENDING',
          userType: 'recharge'
        }
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: scheduledEmails }) // Get pending emails
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM', subscription_expires_at: new Date(now.getTime() + 86400000) }] }) // Subscription check
        .mockResolvedValueOnce({ rowCount: 1 }) // Update status to SENT
        .mockResolvedValueOnce({ rows: [{ id: 'email-job-1' }] }); // Create email job

      const result = await scheduledEmailService.processScheduledEmails();

      expect(result.processed).toBe(1); // Only one email should be processed (the overdue one)
      expect(result.cancelled).toBe(0);
      expect(result.failed).toBe(0);

      // Verify the overdue email was processed
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scheduled_emails SET status = $1, sent_at = $2'),
        ['SENT', expect.any(Date), 'sched-1']
      );
    });

    it('should cancel scheduled emails for expired subscriptions', async () => {
      const now = new Date();
      const scheduledEmail = {
        id: 'sched-expired',
        tenantId,
        campaignId: 'campaign-expired',
        scheduledAt: new Date(now.getTime() - 60000),
        status: 'PENDING',
        userType: 'subscription'
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [scheduledEmail] })
        .mockResolvedValueOnce({ rows: [{ tier: 'FREE', subscription_expires_at: new Date(now.getTime() - 86400000) }] }) // Expired subscription
        .mockResolvedValueOnce({ rowCount: 1 }); // Cancel email

      const result = await scheduledEmailService.processScheduledEmails();

      expect(result.cancelled).toBe(1);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scheduled_emails SET status = $1, cancelled_at = $2'),
        ['CANCELLED', expect.any(Date), 'sched-expired']
      );
    });

    it('should cancel scheduled emails for insufficient recharge balance', async () => {
      const now = new Date();
      const scheduledEmail = {
        id: 'sched-insufficient',
        tenantId,
        campaignId: 'campaign-insufficient',
        scheduledAt: new Date(now.getTime() - 60000),
        status: 'PENDING',
        userType: 'recharge',
        estimatedCost: 1500
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [scheduledEmail] })
        .mockResolvedValueOnce({ rows: [{ recharge_balance: 1000 }] }) // Insufficient balance
        .mockResolvedValueOnce({ rowCount: 1 }); // Cancel email

      const result = await scheduledEmailService.processScheduledEmails();

      expect(result.cancelled).toBe(1);
    });
  });

  describe('Manual Trigger System', () => {
    it('should manually trigger scheduled emails', async () => {
      const scheduledEmails = [
        {
          id: 'manual-1',
          tenantId,
          campaignId: 'campaign-manual-1',
          scheduledAt: new Date(),
          status: 'PENDING',
          userType: 'subscription'
        }
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: scheduledEmails })
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM', subscription_expires_at: new Date(Date.now() + 86400000) }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'manual-job-1' }] });

      const result = await scheduledEmailService.triggerScheduledEmails();

      expect(result.triggered).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should handle errors during manual trigger gracefully', async () => {
      const scheduledEmails = [
        {
          id: 'error-1',
          tenantId,
          campaignId: 'campaign-error',
          scheduledAt: new Date(),
          status: 'PENDING',
          userType: 'subscription'
        }
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: scheduledEmails })
        .mockRejectedValueOnce(new Error('Database error')); // Simulate error

      const result = await scheduledEmailService.triggerScheduledEmails();

      expect(result.triggered).toBe(0);
      expect(result.errors).toBe(1);
    });
  });

  describe('Scheduled Email Management', () => {
    it('should cancel scheduled email successfully', async () => {
      const scheduleId = 'cancel-me';
      
      mockDatabase.query.mockResolvedValueOnce({ rowCount: 1 });

      await scheduledEmailService.cancelScheduledEmail(scheduleId, userId);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scheduled_emails SET status = $1, cancelled_at = $2'),
        ['CANCELLED', expect.any(Date), scheduleId]
      );
    });

    it('should get scheduled emails for tenant', async () => {
      const mockScheduledEmails = [
        {
          id: 'sched-1',
          campaignId: 'campaign-1',
          scheduledAt: new Date(),
          status: 'PENDING'
        },
        {
          id: 'sched-2',
          campaignId: 'campaign-2',
          scheduledAt: new Date(),
          status: 'SENT'
        }
      ];

      mockDatabase.query.mockResolvedValueOnce({ rows: mockScheduledEmails });

      const result = await scheduledEmailService.getScheduledEmails(tenantId);

      expect(result).toEqual(mockScheduledEmails);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM scheduled_emails WHERE tenant_id = $1'),
        [tenantId]
      );
    });
  });
});

describe('Branding System Tests', () => {
  let brandingService: BrandingService;
  const tenantId = 'test-tenant-id';

  beforeEach(() => {
    brandingService = new BrandingService();
    jest.clearAllMocks();
  });

  describe('Logo Upload', () => {
    it('should upload logo successfully for paid users', async () => {
      const logoFile = {
        buffer: Buffer.from('fake-image-data'),
        originalname: 'logo.png',
        mimetype: 'image/png',
        size: 50000 // 50KB
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM' }] }) // User tier check
        .mockResolvedValueOnce({ rows: [{ id: 'upload-1' }] }) // Create upload record
        .mockResolvedValueOnce({ rowCount: 1 }); // Update upload status

      mockFileStorage.upload.mockResolvedValue({
        url: 'https://storage.example.com/logos/logo-123.png',
        key: 'logos/logo-123.png'
      });

      const result = await brandingService.uploadLogo(tenantId, logoFile);

      expect(result).toHaveProperty('logoUrl');
      expect(result).toHaveProperty('uploadId');
      expect(mockFileStorage.upload).toHaveBeenCalledWith(
        logoFile.buffer,
        expect.stringContaining('logos/'),
        logoFile.mimetype
      );
    });

    it('should reject logo upload for free users', async () => {
      const logoFile = {
        buffer: Buffer.from('fake-image-data'),
        originalname: 'logo.png',
        mimetype: 'image/png',
        size: 50000
      };

      mockDatabase.query.mockResolvedValueOnce({ rows: [{ tier: 'FREE' }] });

      await expect(brandingService.uploadLogo(tenantId, logoFile))
        .rejects.toThrow('Logo upload requires paid subscription');
    });

    it('should validate file size limits', async () => {
      const largeLogo = {
        buffer: Buffer.alloc(6 * 1024 * 1024), // 6MB
        originalname: 'large-logo.png',
        mimetype: 'image/png',
        size: 6 * 1024 * 1024
      };

      mockDatabase.query.mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM' }] });

      await expect(brandingService.uploadLogo(tenantId, largeLogo))
        .rejects.toThrow('File size exceeds maximum limit of 5MB');
    });

    it('should validate file types', async () => {
      const invalidFile = {
        buffer: Buffer.from('fake-data'),
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: 50000
      };

      mockDatabase.query.mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM' }] });

      await expect(brandingService.uploadLogo(tenantId, invalidFile))
        .rejects.toThrow('Invalid file type. Only PNG, JPG, and SVG files are allowed');
    });
  });

  describe('Branding Settings Management', () => {
    it('should update branding settings successfully', async () => {
      const brandingUpdates = {
        logoPosition: 'header' as const,
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        textColor: '#212529',
        fontFamily: 'Arial, sans-serif'
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM' }] }) // User tier check
        .mockResolvedValueOnce({ rows: [] }) // No existing settings
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'branding-1', 
            tenant_id: tenantId,
            ...brandingUpdates,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }] 
        }); // Create new settings

      const result = await brandingService.updateBrandingSettings(tenantId, brandingUpdates);

      expect(result).toHaveProperty('id');
      expect(result.logoPosition).toBe(brandingUpdates.logoPosition);
      expect(result.primaryColor).toBe(brandingUpdates.primaryColor);
    });

    it('should validate color format', async () => {
      const invalidBranding = {
        primaryColor: 'invalid-color',
        secondaryColor: '#6c757d'
      };

      mockDatabase.query.mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM' }] });

      await expect(brandingService.updateBrandingSettings(tenantId, invalidBranding))
        .rejects.toThrow('Branding validation failed');
    });

    it('should validate logo position', async () => {
      const invalidBranding = {
        logoPosition: 'invalid-position' as any,
        primaryColor: '#007bff'
      };

      mockDatabase.query.mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM' }] });

      await expect(brandingService.updateBrandingSettings(tenantId, invalidBranding))
        .rejects.toThrow('Branding validation failed');
    });
  });

  describe('Branding Application', () => {
    it('should apply branding to email template', async () => {
      const templateId = 'template-1';
      const brandingId = 'branding-1';
      
      const mockBranding = {
        id: brandingId,
        logoUrl: 'https://example.com/logo.png',
        logoPosition: 'header',
        primaryColor: '#007bff',
        textColor: '#212529'
      };

      const mockTemplate = {
        id: templateId,
        htmlContent: '<html><body><h1>{{title}}</h1><p>{{content}}</p></body></html>',
        textContent: '{{title}}\n\n{{content}}'
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [mockBranding] }) // Get branding
        .mockResolvedValueOnce({ rows: [mockTemplate] }) // Get template
        .mockResolvedValueOnce({ rowCount: 1 }); // Update template

      const result = await brandingService.applyBrandingToTemplate(templateId, brandingId);

      expect(result.htmlContent).toContain(mockBranding.logoUrl);
      expect(result.htmlContent).toContain(mockBranding.primaryColor);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE email_templates SET html_content = $1'),
        expect.arrayContaining([expect.stringContaining(mockBranding.logoUrl)])
      );
    });

    it('should generate branding preview', async () => {
      const brandingSettings = {
        logoUrl: 'https://example.com/logo.png',
        logoPosition: 'header' as const,
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        textColor: '#212529',
        fontFamily: 'Arial, sans-serif'
      };

      const result = await brandingService.generateBrandPreview(brandingSettings);

      expect(result).toHaveProperty('previewHtml');
      expect(result).toHaveProperty('previewUrl');
      expect(result.previewHtml).toContain(brandingSettings.logoUrl);
      expect(result.previewHtml).toContain(brandingSettings.primaryColor);
    });
  });

  describe('Branding Retrieval', () => {
    it('should get current branding settings', async () => {
      const mockBranding = {
        id: 'branding-1',
        tenantId,
        logoUrl: 'https://example.com/logo.png',
        logoPosition: 'header',
        primaryColor: '#007bff',
        isActive: true
      };

      mockDatabase.query.mockResolvedValueOnce({ rows: [mockBranding] });

      const result = await brandingService.getBrandingSettings(tenantId);

      expect(result).toEqual(mockBranding);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM branding_settings WHERE tenant_id = $1 AND is_active = true'),
        [tenantId]
      );
    });

    it('should return default branding for users without custom settings', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] }); // No custom branding

      const result = await brandingService.getBrandingSettings(tenantId);

      expect(result).toHaveProperty('logoPosition', 'header');
      expect(result).toHaveProperty('primaryColor', '#007bff');
      expect(result).toHaveProperty('isActive', false);
    });
  });

  describe('Branding Integration Tests', () => {
    it('should complete full branding workflow', async () => {
      // Step 1: Upload logo
      const logoFile = {
        buffer: Buffer.from('fake-image-data'),
        originalname: 'company-logo.png',
        mimetype: 'image/png',
        size: 100000
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'upload-1' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      mockFileStorage.upload.mockResolvedValue({
        url: 'https://storage.example.com/logos/company-logo.png',
        key: 'logos/company-logo.png'
      });

      const uploadResult = await brandingService.uploadLogo(tenantId, logoFile);

      // Step 2: Update branding settings
      const brandingSettings = {
        logoUrl: uploadResult.logoUrl,
        logoPosition: 'header' as const,
        primaryColor: '#ff6b35',
        secondaryColor: '#004e89',
        textColor: '#2e2e2e',
        fontFamily: 'Helvetica, Arial, sans-serif'
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'branding-1',
            tenant_id: tenantId,
            ...brandingSettings,
            is_active: true
          }] 
        });

      const brandingResult = await brandingService.updateBrandingSettings(tenantId, brandingSettings);

      // Step 3: Apply to template
      const templateId = 'template-1';
      
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [brandingResult] })
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: templateId,
            htmlContent: '<html><body><h1>Welcome</h1><p>Thank you for joining!</p></body></html>'
          }] 
        })
        .mockResolvedValueOnce({ rowCount: 1 });

      const templateResult = await brandingService.applyBrandingToTemplate(templateId, brandingResult.id);

      expect(templateResult.htmlContent).toContain(brandingSettings.logoUrl);
      expect(templateResult.htmlContent).toContain(brandingSettings.primaryColor);

      // Step 4: Generate preview
      const previewResult = await brandingService.generateBrandPreview(brandingSettings);

      expect(previewResult.previewHtml).toContain(brandingSettings.logoUrl);
      expect(previewResult).toHaveProperty('previewUrl');
    });

    it('should handle branding removal', async () => {
      const brandingId = 'branding-to-remove';

      mockDatabase.query
        .mockResolvedValueOnce({ rowCount: 1 }) // Deactivate branding
        .mockResolvedValueOnce({ rows: [{ logo_url: 'https://example.com/logo.png' }] }); // Get logo URL

      mockFileStorage.delete.mockResolvedValue(true);

      await brandingService.removeBranding(tenantId, brandingId);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE branding_settings SET is_active = false'),
        [brandingId, tenantId]
      );
      expect(mockFileStorage.delete).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle file storage failures gracefully', async () => {
      const logoFile = {
        buffer: Buffer.from('fake-image-data'),
        originalname: 'logo.png',
        mimetype: 'image/png',
        size: 50000
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'upload-1' }] });

      mockFileStorage.upload.mockRejectedValue(new Error('Storage service unavailable'));

      await expect(brandingService.uploadLogo(tenantId, logoFile))
        .rejects.toThrow('Logo upload failed');

      // Verify upload status was marked as failed
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE logo_uploads SET status = $1'),
        ['FAILED', 'upload-1']
      );
    });

    it('should handle concurrent branding updates', async () => {
      const updates1 = { primaryColor: '#ff0000' };
      const updates2 = { primaryColor: '#00ff00' };

      mockDatabase.query
        .mockResolvedValue({ rows: [{ tier: 'PREMIUM' }] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [{ id: 'branding-1', ...updates1 }] });

      // Simulate concurrent updates
      const [result1, result2] = await Promise.allSettled([
        brandingService.updateBrandingSettings(tenantId, updates1),
        brandingService.updateBrandingSettings(tenantId, updates2)
      ]);

      // At least one should succeed
      expect(result1.status === 'fulfilled' || result2.status === 'fulfilled').toBe(true);
    });
  });
});