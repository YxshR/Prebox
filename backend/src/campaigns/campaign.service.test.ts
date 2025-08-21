import { CampaignService, CreateTemplateRequest, CreateCampaignRequest } from './campaign.service';
import { EmailService } from '../emails/email.service';
import { CampaignStatus, SubscriptionTier } from '../shared/types';

// Mock EmailService and its dependencies
jest.mock('../emails/email.service');
jest.mock('../emails/queue/email.queue');
jest.mock('../emails/delivery-tracking.service');

describe('CampaignService', () => {
  let campaignService: CampaignService;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    // Create a mock EmailService
    mockEmailService = {
      sendSingleEmail: jest.fn(),
      sendBatchEmails: jest.fn(),
      createEmailJob: jest.fn(),
      getAvailableProviders: jest.fn(),
      getProviderStatus: jest.fn(),
      switchPrimaryProvider: jest.fn()
    } as any;
    
    campaignService = new CampaignService(mockEmailService);
  });

  describe('Template Management', () => {
    it('should create a template successfully', async () => {
      const templateRequest: CreateTemplateRequest = {
        tenantId: 'tenant-123',
        name: 'Welcome Email',
        subject: 'Welcome {{firstName}}!',
        htmlContent: '<h1>Welcome {{firstName}} {{lastName}}!</h1>',
        textContent: 'Welcome {{firstName}} {{lastName}}!',
        isAIGenerated: false
      };

      const template = await campaignService.createTemplate(templateRequest);

      expect(template).toBeDefined();
      expect(template.name).toBe('Welcome Email');
      expect(template.tenantId).toBe('tenant-123');
      expect(template.variables).toHaveLength(2);
      expect(template.variables[0].name).toBe('firstName');
      expect(template.variables[1].name).toBe('lastName');
    });

    it('should extract variables from template content', async () => {
      const templateRequest: CreateTemplateRequest = {
        tenantId: 'tenant-123',
        name: 'Product Email',
        subject: 'New {{productName}} for {{firstName}}!',
        htmlContent: '<p>Hi {{firstName}}, check out {{productName}} at {{price}}!</p>'
      };

      const template = await campaignService.createTemplate(templateRequest);

      expect(template.variables).toHaveLength(3);
      const variableNames = template.variables.map(v => v.name);
      expect(variableNames).toContain('firstName');
      expect(variableNames).toContain('productName');
      expect(variableNames).toContain('price');
    });

    it('should get template by id', async () => {
      const templateRequest: CreateTemplateRequest = {
        tenantId: 'tenant-123',
        name: 'Test Template',
        subject: 'Test Subject',
        htmlContent: '<p>Test Content</p>'
      };

      const createdTemplate = await campaignService.createTemplate(templateRequest);
      const retrievedTemplate = await campaignService.getTemplate(createdTemplate.id, 'tenant-123');

      expect(retrievedTemplate).toBeDefined();
      expect(retrievedTemplate?.id).toBe(createdTemplate.id);
      expect(retrievedTemplate?.name).toBe('Test Template');
    });

    it('should return null for non-existent template', async () => {
      const template = await campaignService.getTemplate('non-existent', 'tenant-123');
      expect(template).toBeNull();
    });

    it('should list templates for tenant', async () => {
      await campaignService.createTemplate({
        tenantId: 'tenant-123',
        name: 'Template 1',
        subject: 'Subject 1',
        htmlContent: '<p>Content 1</p>'
      });

      await campaignService.createTemplate({
        tenantId: 'tenant-123',
        name: 'Template 2',
        subject: 'Subject 2',
        htmlContent: '<p>Content 2</p>'
      });

      await campaignService.createTemplate({
        tenantId: 'tenant-456',
        name: 'Template 3',
        subject: 'Subject 3',
        htmlContent: '<p>Content 3</p>'
      });

      const templates = await campaignService.listTemplates('tenant-123');
      expect(templates).toHaveLength(2);
      // Templates should be sorted by creation time (newest first)
      // Since we can't guarantee exact timing, just check that we have the right templates
      const templateNames = templates.map(t => t.name);
      expect(templateNames).toContain('Template 1');
      expect(templateNames).toContain('Template 2');
    });
  });

  describe('Campaign Management', () => {
    let template: any;

    beforeEach(async () => {
      template = await campaignService.createTemplate({
        tenantId: 'tenant-123',
        name: 'Test Template',
        subject: 'Test {{firstName}}',
        htmlContent: '<p>Hello {{firstName}}!</p>'
      });
    });

    it('should create a campaign successfully', async () => {
      const campaignRequest: CreateCampaignRequest = {
        tenantId: 'tenant-123',
        name: 'Test Campaign',
        templateId: template.id,
        listIds: ['list-1', 'list-2']
      };

      const campaign = await campaignService.createCampaign(campaignRequest);

      expect(campaign).toBeDefined();
      expect(campaign.name).toBe('Test Campaign');
      expect(campaign.templateId).toBe(template.id);
      expect(campaign.status).toBe(CampaignStatus.DRAFT);
      expect(campaign.listIds).toEqual(['list-1', 'list-2']);
    });

    it('should create scheduled campaign', async () => {
      const scheduledAt = new Date(Date.now() + 3600000); // 1 hour from now
      const campaignRequest: CreateCampaignRequest = {
        tenantId: 'tenant-123',
        name: 'Scheduled Campaign',
        templateId: template.id,
        listIds: ['list-1'],
        scheduledAt
      };

      const campaign = await campaignService.createCampaign(campaignRequest);

      expect(campaign.status).toBe(CampaignStatus.SCHEDULED);
      expect(campaign.scheduledAt).toEqual(scheduledAt);
    });

    it('should fail to create campaign with non-existent template', async () => {
      const campaignRequest: CreateCampaignRequest = {
        tenantId: 'tenant-123',
        name: 'Invalid Campaign',
        templateId: 'non-existent-template',
        listIds: ['list-1']
      };

      await expect(campaignService.createCampaign(campaignRequest))
        .rejects.toThrow('Template not found: non-existent-template');
    });

    it('should schedule campaign', async () => {
      const campaign = await campaignService.createCampaign({
        tenantId: 'tenant-123',
        name: 'Test Campaign',
        templateId: template.id,
        listIds: ['list-1']
      });

      const scheduledAt = new Date(Date.now() + 3600000);
      const scheduledCampaign = await campaignService.scheduleCampaign(
        campaign.id,
        'tenant-123',
        scheduledAt
      );

      expect(scheduledCampaign?.status).toBe(CampaignStatus.SCHEDULED);
      expect(scheduledCampaign?.scheduledAt).toEqual(scheduledAt);
    });

    it('should fail to schedule campaign in the past', async () => {
      const campaign = await campaignService.createCampaign({
        tenantId: 'tenant-123',
        name: 'Test Campaign',
        templateId: template.id,
        listIds: ['list-1']
      });

      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago

      await expect(campaignService.scheduleCampaign(campaign.id, 'tenant-123', pastDate))
        .rejects.toThrow('Scheduled time must be in the future');
    });
  });

  describe('Variable Replacement', () => {
    it('should replace variables in template content', async () => {
      const template = await campaignService.createTemplate({
        tenantId: 'tenant-123',
        name: 'Variable Template',
        subject: 'Hello {{firstName}} {{lastName}}',
        htmlContent: '<p>Welcome {{firstName}}! Your email is {{email}}.</p>'
      });

      // Access private method for testing
      const personalizeTemplate = (campaignService as any).personalizeTemplate.bind(campaignService);
      const result = personalizeTemplate(
        template,
        {
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe'
        },
        { companyName: 'Acme Corp' }
      );

      expect(result.subject).toBe('Hello John Doe');
      expect(result.htmlContent).toBe('<p>Welcome John! Your email is john@example.com.</p>');
    });

    it('should handle missing variables gracefully', async () => {
      const template = await campaignService.createTemplate({
        tenantId: 'tenant-123',
        name: 'Variable Template',
        subject: 'Hello {{firstName}} {{lastName}}',
        htmlContent: '<p>Welcome {{firstName}}!</p>'
      });

      const personalizeTemplate = (campaignService as any).personalizeTemplate.bind(campaignService);
      const result = personalizeTemplate(
        template,
        { email: 'john@example.com', firstName: 'John' }, // lastName missing
        {}
      );

      expect(result.subject).toBe('Hello John '); // lastName replaced with empty string
      expect(result.htmlContent).toBe('<p>Welcome John!</p>');
    });
  });

  describe('Campaign Metrics', () => {
    it('should initialize campaign with zero metrics', async () => {
      const template = await campaignService.createTemplate({
        tenantId: 'tenant-123',
        name: 'Test Template',
        subject: 'Test',
        htmlContent: '<p>Test</p>'
      });

      const campaign = await campaignService.createCampaign({
        tenantId: 'tenant-123',
        name: 'Test Campaign',
        templateId: template.id,
        listIds: ['list-1']
      });

      expect(campaign.metrics).toEqual({
        totalRecipients: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0,
        unsubscribed: 0,
        complained: 0
      });
    });

    it('should update campaign metrics', async () => {
      const template = await campaignService.createTemplate({
        tenantId: 'tenant-123',
        name: 'Test Template',
        subject: 'Test',
        htmlContent: '<p>Test</p>'
      });

      const campaign = await campaignService.createCampaign({
        tenantId: 'tenant-123',
        name: 'Test Campaign',
        templateId: template.id,
        listIds: ['list-1']
      });

      await campaignService.updateCampaignMetrics(campaign.id, {
        delivered: 100,
        opened: 25,
        clicked: 5
      });

      const updatedCampaign = await campaignService.getCampaign(campaign.id, 'tenant-123');
      expect(updatedCampaign?.metrics.delivered).toBe(100);
      expect(updatedCampaign?.metrics.opened).toBe(25);
      expect(updatedCampaign?.metrics.clicked).toBe(5);
    });
  });
});