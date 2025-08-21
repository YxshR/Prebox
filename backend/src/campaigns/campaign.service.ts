import { Campaign, CampaignStatus, CampaignMetrics, EmailTemplate, TemplateVariable } from '../shared/types';
import { EmailService } from '../emails/email.service';
import { EmailJob, EmailPriority, EmailEvent } from '../emails/types';
import { EmailQueue } from '../emails/queue/email.queue';
import { EmailDeliveryTrackingService } from '../emails/delivery-tracking.service';

export interface CreateCampaignRequest {
  tenantId: string;
  name: string;
  templateId: string;
  listIds: string[];
  scheduledAt?: Date;
  priority?: EmailPriority;
}

export interface CreateTemplateRequest {
  tenantId: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables?: TemplateVariable[];
  isAIGenerated?: boolean;
}

export interface CampaignSendRequest {
  campaignId: string;
  contacts: Array<{
    email: string;
    firstName?: string;
    lastName?: string;
    customFields?: Record<string, any>;
  }>;
  variables?: Record<string, any>;
}

export class CampaignService {
  private emailService: EmailService;
  private emailQueue: EmailQueue;
  private deliveryTracker: EmailDeliveryTrackingService;
  private campaigns: Map<string, Campaign> = new Map();
  private templates: Map<string, EmailTemplate> = new Map();

  constructor(emailService: EmailService) {
    this.emailService = emailService;
    this.emailQueue = new EmailQueue(emailService);
    this.deliveryTracker = new EmailDeliveryTrackingService();
    
    // Set up campaign tracking callbacks
    this.emailQueue.setCampaignCallbacks({
      onEmailSent: this.handleEmailSent.bind(this),
      onEmailFailed: this.handleEmailFailed.bind(this),
      onBatchCompleted: this.handleBatchCompleted.bind(this)
    });
  }

  async createTemplate(request: CreateTemplateRequest): Promise<EmailTemplate> {
    const template: EmailTemplate = {
      id: this.generateId('template'),
      tenantId: request.tenantId,
      name: request.name,
      subject: request.subject,
      htmlContent: request.htmlContent,
      textContent: request.textContent || this.extractTextFromHtml(request.htmlContent),
      variables: request.variables || this.extractVariables(request.htmlContent, request.subject),
      isAIGenerated: request.isAIGenerated || false,
      createdAt: new Date()
    };

    // Store template (in production, this would be saved to database)
    this.templates.set(template.id, template);

    console.log(`✅ Created email template: ${template.name} (${template.id})`);
    return template;
  }

  async getTemplate(templateId: string, tenantId: string): Promise<EmailTemplate | null> {
    const template = this.templates.get(templateId);
    
    if (!template || template.tenantId !== tenantId) {
      return null;
    }
    
    return template;
  }

