import { BrandingService } from '../branding.service';
import { LogoPosition, UploadStatus } from '../branding.types';
import { SubscriptionTier } from '../../shared/types';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('fs/promises');

describe('BrandingService', () => {
  let brandingService: BrandingService;
  let mockDb: any;

  beforeEach(() => {
    brandingService = new BrandingService();
    mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      connect: jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      })
    };
    (brandingService as any).db = mockDb;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadLogo', () => {
    const mockFile = {
      originalname: 'test-logo.png',
      mimetype: 'image/png',
      size: 1024 * 1024, // 1MB
      buffer: Buffer.from('fake-image-data')
    } as Express.Multer.File;

    it('should upload logo successfully for paid users', async () => {
      const tenantId = 'test-tenant-id';
      const subscriptionTier = SubscriptionTier.PAID_STANDARD;

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'upload-id',
          tenant_id: tenantId,
          original_filename: mockFile.originalname,
          stored_filename: 'upload-id.png',
          file_path: '/path/to/file',
          file_size: mockFile.size,
          mime_type: mockFile.mimetype,
          upload_status: UploadStatus.COMPLETED,
          created_at: new Date()
        }]
      });

      const result = await brandingService.uploadLogo(tenantId, mockFile, subscriptionTier);

      expect(result).toHaveProperty('logoUrl');
      expect(result).toHaveProperty('fileSize', mockFile.size);
      expect(result).toHaveProperty('uploadId');
    });

    it('should reject logo upload for free tier users', async () => {
      const tenantId = 'test-tenant-id';
      const subscriptionTier = SubscriptionTier.FREE;

      await expect(
        brandingService.uploadLogo(tenantId, mockFile, subscriptionTier)
      ).rejects.toThrow('Logo customization is not available for your subscription tier');
    });

    it('should validate file size limits', async () => {
      const tenantId = 'test-tenant-id';
      const subscriptionTier = SubscriptionTier.PAID_STANDARD;
      const largeFile = {
        ...mockFile,
        size: 10 * 1024 * 1024 // 10MB (exceeds 5MB limit)
      };

      await expect(
        brandingService.uploadLogo(tenantId, largeFile, subscriptionTier)
      ).rejects.toThrow('Logo validation failed');
    });

    it('should validate file type', async () => {
      const tenantId = 'test-tenant-id';
      const subscriptionTier = SubscriptionTier.PAID_STANDARD;
      const invalidFile = {
        ...mockFile,
        mimetype: 'text/plain',
        originalname: 'test.txt'
      };

      await expect(
        brandingService.uploadLogo(tenantId, invalidFile, subscriptionTier)
      ).rejects.toThrow('Logo validation failed');
    });
  });

  describe('updateBrandingSettings', () => {
    it('should update branding settings successfully', async () => {
      const tenantId = 'test-tenant-id';
      const updates = {
        logoPosition: LogoPosition.HEADER,
        primaryColor: '#3b82f6',
        secondaryColor: '#ffffff'
      };

      // Mock existing settings
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'settings-id',
          tenant_id: tenantId,
          logo_position: LogoPosition.FOOTER,
          primary_color: '#000000',
          secondary_color: '#ffffff',
          text_color: '#333333',
          font_family: 'Arial, sans-serif',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      // Mock update query
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'settings-id',
          tenant_id: tenantId,
          logo_position: updates.logoPosition,
          primary_color: updates.primaryColor,
          secondary_color: updates.secondaryColor,
          text_color: '#333333',
          font_family: 'Arial, sans-serif',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const result = await brandingService.updateBrandingSettings(tenantId, updates);

      expect(result.logoPosition).toBe(updates.logoPosition);
      expect(result.primaryColor).toBe(updates.primaryColor);
      expect(result.secondaryColor).toBe(updates.secondaryColor);
    });

    it('should validate color format', async () => {
      const tenantId = 'test-tenant-id';
      const invalidUpdates = {
        primaryColor: 'invalid-color'
      };

      await expect(
        brandingService.updateBrandingSettings(tenantId, invalidUpdates)
      ).rejects.toThrow('Branding validation failed');
    });

    it('should validate logo position', async () => {
      const tenantId = 'test-tenant-id';
      const invalidUpdates = {
        logoPosition: 'invalid-position' as LogoPosition
      };

      await expect(
        brandingService.updateBrandingSettings(tenantId, invalidUpdates)
      ).rejects.toThrow('Branding validation failed');
    });
  });

  describe('getBrandingSettings', () => {
    it('should return branding settings for tenant', async () => {
      const tenantId = 'test-tenant-id';
      const mockSettings = {
        id: 'settings-id',
        tenant_id: tenantId,
        logo_url: '/path/to/logo.png',
        logo_position: LogoPosition.HEADER,
        primary_color: '#3b82f6',
        secondary_color: '#ffffff',
        text_color: '#333333',
        font_family: 'Arial, sans-serif',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [mockSettings]
      });

      const result = await brandingService.getBrandingSettings(tenantId);

      expect(result).toBeDefined();
      expect(result?.tenantId).toBe(tenantId);
      expect(result?.logoPosition).toBe(LogoPosition.HEADER);
      expect(result?.primaryColor).toBe('#3b82f6');
    });

    it('should return null when no settings exist', async () => {
      const tenantId = 'test-tenant-id';

      mockDb.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await brandingService.getBrandingSettings(tenantId);

      expect(result).toBeNull();
    });
  });

  describe('applyBrandingToTemplate', () => {
    it('should apply branding to email template', async () => {
      const templateHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body><h1>Hello World</h1></body>
        </html>
      `;

      const brandingSettings = {
        id: 'settings-id',
        tenantId: 'test-tenant-id',
        logoUrl: '/path/to/logo.png',
        logoPosition: LogoPosition.HEADER,
        primaryColor: '#3b82f6',
        secondaryColor: '#ffffff',
        textColor: '#333333',
        fontFamily: 'Arial, sans-serif',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await brandingService.applyBrandingToTemplate(
        templateHtml,
        brandingSettings
      );

      expect(result).toContain('logo.png');
      expect(result).toContain('#3b82f6');
      expect(result).toContain('Arial, sans-serif');
    });
  });

  describe('deleteLogo', () => {
    it('should delete logo and update settings', async () => {
      const tenantId = 'test-tenant-id';

      // Mock getting current settings
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'settings-id',
          tenant_id: tenantId,
          logo_url: '/path/to/logo.png',
          logo_position: LogoPosition.HEADER,
          primary_color: '#3b82f6',
          secondary_color: '#ffffff',
          text_color: '#333333',
          font_family: 'Arial, sans-serif',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      // Mock update settings
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'settings-id',
          tenant_id: tenantId,
          logo_url: null,
          logo_position: LogoPosition.HEADER,
          primary_color: '#3b82f6',
          secondary_color: '#ffffff',
          text_color: '#333333',
          font_family: 'Arial, sans-serif',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      await expect(brandingService.deleteLogo(tenantId)).resolves.not.toThrow();
    });
  });
});