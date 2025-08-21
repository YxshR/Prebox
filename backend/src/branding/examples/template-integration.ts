/**
 * Template Integration Examples
 * 
 * This file demonstrates how to integrate the branding system
 * with email templates in various scenarios.
 */

import { brandingService } from '../branding.service';
import { templateBrandingService } from '../template-branding.service';
import { BrandingSettings, LogoPosition } from '../branding.types';
import { SubscriptionTier } from '../../shared/types';

/**
 * Example 1: Apply branding to a newsletter template
 */
export async function applyBrandingToNewsletter(
  tenantId: string,
  newsletterHtml: string
): Promise<string> {
  const brandingSettings = await brandingService.getBrandingSettings(tenantId);
  
  if (!brandingSettings) {
    // Apply default free tier branding
    return await templateBrandingService.applyDefaultBranding(newsletterHtml);
  }

  return await brandingService.applyBrandingToTemplate(newsletterHtml, brandingSettings);
}

/**
 * Example 2: Create a branded welcome email
 */
export async function createBrandedWelcomeEmail(
  tenantId: string,
  userName: string,
  subscriptionTier: SubscriptionTier
): Promise<string> {
  const baseTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to Our Platform</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div class="header-section">
          <h1 class="primary">Welcome, ${userName}!</h1>
        </div>
        
        <div class="content-section">
          <p>Thank you for joining our platform. We're excited to have you on board!</p>
          
          <div class="bg-secondary" style="padding: 20px; margin: 20px 0; border-radius: 8px;">
            <h2>Getting Started</h2>
            <ul>
              <li>Complete your profile setup</li>
              <li>Explore our features</li>
              <li>Create your first email campaign</li>
            </ul>
          </div>
          
          <p>If you have any questions, don't hesitate to reach out to our support team.</p>
        </div>
        
        <div class="footer-section">
          <p style="font-size: 14px; color: #6c757d;">
            Best regards,<br>
            The Team
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Check if user has branding access
  const shouldApplyBranding = await templateBrandingService.shouldApplyBranding(
    tenantId, 
    subscriptionTier
  );

  if (shouldApplyBranding) {
    return await applyBrandingToNewsletter(tenantId, baseTemplate);
  } else {
    return await templateBrandingService.applyDefaultBranding(baseTemplate);
  }
}

/**
 * Example 3: Create a promotional email with dynamic branding
 */
