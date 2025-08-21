import { EmailTemplate, TemplateVariable } from '../shared/types';
import { AITemplateRequest } from './ai-template.types';

export interface FallbackTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: TemplateVariable[];
}

export class AIFallbackService {
  private static templateLibrary: Map<string, FallbackTemplate[]> = new Map();

  static {
    // Initialize fallback templates
    this.initializeFallbackTemplates();
  }

  /**
   * Get a fallback template when AI services are unavailable
   */
  static getFallbackTemplate(request: AITemplateRequest): FallbackTemplate {
    const templateType = request.templateType || 'custom';
    const templates = this.templateLibrary.get(templateType) || this.templateLibrary.get('custom')!;
    
    // Select template based on tone or randomly
    let selectedTemplate = templates[0];
    
    if (request.tone) {
      const toneBasedTemplate = templates.find(t => 
        t.subject.toLowerCase().includes(request.tone?.toLowerCase() || '')
      );
      if (toneBasedTemplate) {
        selectedTemplate = toneBasedTemplate;
      }
    }

    // Customize template with request data
    return this.customizeTemplate(selectedTemplate, request);
  }

  /**
   * Check if fallback templates are available for a given type
   */
  static hasFallbackTemplate(templateType: string): boolean {
    return this.templateLibrary.has(templateType) || this.templateLibrary.has('custom');
  }

  /**
   * Get available fallback template types
   */
  static getAvailableTypes(): string[] {
    return Array.from(this.templateLibrary.keys());
  }

  /**
   * Customize a fallback template with request-specific data
   */
  private static customizeTemplate(template: FallbackTemplate, request: AITemplateRequest): FallbackTemplate {
    let customizedSubject = template.subject;
    let customizedHtml = template.htmlContent;
    let customizedText = template.textContent;

    // Replace placeholders with request data
    const replacements: Record<string, string> = {
      '{{brandName}}': request.brandName || 'Your Company',
      '{{industry}}': request.industry || 'business',
      '{{targetAudience}}': request.targetAudience || 'customers',
      '{{callToAction}}': request.callToAction || 'Learn More'
    };

    // Apply replacements
    Object.entries(replacements).forEach(([placeholder, value]) => {
      customizedSubject = customizedSubject.replace(new RegExp(placeholder, 'g'), value);
      customizedHtml = customizedHtml.replace(new RegExp(placeholder, 'g'), value);
      customizedText = customizedText.replace(new RegExp(placeholder, 'g'), value);
    });

    return {
      subject: customizedSubject,
      htmlContent: customizedHtml,
      textContent: customizedText,
      variables: template.variables
    };
  }