  async listTemplates(tenantId: string): Promise<EmailTemplate[]> {
    return Array.from(this.templates.values())
      .filter(template => template.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateTemplate(templateId: string, tenantId: string, updates: Partial<CreateTemplateRequest>): Promise<EmailTemplate | null> {
    const template = this.templates.get(templateId);
    
    if (!template || template.tenantId !== tenantId) {
      return null;
    }

    const updatedTemplate: EmailTemplate = {
      ...template,
      ...updates,
      variables: updates.variables || this.extractVariables(
        updates.htmlContent || template.htmlContent,
        updates.subject || template.subject
      )
    };

    this.templates.set(templateId, updatedTemplate);
    console.log(`✅ Updated email template: ${updatedTemplate.name} (${templateId})`);
    
    return updatedTemplate;
  }

  async createCampaign(request: CreateCampaignRequest): Promise<Campaign> {
    // Validate template exists
    const template = await this.getTemplate(request.templateId, request.tenantId);
    if (!template) {
      throw new Error(`Template not found: ${request.templateId}`);
    }

    const campaign: Campaign = {
      id: this.generateId('campaign'),
      tenantId: request.tenantId,
      name: request.name,
      templateId: request.templateId,
      listIds: request.listIds,
      status: request.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT,
      scheduledAt: request.scheduledAt,
      metrics: {
        totalRecipients: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0,
        unsubscribed: 0,
        complained: 0
      }
    };

    // Store campaign (in production, this would be saved to database)
    this.campaigns.set(campaign.id, campaign);

    console.log(`✅ Created campaign: ${campaign.name} (${campaign.id})`);
    return campaign;
  }

  async getCampaign(campaignId: string, tenantId: string): Promise<Campaign | null> {
    const campaign = this.campaigns.get(campaignId);
    
    if (!campaign || campaign.tenantId !== tenantId) {
      return null;
    }
    
    return campaign;
  }

  async listCampaigns(tenantId: string): Promise<Campaign[]> {
    return Array.from(this.campaigns.values())
      .filter(campaign => campaign.tenantId === tenantId)
      .sort((a, b) => {
        // Sort by scheduled date if available, otherwise by creation order
        if (a.scheduledAt && b.scheduledAt) {
          return b.scheduledAt.getTime() - a.scheduledAt.getTime();
        }
        return b.id.localeCompare(a.id);
      });
  }

  async updateCampaignStatus(campaignId: string, tenantId: string, status: CampaignStatus): Promise<Campaign | null> {
    const campaign = this.campaigns.get(campaignId);
    
    if (!campaign || campaign.tenantId !== tenantId) {
      return null;
    }

    campaign.status = status;
    
    if (status === CampaignStatus.SENT) {
      campaign.sentAt = new Date();
    }

    this.campaigns.set(campaignId, campaign);
    console.log(`✅ Updated campaign status: ${campaignId} -> ${status}`);
    
    return campaign;
  }

  async sendCampaign(request: CampaignSendRequest): Promise<{
    campaignId: string;
    totalJobs: number;
    successful: number;
    failed: number;
    jobIds: string[];
  }> {
    const campaign = this.campaigns.get(request.campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${request.campaignId}`);
    }

    const template = this.templates.get(campaign.templateId);
    if (!template) {
      throw new Error(`Template not found: ${campaign.templateId}`);
    }

    // Update campaign status to sending
    await this.updateCampaignStatus(campaign.id, campaign.tenantId, CampaignStatus.SENDING);

    const emailJobs: EmailJob[] = [];
    const jobIds: string[] = [];

    // Create email jobs for each contact
    for (const contact of request.contacts) {
      const personalizedContent = this.personalizeTemplate(template, contact, request.variables);
      
      const emailJob = this.emailService.createEmailJob({
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        to: contact.email,
        from: process.env.DEFAULT_FROM_EMAIL || 'noreply@example.com',
        subject: personalizedContent.subject,
        htmlContent: personalizedContent.htmlContent,
        textContent: personalizedContent.textContent,
        priority: EmailPriority.NORMAL,
        metadata: {
          contactData: contact,
          campaignName: campaign.name,
          templateName: template.name
        }
      });

      emailJobs.push(emailJob);
      jobIds.push(emailJob.id);
    }

    // Update campaign metrics
    campaign.metrics.totalRecipients = emailJobs.length;
    this.campaigns.set(campaign.id, campaign);

    try {
      // Add batch job to queue for processing
      const batchJob = await this.emailQueue.addBatchJob(emailJobs, campaign.id);
      
      console.log(`✅ Campaign queued: ${campaign.name} - ${emailJobs.length} emails (Job ID: ${batchJob.id})`);

      return {
        campaignId: campaign.id,
        totalJobs: emailJobs.length,
        successful: 0, // Will be updated via callbacks
        failed: 0,     // Will be updated via callbacks
        jobIds: [batchJob.id as string]
      };

    } catch (error) {
      console.error(`Failed to queue campaign ${campaign.id}:`, error);
      await this.updateCampaignStatus(campaign.id, campaign.tenantId, CampaignStatus.FAILED);
      throw error;
    }
  }

  async scheduleCampaign(campaignId: string, tenantId: string, scheduledAt: Date): Promise<Campaign | null> {
    const campaign = this.campaigns.get(campaignId);
    
    if (!campaign || campaign.tenantId !== tenantId) {
      return null;
    }

    if (scheduledAt <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    campaign.scheduledAt = scheduledAt;
    campaign.status = CampaignStatus.SCHEDULED;
    
    this.campaigns.set(campaignId, campaign);
    console.log(`✅ Scheduled campaign: ${campaign.name} for ${scheduledAt.toISOString()}`);
    
    return campaign;
  }

  async updateCampaignMetrics(campaignId: string, metrics: Partial<CampaignMetrics>): Promise<void> {
    const campaign = this.campaigns.get(campaignId);
    
    if (!campaign) {
      console.warn(`Campaign not found for metrics update: ${campaignId}`);
      return;
    }

    campaign.metrics = {
      ...campaign.metrics,
      ...metrics
    };

    this.campaigns.set(campaignId, campaign);
    console.log(`✅ Updated campaign metrics: ${campaignId}`);
  }

  private personalizeTemplate(
    template: EmailTemplate,
    contact: { email: string; firstName?: string; lastName?: string; customFields?: Record<string, any> },
    globalVariables?: Record<string, any>
  ): { subject: string; htmlContent: string; textContent: string } {
    const variables = {
      email: contact.email,
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      ...contact.customFields,
      ...globalVariables
    };

    return {
      subject: this.replaceVariables(template.subject, variables),
      htmlContent: this.replaceVariables(template.htmlContent, variables),
      textContent: this.replaceVariables(template.textContent, variables)
    };
  }

  private replaceVariables(content: string, variables: Record<string, any>): string {
    let result = content;
    
    // Replace {{variable}} patterns
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, String(value || ''));
    }
    
    return result;
  }

  private extractVariables(htmlContent: string, subject: string): TemplateVariable[] {
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    const variables = new Set<string>();
    
    // Extract from HTML content
    let match;
    while ((match = variablePattern.exec(htmlContent)) !== null) {
      variables.add(match[1]);
    }
    
    // Extract from subject
    variablePattern.lastIndex = 0;
    while ((match = variablePattern.exec(subject)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables).map(name => ({
      name,
      type: 'text' as const,
      required: false
    }));
  }

  private extractTextFromHtml(htmlContent: string): string {
    // Simple HTML to text conversion
    return htmlContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\\s+/g, ' ')
      .trim();
  }

  private async handleEmailSent(campaignId: string, emailJob: EmailJob, result: any): Promise<void> {
    // Record delivery event
    await this.deliveryTracker.recordEmailEvent({
      id: this.generateId('event'),
      messageId: result.messageId,
      campaignId,
      tenantId: emailJob.tenantId,
      contactEmail: emailJob.to,
      eventType: 'sent' as any,
      timestamp: new Date(),
      provider: result.provider
    });

    console.log(`📧 Email sent for campaign ${campaignId}: ${emailJob.to}`);
  }

  private async handleEmailFailed(campaignId: string, emailJob: EmailJob, error: Error): Promise<void> {
    console.error(`❌ Email failed for campaign ${campaignId}: ${emailJob.to} - ${error.message}`);
    
    // Update campaign metrics to reflect failure
    const campaign = this.campaigns.get(campaignId);
    if (campaign) {
      // This would typically update database metrics
      console.log(`Updated failure count for campaign ${campaignId}`);
    }
  }

  private async handleBatchCompleted(campaignId: string, results: any[]): Promise<void> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return;

    const successful = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    // Update campaign metrics
    campaign.metrics.delivered = successful;
    
    // Update campaign status based on results
    if (failed === 0) {
      await this.updateCampaignStatus(campaign.id, campaign.tenantId, CampaignStatus.SENT);
    } else if (successful === 0) {
      await this.updateCampaignStatus(campaign.id, campaign.tenantId, CampaignStatus.FAILED);
    }

    this.campaigns.set(campaignId, campaign);
    console.log(`✅ Campaign batch completed: ${campaignId} - ${successful}/${results.length} successful`);
  }

  async getCampaignMetrics(campaignId: string, tenantId: string): Promise<CampaignMetrics | null> {
    const campaign = await this.getCampaign(campaignId, tenantId);
    if (!campaign) return null;

    // Get real-time metrics from delivery tracker
    const deliveryStats = await this.deliveryTracker.getCampaignDeliveryStats(campaignId);
    
    // Merge with campaign metrics
    return {
      ...campaign.metrics,
      ...deliveryStats
    };
  }

  async getQueueStats(): Promise<any> {
    return this.emailQueue.getJobStats();
  }

  async getJobStatus(jobId: string): Promise<any> {
    return this.emailQueue.getJobStatus(jobId);
  }

  async cancelCampaignJob(jobId: string): Promise<boolean> {
    return this.emailQueue.cancelJob(jobId);
  }

  async retryCampaignJob(jobId: string): Promise<any> {
    return this.emailQueue.retryFailedJob(jobId);
  }

  // Method to handle webhook events from email providers
  async handleWebhookEvent(event: EmailEvent): Promise<void> {
    await this.deliveryTracker.recordEmailEvent(event);
    
    // Update campaign metrics if this is a campaign email
    if (event.campaignId) {
      await this.updateCampaignMetrics(event.campaignId, {
        // Update specific metrics based on event type
      });
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}