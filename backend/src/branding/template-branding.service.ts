import { brandingService } from './branding.service';
import { BrandingSettings, TemplateWithBranding } from './branding.types';

export class TemplateBrandingService {
  /**
   * Apply branding to multiple email templates
   */
  async applyBrandingToTemplates(
    tenantId: string,
    templateIds: string[]
  ): Promise<TemplateWithBranding[]> {
    const brandingSettings = await brandingService.getBrandingSettings(tenantId);
    
    if (!brandingSettings) {
      throw new Error('No branding settings found for tenant');
    }

    const results: TemplateWithBranding[] = [];

    for (const templateId of templateIds) {
      try {
        const originalHtml = await this.getTemplateHtml(templateId);
        const brandedHtml = await brandingService.applyBrandingToTemplate(
          originalHtml,
          brandingSettings
        );

        results.push({
          templateId,
          originalHtml,
          brandedHtml,
          brandingSettings
        });
      } catch (error) {
        console.error(`Failed to apply branding to template ${templateId}:`, error);
        // Continue with other templates
      }
    }

    return results;
  }

  /**
   * Apply branding to a single template
   */
  async applyBrandingToTemplate(
    tenantId: string,
    templateId: string
  ): Promise<TemplateWithBranding> {
    const brandingSettings = await brandingService.getBrandingSettings(tenantId);
    
    if (!brandingSettings) {
      throw new Error('No branding settings found for tenant');
    }

    const originalHtml = await this.getTemplateHtml(templateId);
    const brandedHtml = await brandingService.applyBrandingToTemplate(
      originalHtml,
      brandingSettings
    );

    return {
      templateId,
      originalHtml,
      brandedHtml,
      brandingSettings
    };
  }

  /**
   * Check if branding should be applied based on subscription tier
   */
  async shouldApplyBranding(tenantId: string, subscriptionTier: string): Promise<boolean> {
    // Free tier users don't get logo customization
    if (subscriptionTier === 'free') {
      return false;
    }

    const brandingSettings = await brandingService.getBrandingSettings(tenantId);
    return brandingSettings !== null && brandingSettings.isActive;
  }

  /**
   * Get default branding for free tier users
   */
  getDefaultFreeTierBranding(): Partial<BrandingSettings> {
    return {
      logoPosition: 'footer' as any,
      primaryColor: '#6366f1',
      secondaryColor: '#ffffff',
      textColor: '#374151',
      fontFamily: 'Arial, sans-serif',
      customCss: `
        .footer-branding {
          text-align: center;
          padding: 20px;
          background-color: #f9fafb;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
        }
        .footer-branding a {
          color: #6366f1;
          text-decoration: none;
        }
      `
    };
  }

  /**
   * Apply default branding for free tier
   */
  async applyDefaultBranding(templateHtml: string): Promise<string> {
    const defaultBranding = this.getDefaultFreeTierBranding();
    
    // Add default footer branding for free tier
    const footerBranding = `
      <div class="footer-branding">
        <p>Powered by <a href="https://yourdomain.com" target="_blank">Your Email Platform</a></p>
        <p>Upgrade to remove this branding</p>
      </div>
    `;

    // Insert before closing body tag
    let brandedHtml = templateHtml.replace(
      '</body>',
      `${footerBranding}</body>`
    );

    // Add default styles
    const defaultStyles = `
      <style>
        ${defaultBranding.customCss}
      </style>
    `;

    brandedHtml = brandedHtml.replace('</head>', `${defaultStyles}</head>`);

    return brandedHtml;
  }

  /**
   * Remove branding from template (for testing purposes)
   */
  async removeBrandingFromTemplate(templateHtml: string): Promise<string> {
    // Remove logo elements
    let cleanHtml = templateHtml.replace(
      /<div[^>]*class="[^"]*logo[^"]*"[^>]*>.*?<\/div>/gi,
      ''
    );

    // Remove branding styles
    cleanHtml = cleanHtml.replace(
      /<style[^>]*>[\s\S]*?<\/style>/gi,
      ''
    );

    // Remove footer branding
    cleanHtml = cleanHtml.replace(
      /<div[^>]*class="[^"]*footer-branding[^"]*"[^>]*>.*?<\/div>/gi,
      ''
    );

    return cleanHtml;
  }

  // Private helper methods

  private async getTemplateHtml(templateId: string): Promise<string> {
    // In production, this would fetch from the template service/database
    // For now, return a sample template
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Template</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h1>Welcome to Our Newsletter</h1>
          <p>This is a sample email template that will be customized with your branding.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <h2>Featured Content</h2>
            <p>This section will showcase your primary content with your brand colors.</p>
          </div>
          
          <p>Thank you for choosing our service!</p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef;">
            <p style="font-size: 14px; color: #6c757d;">
              Best regards,<br>
              The Team
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const templateBrandingService = new TemplateBrandingService();