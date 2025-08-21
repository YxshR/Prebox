import { brandingService } from '../branding.service';
import { templateBrandingService } from '../template-branding.service';
import { LogoPosition, UploadStatus } from '../branding.types';
import { SubscriptionTier } from '../../shared/types';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('fs/promises');

describe('Branding Integration Tests', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      connect: jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      })
    };
    (brandingService as any).db = mockDb;
    jest.clearAllMocks();
  });

  describe('Branding Service Integration', () => {
    it('should validate logo file correctly', async () => {
      const mockFile = {
        originalname: 'test-logo.png',
        mimetype: 'image/png',
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from('fake-image-data')
      } as Express.Multer.File;

      const validation = (brandingService as any).validateLogoFile(mockFile);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject oversized files', async () => {
      const mockFile = {
        originalname: 'large-logo.png',
        mimetype: 'image/png',
        size: 10 * 1024 * 1024, // 10MB
        buffer: Buffer.from('fake-image-data')
      } as Express.Multer.File;

      const validation = (brandingService as any).validateLogoFile(mockFile);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid file types', async () => {
      const mockFile = {
        originalname: 'document.txt',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('text content')
      } as Express.Multer.File;

      const validation = (brandingService as any).validateLogoFile(mockFile);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Branding Settings Validation', () => {
    it('should validate branding settings correctly', async () => {
      const validSettings = {
        logoPosition: LogoPosition.HEADER,
        primaryColor: '#3b82f6',
        secondaryColor: '#ffffff',
        textColor: '#374151',
        fontFamily: 'Inter, sans-serif'
      };

      const validation = (brandingService as any).validateBrandingSettings(validSettings);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid color formats', async () => {
      const invalidSettings = {
        primaryColor: 'invalid-color',
        secondaryColor: 'not-a-color'
      };

      const validation = (brandingService as any).validateBrandingSettings(invalidSettings);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid logo positions', async () => {
      const invalidSettings = {
        logoPosition: 'invalid-position' as LogoPosition
      };

      const validation = (brandingService as any).validateBrandingSettings(invalidSettings);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Template Branding Integration', () => {
    it('should apply branding to template correctly', async () => {
      const templateHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body><h1 class="primary">Hello World</h1></body>
        </html>
      `;

      const brandingSettings = {
        id: 'test-id',
        tenantId: 'test-tenant',
        logoUrl: '/path/to/logo.png',
        logoPosition: LogoPosition.HEADER,
        primaryColor: '#3b82f6',
        secondaryColor: '#ffffff',
        textColor: '#374151',
        fontFamily: 'Inter, sans-serif',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await brandingService.applyBrandingToTemplate(templateHtml, brandingSettings);
      
      expect(result).toContain('logo.png');
      expect(result).toContain('#3b82f6');
      expect(result).toContain('Inter, sans-serif');
    });

    it('should check subscription tier access correctly', async () => {
      const hasAccess = (brandingService as any).hasLogoAccess(SubscriptionTier.PAID_STANDARD);
      const noAccess = (brandingService as any).hasLogoAccess(SubscriptionTier.FREE);
      
      expect(hasAccess).toBe(true);
      expect(noAccess).toBe(false);
    });
  });

  describe('Template Branding Service', () => {
    it('should determine branding application correctly', async () => {
      const shouldApplyForPaid = await templateBrandingService.shouldApplyBranding(
        'test-tenant',
        SubscriptionTier.PAID_STANDARD
      );
      
      const shouldApplyForFree = await templateBrandingService.shouldApplyBranding(
        'test-tenant',
        SubscriptionTier.FREE
      );

      expect(shouldApplyForFree).toBe(false);
      // shouldApplyForPaid depends on having branding settings, which we're mocking
    });

    it('should provide default free tier branding', async () => {
      const defaultBranding = templateBrandingService.getDefaultFreeTierBranding();
      
      expect(defaultBranding).toHaveProperty('logoPosition');
      expect(defaultBranding).toHaveProperty('primaryColor');
      expect(defaultBranding).toHaveProperty('customCss');
    });

    it('should apply default branding to template', async () => {
      const templateHtml = '<html><body><h1>Test</h1></body></html>';
      const brandedHtml = await templateBrandingService.applyDefaultBranding(templateHtml);
      
      expect(brandedHtml).toContain('Powered by');
      expect(brandedHtml.length).toBeGreaterThan(templateHtml.length);
    });
  });
});