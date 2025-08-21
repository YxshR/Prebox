import { 
  EmailTemplate, 
  CreateTemplateRequest, 
  UpdateTemplateRequest,
  TemplateSearchFilters,
  TemplateListResponse,
  ShareTemplateRequest,
  TemplateCollaborator,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
  TemplateVariable
} from './template.types';

export class TemplateService {
  private templates: Map<string, EmailTemplate> = new Map();
  private collaborators: Map<string, TemplateCollaborator[]> = new Map();

  constructor(initializeSamples: boolean = true) {
    // Initialize with some sample templates for development
    if (initializeSamples) {
      this.initializeSampleTemplates();
    }
  }

  private initializeSampleTemplates(): void {
    const sampleTemplates: EmailTemplate[] = [
      {
        id: 'template_1',
        tenantId: 'tenant_1',
        name: 'Welcome Email',
        subject: 'Welcome to {{company_name}}!',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Welcome {{first_name}}!</h1>
            <p>Thank you for joining {{company_name}}. We're excited to have you on board.</p>
            <div style="background: #f5f5f5; padding: 20px; margin: 20px 0;">
              <h2>Getting Started</h2>
              <ul>
                <li>Complete your profile</li>
                <li>Explore our features</li>
                <li>Contact support if needed</li>
              </ul>
            </div>
            <p>Best regards,<br>The {{company_name}} Team</p>
          </div>
        `,
        textContent: 'Welcome {{first_name}}! Thank you for joining {{company_name}}.',
        variables: [
          { id: 'var_1', name: 'first_name', type: 'text', required: true, description: 'User first name' },
          { id: 'var_2', name: 'company_name', type: 'text', required: true, description: 'Company name' }
        ],
        isAIGenerated: false,
        isShared: false,
        sharedWith: [],
        tags: ['welcome', 'onboarding'],
        category: 'transactional',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        createdBy: 'user_1',
        lastModifiedBy: 'user_1'
      },
      {
        id: 'template_2',
        tenantId: 'tenant_1',
        name: 'Newsletter Template',
        subject: '{{newsletter_title}} - {{month}} Edition',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <header style="background: #2563eb; color: white; padding: 20px; text-align: center;">
              <h1>{{newsletter_title}}</h1>
              <p>{{month}} Edition</p>
            </header>
            <main style="padding: 20px;">
              <h2>{{main_headline}}</h2>
              <p>{{main_content}}</p>
              <div style="border-left: 4px solid #2563eb; padding-left: 20px; margin: 20px 0;">
                <h3>Featured Article</h3>
                <p>{{featured_article}}</p>
              </div>
            </main>
            <footer style="background: #f3f4f6; padding: 20px; text-align: center;">
              <p>© {{year}} {{company_name}}. All rights reserved.</p>
            </footer>
          </div>
        `,
        textContent: '{{newsletter_title}} - {{month}} Edition\n\n{{main_headline}}\n{{main_content}}',
        variables: [
          { id: 'var_3', name: 'newsletter_title', type: 'text', required: true, description: 'Newsletter title' },
          { id: 'var_4', name: 'month', type: 'text', required: true, description: 'Current month' },
          { id: 'var_5', name: 'main_headline', type: 'text', required: true, description: 'Main article headline' },
          { id: 'var_6', name: 'main_content', type: 'text', required: true, description: 'Main article content' },
          { id: 'var_7', name: 'featured_article', type: 'text', required: false, description: 'Featured article content' },
          { id: 'var_8', name: 'year', type: 'number', required: true, description: 'Current year' },
          { id: 'var_9', name: 'company_name', type: 'text', required: true, description: 'Company name' }
        ],
        isAIGenerated: true,
        isShared: true,
        sharedWith: ['user_2', 'user_3'],
        tags: ['newsletter', 'marketing', 'monthly'],
        category: 'marketing',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-02-01'),
        createdBy: 'user_1',
        lastModifiedBy: 'user_2'
      }
    ];

    sampleTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  async createTemplate(request: CreateTemplateRequest, userId: string): Promise<EmailTemplate> {
    const template: EmailTemplate = {
      id: this.generateId('template'),
      tenantId: request.tenantId,
      name: request.name,
      subject: request.subject,
      htmlContent: request.htmlContent,
      textContent: request.textContent || this.generateTextFromHtml(request.htmlContent),
      variables: request.variables || [],
      isAIGenerated: request.isAIGenerated || false,
      isShared: false,
      sharedWith: [],
      tags: request.tags || [],
      category: request.category || 'general',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      lastModifiedBy: userId
    };

    this.templates.set(template.id, template);
    console.log(`✅ Created template: ${template.name} (${template.id})`);
    return template;
  }

  async getTemplate(templateId: string, tenantId: string): Promise<EmailTemplate | null> {
    const template = this.templates.get(templateId);
    
    if (!template || template.tenantId !== tenantId) {
      return null;
    }
    
    return template;
  }

  async updateTemplate(
    templateId: string, 
    tenantId: string, 
    updates: UpdateTemplateRequest,
    userId: string
  ): Promise<EmailTemplate | null> {
    const template = this.templates.get(templateId);
    
    if (!template || template.tenantId !== tenantId) {
      return null;
    }

    const updatedTemplate: EmailTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date(),
      lastModifiedBy: userId
    };

    this.templates.set(templateId, updatedTemplate);
    console.log(`✅ Updated template: ${updatedTemplate.name} (${templateId})`);
    return updatedTemplate;
  }