  /**
   * Initialize the fallback template library
   */
  private static initializeFallbackTemplates(): void {
    // Welcome templates
    this.templateLibrary.set('welcome', [
      {
        subject: 'Welcome to {{brandName}}!',
        htmlContent: `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .cta { background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Welcome to {{brandName}}!</h1>
                </div>
                <div class="content">
                  <p>Hi {{firstName}},</p>
                  <p>Thank you for joining {{brandName}}! We're excited to have you as part of our {{targetAudience}} community.</p>
                  <p>Here's what you can expect:</p>
                  <ul>
                    <li>Access to our premium features</li>
                    <li>Regular updates and insights</li>
                    <li>Dedicated customer support</li>
                  </ul>
                  <a href="#" class="cta">{{callToAction}}</a>
                </div>
                <div class="footer">
                  <p>&copy; 2024 {{brandName}}. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `,
        textContent: `Welcome to {{brandName}}!\n\nHi {{firstName}},\n\nThank you for joining {{brandName}}! We're excited to have you as part of our {{targetAudience}} community.\n\nHere's what you can expect:\n- Access to our premium features\n- Regular updates and insights\n- Dedicated customer support\n\n{{callToAction}}\n\n© 2024 {{brandName}}. All rights reserved.`,
        variables: [
          { name: 'firstName', type: 'text', required: true },
          { name: 'brandName', type: 'text', required: true },
          { name: 'targetAudience', type: 'text', required: false },
          { name: 'callToAction', type: 'text', required: false }
        ]
      }
    ]);

    // Promotional templates
    this.templateLibrary.set('promotional', [
      {
        subject: 'Special Offer from {{brandName}} - Don\'t Miss Out!',
        htmlContent: `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #e74c3c; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .offer { background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; margin: 20px 0; text-align: center; }
                .cta { background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; font-weight: bold; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Special Offer Just for You!</h1>
                </div>
                <div class="content">
                  <p>Hi {{firstName}},</p>
                  <p>We have an exclusive offer for our valued {{targetAudience}}!</p>
                  <div class="offer">
                    <h2>Limited Time Offer</h2>
                    <p>Get {{discountPercent}}% off your next purchase</p>
                    <p><strong>Use code: {{promoCode}}</strong></p>
                  </div>
                  <p>This offer is valid until {{expiryDate}}. Don't miss out!</p>
                  <a href="#" class="cta">{{callToAction}}</a>
                </div>
                <div class="footer">
                  <p>&copy; 2024 {{brandName}}. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `,
        textContent: `Special Offer from {{brandName}} - Don't Miss Out!\n\nHi {{firstName}},\n\nWe have an exclusive offer for our valued {{targetAudience}}!\n\nLIMITED TIME OFFER\nGet {{discountPercent}}% off your next purchase\nUse code: {{promoCode}}\n\nThis offer is valid until {{expiryDate}}. Don't miss out!\n\n{{callToAction}}\n\n© 2024 {{brandName}}. All rights reserved.`,
        variables: [
          { name: 'firstName', type: 'text', required: true },
          { name: 'brandName', type: 'text', required: true },
          { name: 'targetAudience', type: 'text', required: false },
          { name: 'discountPercent', type: 'number', required: true },
          { name: 'promoCode', type: 'text', required: true },
          { name: 'expiryDate', type: 'date', required: true },
          { name: 'callToAction', type: 'text', required: false }
        ]
      }
    ]);

    // Newsletter templates
    this.templateLibrary.set('newsletter', [
      {
        subject: '{{brandName}} Newsletter - {{monthYear}}',
        htmlContent: `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #6c757d; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .article { border-bottom: 1px solid #dee2e6; padding: 20px 0; }
                .article:last-child { border-bottom: none; }
                .cta { background-color: #17a2b8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>{{brandName}} Newsletter</h1>
                  <p>{{monthYear}}</p>
                </div>
                <div class="content">
                  <p>Hi {{firstName}},</p>
                  <p>Here's what's new at {{brandName}} this month:</p>
                  
                  <div class="article">
                    <h3>{{articleTitle1}}</h3>
                    <p>{{articleSummary1}}</p>
                    <a href="#" class="cta">Read More</a>
                  </div>
                  
                  <div class="article">
                    <h3>{{articleTitle2}}</h3>
                    <p>{{articleSummary2}}</p>
                    <a href="#" class="cta">Read More</a>
                  </div>
                  
                  <p>Thank you for being part of our {{targetAudience}} community!</p>
                </div>
                <div class="footer">
                  <p>&copy; 2024 {{brandName}}. All rights reserved.</p>
                  <p><a href="#">Unsubscribe</a> | <a href="#">Update Preferences</a></p>
                </div>
              </div>
            </body>
          </html>
        `,
        textContent: `{{brandName}} Newsletter - {{monthYear}}\n\nHi {{firstName}},\n\nHere's what's new at {{brandName}} this month:\n\n{{articleTitle1}}\n{{articleSummary1}}\nRead More: [link]\n\n{{articleTitle2}}\n{{articleSummary2}}\nRead More: [link]\n\nThank you for being part of our {{targetAudience}} community!\n\n© 2024 {{brandName}}. All rights reserved.\nUnsubscribe | Update Preferences`,
        variables: [
          { name: 'firstName', type: 'text', required: true },
          { name: 'brandName', type: 'text', required: true },
          { name: 'monthYear', type: 'text', required: true },
          { name: 'targetAudience', type: 'text', required: false },
          { name: 'articleTitle1', type: 'text', required: true },
          { name: 'articleSummary1', type: 'text', required: true },
          { name: 'articleTitle2', type: 'text', required: true },
          { name: 'articleSummary2', type: 'text', required: true }
        ]
      }
    ]);

    // Custom/default template
    this.templateLibrary.set('custom', [
      {
        subject: 'Message from {{brandName}}',
        htmlContent: `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .cta { background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>{{brandName}}</h1>
                </div>
                <div class="content">
                  <p>Hi {{firstName}},</p>
                  <p>We hope this message finds you well.</p>
                  <p>{{customMessage}}</p>
                  <a href="#" class="cta">{{callToAction}}</a>
                  <p>Best regards,<br>The {{brandName}} Team</p>
                </div>
                <div class="footer">
                  <p>&copy; 2024 {{brandName}}. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `,
        textContent: `Message from {{brandName}}\n\nHi {{firstName}},\n\nWe hope this message finds you well.\n\n{{customMessage}}\n\n{{callToAction}}\n\nBest regards,\nThe {{brandName}} Team\n\n© 2024 {{brandName}}. All rights reserved.`,
        variables: [
          { name: 'firstName', type: 'text', required: true },
          { name: 'brandName', type: 'text', required: true },
          { name: 'customMessage', type: 'text', required: true },
          { name: 'callToAction', type: 'text', required: false }
        ]
      }
    ]);
  }

  /**
   * Create an EmailTemplate from a fallback template
   */
  static createEmailTemplate(
    fallbackTemplate: FallbackTemplate,
    tenantId: string,
    templateName?: string
  ): EmailTemplate {
    return {
      id: this.generateId('fallback_template'),
      tenantId,
      name: templateName || 'Fallback Template',
      subject: fallbackTemplate.subject,
      htmlContent: fallbackTemplate.htmlContent,
      textContent: fallbackTemplate.textContent,
      variables: fallbackTemplate.variables,
      isAIGenerated: false, // Mark as fallback, not AI-generated
      createdAt: new Date()
    };
  }

  private static generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}