import { TemplateService } from './template.service';
import { CreateTemplateRequest, TemplateSearchFilters } from './template.types';

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeEach(() => {
    templateService = new TemplateService(false); // Don't initialize sample templates for tests
  });

  describe('createTemplate', () => {
    it('should create a new template successfully', async () => {
      const request: CreateTemplateRequest = {
        tenantId: 'test-tenant',
        name: 'Test Template',
        subject: 'Test Subject',
        htmlContent: '<h1>Hello {{name}}</h1>',
        textContent: 'Hello {{name}}',
        variables: [{
          id: 'var1',
          name: 'name',
          type: 'text',
          required: true,
          description: 'User name'
        }],
        tags: ['test', 'email'],
        category: 'marketing'
      };

      const template = await templateService.createTemplate(request, 'user1');

      expect(template).toBeDefined();
      expect(template.name).toBe(request.name);
      expect(template.subject).toBe(request.subject);
      expect(template.htmlContent).toBe(request.htmlContent);
      expect(template.tenantId).toBe(request.tenantId);
      expect(template.createdBy).toBe('user1');
      expect(template.variables).toHaveLength(1);
      expect(template.tags).toEqual(['test', 'email']);
      expect(template.category).toBe('marketing');
    });

    it('should generate text content from HTML if not provided', async () => {
      const request: CreateTemplateRequest = {
        tenantId: 'test-tenant',
        name: 'Test Template',
        subject: 'Test Subject',
        htmlContent: '<h1>Hello World</h1><p>This is a test.</p>'
      };

      const template = await templateService.createTemplate(request, 'user1');

      expect(template.textContent).toBe('Hello WorldThis is a test.');
    });
  });

  describe('getTemplate', () => {
    it('should retrieve a template by ID', async () => {
      const request: CreateTemplateRequest = {
        tenantId: 'test-tenant',
        name: 'Test Template',
        subject: 'Test Subject',
        htmlContent: '<h1>Hello</h1>'
      };

      const created = await templateService.createTemplate(request, 'user1');
      const retrieved = await templateService.getTemplate(created.id, 'test-tenant');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(created.name);
    });

    it('should return null for non-existent template', async () => {
      const result = await templateService.getTemplate('non-existent', 'test-tenant');
      expect(result).toBeNull();
    });

    it('should return null for template from different tenant', async () => {
      const request: CreateTemplateRequest = {
        tenantId: 'tenant1',
        name: 'Test Template',
        subject: 'Test Subject',
        htmlContent: '<h1>Hello</h1>'
      };

      const created = await templateService.createTemplate(request, 'user1');
      const result = await templateService.getTemplate(created.id, 'tenant2');

      expect(result).toBeNull();
    });
  });

  describe('listTemplates', () => {
    beforeEach(async () => {
      // Create test templates
      await templateService.createTemplate({
        tenantId: 'test-tenant',
        name: 'Marketing Template',
        subject: 'Marketing Subject',
        htmlContent: '<h1>Marketing</h1>',
        category: 'marketing',
        tags: ['marketing', 'promo'],
        isAIGenerated: true
      }, 'user1');

      await templateService.createTemplate({
        tenantId: 'test-tenant',
        name: 'Newsletter Template',
        subject: 'Newsletter Subject',
        htmlContent: '<h1>Newsletter</h1>',
        category: 'newsletter',
        tags: ['newsletter'],
        isAIGenerated: false
      }, 'user2');
    });

    it('should list all templates for a tenant', async () => {
      const result = await templateService.listTemplates('test-tenant');

      expect(result.templates).toHaveLength(2); // 2 created templates
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter templates by search query', async () => {
      const filters: TemplateSearchFilters = {
        search: 'marketing'
      };

      const result = await templateService.listTemplates('test-tenant', filters);

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].name).toBe('Marketing Template');
    });

    it('should filter templates by category', async () => {
      const filters: TemplateSearchFilters = {
        category: 'newsletter'
      };

      const result = await templateService.listTemplates('test-tenant', filters);

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].category).toBe('newsletter');
    });

    it('should filter templates by AI generated status', async () => {
      const filters: TemplateSearchFilters = {
        isAIGenerated: true
      };

      const result = await templateService.listTemplates('test-tenant', filters);

      expect(result.templates.length).toBeGreaterThan(0);
      result.templates.forEach(template => {
        expect(template.isAIGenerated).toBe(true);
      });
    });

    it('should filter templates by tags', async () => {
      const filters: TemplateSearchFilters = {
        tags: ['marketing']
      };

      const result = await templateService.listTemplates('test-tenant', filters);

      expect(result.templates.length).toBeGreaterThan(0);
      result.templates.forEach(template => {
        expect(template.tags).toContain('marketing');
      });
    });

    it('should handle pagination', async () => {
      const result = await templateService.listTemplates('test-tenant', {}, 1, 2);

      expect(result.templates).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('updateTemplate', () => {
    it('should update template successfully', async () => {
      const request: CreateTemplateRequest = {
        tenantId: 'test-tenant',
        name: 'Original Template',
        subject: 'Original Subject',
        htmlContent: '<h1>Original</h1>'
      };

      const created = await templateService.createTemplate(request, 'user1');
      
      const updated = await templateService.updateTemplate(created.id, 'test-tenant', {
        name: 'Updated Template',
        subject: 'Updated Subject'
      }, 'user2');

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Template');
      expect(updated?.subject).toBe('Updated Subject');
      expect(updated?.htmlContent).toBe('<h1>Original</h1>'); // Unchanged
      expect(updated?.lastModifiedBy).toBe('user2');
    });

    it('should return null for non-existent template', async () => {
      const result = await templateService.updateTemplate('non-existent', 'test-tenant', {
        name: 'Updated'
      }, 'user1');

      expect(result).toBeNull();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template successfully', async () => {
      const request: CreateTemplateRequest = {
        tenantId: 'test-tenant',
        name: 'Template to Delete',
        subject: 'Delete Subject',
        htmlContent: '<h1>Delete</h1>'
      };

      const created = await templateService.createTemplate(request, 'user1');
      const deleted = await templateService.deleteTemplate(created.id, 'test-tenant');

      expect(deleted).toBe(true);

      const retrieved = await templateService.getTemplate(created.id, 'test-tenant');
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent template', async () => {
      const result = await templateService.deleteTemplate('non-existent', 'test-tenant');
      expect(result).toBe(false);
    });
  });

  describe('duplicateTemplate', () => {
    it('should duplicate template successfully', async () => {
      const request: CreateTemplateRequest = {
        tenantId: 'test-tenant',
        name: 'Original Template',
        subject: 'Original Subject',
        htmlContent: '<h1>Original</h1>',
        tags: ['original'],
        category: 'marketing'
      };

      const original = await templateService.createTemplate(request, 'user1');
      const duplicated = await templateService.duplicateTemplate(original.id, 'test-tenant', 'user2');

      expect(duplicated).toBeDefined();
      expect(duplicated?.name).toBe('Original Template (Copy)');
      expect(duplicated?.subject).toBe(original.subject);
      expect(duplicated?.htmlContent).toBe(original.htmlContent);
      expect(duplicated?.tags).toEqual(original.tags);
      expect(duplicated?.category).toBe(original.category);
      expect(duplicated?.createdBy).toBe('user2');
      expect(duplicated?.isShared).toBe(false);
      expect(duplicated?.sharedWith).toEqual([]);
    });
  });

  describe('shareTemplate', () => {
    it('should share template successfully', async () => {
      const request: CreateTemplateRequest = {
        tenantId: 'test-tenant',
        name: 'Template to Share',
        subject: 'Share Subject',
        htmlContent: '<h1>Share</h1>'
      };

      const template = await templateService.createTemplate(request, 'user1');
      
      const shared = await templateService.shareTemplate({
        templateId: template.id,
        shareWith: ['user2@example.com', 'user3@example.com'],
        permissions: 'view'
      }, 'user1');

      expect(shared).toBe(true);

      const updated = await templateService.getTemplate(template.id, 'test-tenant');
      expect(updated?.isShared).toBe(true);
      expect(updated?.sharedWith).toContain('user2@example.com');
      expect(updated?.sharedWith).toContain('user3@example.com');
    });
  });

  describe('previewTemplate', () => {
    it('should generate template preview with variables', async () => {
      const request: CreateTemplateRequest = {
        tenantId: 'test-tenant',
        name: 'Preview Template',
        subject: 'Hello {{name}}!',
        htmlContent: '<h1>Welcome {{name}}</h1><p>Your email is {{email}}</p>',
        variables: [
          { id: 'var1', name: 'name', type: 'text', required: true, description: 'User name' },
          { id: 'var2', name: 'email', type: 'text', required: true, description: 'User email' }
        ]
      };

      const template = await templateService.createTemplate(request, 'user1');
      
      const preview = await templateService.previewTemplate({
        templateId: template.id,
        variables: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        previewType: 'desktop'
      });

      expect(preview.subject).toBe('Hello John Doe!');
      expect(preview.html).toContain('Welcome John Doe');
      expect(preview.html).toContain('john@example.com');
      expect(preview.text).toContain('John Doe');
    });

    it('should handle missing variables with defaults', async () => {
      const request: CreateTemplateRequest = {
        tenantId: 'test-tenant',
        name: 'Preview Template',
        subject: 'Hello {{name}}!',
        htmlContent: '<h1>Welcome {{name}}</h1>',
        variables: [
          { id: 'var1', name: 'name', type: 'text', required: true, defaultValue: 'Guest', description: 'User name' }
        ]
      };

      const template = await templateService.createTemplate(request, 'user1');
      
      const preview = await templateService.previewTemplate({
        templateId: template.id,
        variables: {},
        previewType: 'desktop'
      });

      expect(preview.subject).toBe('Hello Guest!');
      expect(preview.html).toContain('Welcome Guest');
    });
  });
});