  async deleteTemplate(templateId: string, tenantId: string): Promise<boolean> {
    const template = this.templates.get(templateId);
    
    if (!template || template.tenantId !== tenantId) {
      return false;
    }

    this.templates.delete(templateId);
    this.collaborators.delete(templateId);
    console.log(`✅ Deleted template: ${templateId}`);
    return true;
  }

  async listTemplates(
    tenantId: string, 
    filters: TemplateSearchFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<TemplateListResponse> {
    let templates = Array.from(this.templates.values())
      .filter(template => template.tenantId === tenantId);

    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      templates = templates.filter(template => 
        template.name.toLowerCase().includes(searchLower) ||
        template.subject.toLowerCase().includes(searchLower) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    if (filters.category) {
      templates = templates.filter(template => template.category === filters.category);
    }

    if (filters.tags && filters.tags.length > 0) {
      templates = templates.filter(template => 
        filters.tags!.some(tag => template.tags.includes(tag))
      );
    }

    if (filters.isAIGenerated !== undefined) {
      templates = templates.filter(template => template.isAIGenerated === filters.isAIGenerated);
    }

    if (filters.isShared !== undefined) {
      templates = templates.filter(template => template.isShared === filters.isShared);
    }

    if (filters.createdBy) {
      templates = templates.filter(template => template.createdBy === filters.createdBy);
    }

    if (filters.dateFrom) {
      templates = templates.filter(template => template.createdAt >= filters.dateFrom!);
    }

    if (filters.dateTo) {
      templates = templates.filter(template => template.createdAt <= filters.dateTo!);
    }

    // Sort by updated date (newest first)
    templates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Pagination
    const total = templates.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedTemplates = templates.slice(startIndex, startIndex + limit);

    return {
      templates: paginatedTemplates,
      total,
      page,
      limit,
      totalPages
    };
  }

  async shareTemplate(request: ShareTemplateRequest, userId: string): Promise<boolean> {
    const template = this.templates.get(request.templateId);
    
    if (!template) {
      return false;
    }

    // Update template sharing settings
    const updatedTemplate: EmailTemplate = {
      ...template,
      isShared: true,
      sharedWith: [...new Set([...template.sharedWith, ...request.shareWith])],
      updatedAt: new Date(),
      lastModifiedBy: userId
    };

    this.templates.set(request.templateId, updatedTemplate);

    // Add collaborators
    const existingCollaborators = this.collaborators.get(request.templateId) || [];
    const newCollaborators: TemplateCollaborator[] = request.shareWith.map(userEmail => ({
      userId: this.generateId('user'),
      email: userEmail,
      permissions: request.permissions,
      addedAt: new Date()
    }));

    this.collaborators.set(request.templateId, [...existingCollaborators, ...newCollaborators]);
    
    console.log(`✅ Shared template ${request.templateId} with ${request.shareWith.length} users`);
    return true;
  }

  async getTemplateCollaborators(templateId: string): Promise<TemplateCollaborator[]> {
    return this.collaborators.get(templateId) || [];
  }

  async previewTemplate(request: TemplatePreviewRequest): Promise<TemplatePreviewResponse> {
    const template = this.templates.get(request.templateId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    // Replace variables with provided values or defaults
    let html = template.htmlContent;
    let text = template.textContent;
    let subject = template.subject;

    if (request.variables) {
      template.variables.forEach(variable => {
        const value = request.variables![variable.name] || variable.defaultValue || `{{${variable.name}}}`;
        const regex = new RegExp(`{{${variable.name}}}`, 'g');
        
        html = html.replace(regex, String(value));
        text = text.replace(regex, String(value));
        subject = subject.replace(regex, String(value));
      });
    }

    // Apply responsive styles for mobile preview
    if (request.previewType === 'mobile') {
      html = this.applyMobileStyles(html);
    }

    return {
      html,
      text,
      subject,
      previewUrl: `${process.env.API_BASE_URL}/api/templates/${request.templateId}/preview`
    };
  }

  async duplicateTemplate(templateId: string, tenantId: string, userId: string): Promise<EmailTemplate | null> {
    const originalTemplate = await this.getTemplate(templateId, tenantId);
    
    if (!originalTemplate) {
      return null;
    }

    const duplicatedTemplate: EmailTemplate = {
      ...originalTemplate,
      id: this.generateId('template'),
      name: `${originalTemplate.name} (Copy)`,
      isShared: false,
      sharedWith: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      lastModifiedBy: userId
    };

    this.templates.set(duplicatedTemplate.id, duplicatedTemplate);
    console.log(`✅ Duplicated template: ${duplicatedTemplate.name} (${duplicatedTemplate.id})`);
    return duplicatedTemplate;
  }

  async getTemplateCategories(tenantId: string): Promise<string[]> {
    const templates = Array.from(this.templates.values())
      .filter(template => template.tenantId === tenantId);
    
    const categories = new Set(templates.map(template => template.category));
    return Array.from(categories).sort();
  }

  async getTemplateTags(tenantId: string): Promise<string[]> {
    const templates = Array.from(this.templates.values())
      .filter(template => template.tenantId === tenantId);
    
    const tags = new Set<string>();
    templates.forEach(template => {
      template.tags.forEach(tag => tags.add(tag));
    });
    
    return Array.from(tags).sort();
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTextFromHtml(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private applyMobileStyles(html: string): string {
    // Add mobile-responsive styles
    const mobileStyles = `
      <style>
        @media only screen and (max-width: 600px) {
          .container { width: 100% !important; }
          .content { padding: 10px !important; }
          h1 { font-size: 24px !important; }
          h2 { font-size: 20px !important; }
          p { font-size: 16px !important; }
        }
      </style>
    `;
    
    return html.replace('</head>', `${mobileStyles}</head>`);
  }
}