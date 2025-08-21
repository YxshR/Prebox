export interface EmailTemplate {
  id: string;
  tenantId: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: TemplateVariable[];
  isAIGenerated: boolean;
  isShared: boolean;
  sharedWith: string[];
  tags: string[];
  category: string;
  previewImage?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
}

export interface TemplateVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'image' | 'url';
  defaultValue?: string;
  required: boolean;
  description?: string;
}

export interface CreateTemplateRequest {
  tenantId: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables?: TemplateVariable[];
  isAIGenerated?: boolean;
  tags?: string[];
  category?: string;
}

export interface UpdateTemplateRequest {
  name?: string;
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  variables?: TemplateVariable[];
  tags?: string[];
  category?: string;
}

export interface TemplateSearchFilters {
  search?: string;
  category?: string;
  tags?: string[];
  isAIGenerated?: boolean;
  isShared?: boolean;
  createdBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface TemplateListResponse {
  templates: EmailTemplate[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ShareTemplateRequest {
  templateId: string;
  shareWith: string[];
  permissions: 'view' | 'edit';
}

export interface TemplateCollaborator {
  userId: string;
  email: string;
  permissions: 'view' | 'edit';
  addedAt: string;
}

export interface TemplatePreviewRequest {
  templateId: string;
  variables?: Record<string, any>;
  previewType: 'desktop' | 'mobile' | 'text';
}

export interface TemplatePreviewResponse {
  html: string;
  text: string;
  subject: string;
  previewUrl?: string;
}