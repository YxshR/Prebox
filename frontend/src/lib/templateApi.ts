import { 
  EmailTemplate, 
  CreateTemplateRequest, 
  UpdateTemplateRequest,
  TemplateSearchFilters,
  TemplateListResponse,
  ShareTemplateRequest,
  TemplateCollaborator,
  TemplatePreviewRequest,
  TemplatePreviewResponse
} from '../types/template';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

class TemplateAPI {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}/templates${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
  }

  async createTemplate(template: CreateTemplateRequest): Promise<EmailTemplate> {
    return this.request<EmailTemplate>('/', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  async getTemplate(templateId: string): Promise<EmailTemplate> {
    return this.request<EmailTemplate>(`/${templateId}`);
  }

  async updateTemplate(templateId: string, updates: UpdateTemplateRequest): Promise<EmailTemplate> {
    return this.request<EmailTemplate>(`/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.request<void>(`/${templateId}`, {
      method: 'DELETE',
    });
  }

  async listTemplates(
    filters: TemplateSearchFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<TemplateListResponse> {
    const params = new URLSearchParams();
    
    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.tags) params.append('tags', filters.tags.join(','));
    if (filters.isAIGenerated !== undefined) params.append('isAIGenerated', String(filters.isAIGenerated));
    if (filters.isShared !== undefined) params.append('isShared', String(filters.isShared));
    if (filters.createdBy) params.append('createdBy', filters.createdBy);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom.toISOString());
    if (filters.dateTo) params.append('dateTo', filters.dateTo.toISOString());
    
    params.append('page', String(page));
    params.append('limit', String(limit));

    return this.request<TemplateListResponse>(`/?${params.toString()}`);
  }

  async shareTemplate(shareRequest: ShareTemplateRequest): Promise<void> {
    await this.request<void>(`/${shareRequest.templateId}/share`, {
      method: 'POST',
      body: JSON.stringify(shareRequest),
    });
  }

  async getTemplateCollaborators(templateId: string): Promise<TemplateCollaborator[]> {
    return this.request<TemplateCollaborator[]>(`/${templateId}/collaborators`);
  }

  async previewTemplate(previewRequest: TemplatePreviewRequest): Promise<TemplatePreviewResponse> {
    return this.request<TemplatePreviewResponse>(`/${previewRequest.templateId}/preview`, {
      method: 'POST',
      body: JSON.stringify({
        variables: previewRequest.variables,
        previewType: previewRequest.previewType,
      }),
    });
  }

  async duplicateTemplate(templateId: string): Promise<EmailTemplate> {
    return this.request<EmailTemplate>(`/${templateId}/duplicate`, {
      method: 'POST',
    });
  }

  async getTemplateCategories(): Promise<string[]> {
    return this.request<string[]>('/categories');
  }

  async getTemplateTags(): Promise<string[]> {
    return this.request<string[]>('/tags');
  }
}

export const templateAPI = new TemplateAPI();