export async function createPromotionalEmail(
  tenantId: string,
  promoData: {
    title: string;
    description: string;
    ctaText: string;
    ctaUrl: string;
  }
): Promise<string> {
  const baseTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${promoData.title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div class="header-section">
          <h1 class="primary">${promoData.title}</h1>
        </div>
        
        <div class="content-section">
          <p>${promoData.description}</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${promoData.ctaUrl}" 
               class="bg-primary" 
               style="display: inline-block; padding: 15px 30px; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              ${promoData.ctaText}
            </a>
          </div>
        </div>
        
        <div class="footer-section">
          <p style="font-size: 12px; color: #6c757d;">
            This is a promotional email. If you no longer wish to receive these emails, 
            <a href="#unsubscribe">unsubscribe here</a>.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await applyBrandingToNewsletter(tenantId, baseTemplate);
}

/**
 * Example 4: Apply branding with custom logo positioning
 */
export async function applyCustomLogoBranding(
  tenantId: string,
  templateHtml: string,
  logoPosition: LogoPosition
): Promise<string> {
  const brandingSettings = await brandingService.getBrandingSettings(tenantId);
  
  if (!brandingSettings) {
    return templateHtml;
  }

  // Temporarily override logo position
  const customSettings: BrandingSettings = {
    ...brandingSettings,
    logoPosition
  };

  return await brandingService.applyBrandingToTemplate(templateHtml, customSettings);
}

/**
 * Example 5: Create a transactional email with minimal branding
 */
export async function createTransactionalEmail(
  tenantId: string,
  emailData: {
    subject: string;
    content: string;
    actionUrl?: string;
    actionText?: string;
  }
): Promise<string> {
  const baseTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${emailData.subject}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; padding: 20px;">
        <div class="content-section">
          ${emailData.content}
          
          ${emailData.actionUrl && emailData.actionText ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${emailData.actionUrl}" 
                 class="bg-primary" 
                 style="display: inline-block; padding: 12px 24px; color: white; text-decoration: none; border-radius: 4px;">
                ${emailData.actionText}
              </a>
            </div>
          ` : ''}
        </div>
        
        <div class="footer-section" style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef;">
          <p style="font-size: 12px; color: #6c757d; margin: 0;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  // For transactional emails, use minimal branding (logo in footer only)
  return await applyCustomLogoBranding(tenantId, baseTemplate, LogoPosition.FOOTER);
}

/**
 * Example 6: Batch apply branding to multiple templates
 */
export async function batchApplyBranding(
  tenantId: string,
  templates: Array<{ id: string; html: string }>
): Promise<Array<{ id: string; originalHtml: string; brandedHtml: string }>> {
  const results = [];

  for (const template of templates) {
    try {
      const brandedHtml = await applyBrandingToNewsletter(tenantId, template.html);
      results.push({
        id: template.id,
        originalHtml: template.html,
        brandedHtml
      });
    } catch (error) {
      console.error(`Failed to apply branding to template ${template.id}:`, error);
      // Include original HTML as fallback
      results.push({
        id: template.id,
        originalHtml: template.html,
        brandedHtml: template.html
      });
    }
  }

  return results;
}

/**
 * Example 7: Generate preview with different branding options
 */
export async function generateBrandingPreviews(
  tenantId: string,
  templateHtml: string
): Promise<{
  original: string;
  headerLogo: string;
  footerLogo: string;
  sidebarLogo: string;
  customColors: string;
}> {
  const brandingSettings = await brandingService.getBrandingSettings(tenantId);
  
  if (!brandingSettings) {
    const defaultPreview = await templateBrandingService.applyDefaultBranding(templateHtml);
    return {
      original: templateHtml,
      headerLogo: defaultPreview,
      footerLogo: defaultPreview,
      sidebarLogo: defaultPreview,
      customColors: defaultPreview
    };
  }

  const [headerLogo, footerLogo, sidebarLogo, customColors] = await Promise.all([
    brandingService.applyBrandingToTemplate(templateHtml, {
      ...brandingSettings,
      logoPosition: LogoPosition.HEADER
    }),
    brandingService.applyBrandingToTemplate(templateHtml, {
      ...brandingSettings,
      logoPosition: LogoPosition.FOOTER
    }),
    brandingService.applyBrandingToTemplate(templateHtml, {
      ...brandingSettings,
      logoPosition: LogoPosition.SIDEBAR
    }),
    brandingService.applyBrandingToTemplate(templateHtml, {
      ...brandingSettings,
      primaryColor: '#e11d48',
      secondaryColor: '#fef2f2',
      textColor: '#991b1b'
    })
  ]);

  return {
    original: templateHtml,
    headerLogo,
    footerLogo,
    sidebarLogo,
    customColors
  };
}

/**
 * Example 8: Validate branding before applying
 */
export async function safeApplyBranding(
  tenantId: string,
  templateHtml: string,
  subscriptionTier: SubscriptionTier
): Promise<{ success: boolean; html: string; error?: string }> {
  try {
    // Check subscription tier access
    const hasAccess = subscriptionTier !== SubscriptionTier.FREE;
    
    if (!hasAccess) {
      const defaultBrandedHtml = await templateBrandingService.applyDefaultBranding(templateHtml);
      return {
        success: true,
        html: defaultBrandedHtml
      };
    }

    // Get and validate branding settings
    const brandingSettings = await brandingService.getBrandingSettings(tenantId);
    
    if (!brandingSettings) {
      return {
        success: false,
        html: templateHtml,
        error: 'No branding settings found'
      };
    }

    // Apply branding
    const brandedHtml = await brandingService.applyBrandingToTemplate(
      templateHtml,
      brandingSettings
    );

    return {
      success: true,
      html: brandedHtml
    };

  } catch (error) {
    return {
      success: false,
      html: templateHtml,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Export all examples
export const BrandingExamples = {
  applyBrandingToNewsletter,
  createBrandedWelcomeEmail,
  createPromotionalEmail,
  applyCustomLogoBranding,
  createTransactionalEmail,
  batchApplyBranding,
  generateBrandingPreviews,
  safeApplyBranding
};