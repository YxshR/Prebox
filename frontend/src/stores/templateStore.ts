import { create } from 'zustand';
import { 
  EmailTemplate, 
  CreateTemplateRequest, 
  UpdateTemplateRequest,
  TemplateSearchFilters,
  TemplateListResponse,
  ShareTemplateRequest,
  TemplatePreviewRequest,
  TemplatePreviewResponse
} from '../types/template';
import { templateAPI } from '../lib/templateApi';

interface TemplateState {
  // State
  templates: EmailTemplate[];
  currentTemplate: EmailTemplate | null;
  previewData: TemplatePreviewResponse | null;
  categories: string[];
  tags: string[];
  loading: boolean;
  error: string | null;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  totalTemplates: number;
  
  // Filters
  filters: TemplateSearchFilters;
  
  // Actions
  loadTemplates: (page?: number, limit?: number) => Promise<void>;
  createTemplate: (template: CreateTemplateRequest) => Promise<EmailTemplate>;
  updateTemplate: (templateId: string, updates: UpdateTemplateRequest) => Promise<EmailTemplate>;
  deleteTemplate: (templateId: string) => Promise<void>;
  duplicateTemplate: (templateId: string) => Promise<EmailTemplate>;
  
  // Template management
  setCurrentTemplate: (template: EmailTemplate | null) => void;
  getTemplate: (templateId: string) => Promise<EmailTemplate>;
  
  // Preview
  previewTemplate: (request: TemplatePreviewRequest) => Promise<TemplatePreviewResponse>;
  clearPreview: () => void;
  
  // Sharing
  shareTemplate: (shareRequest: ShareTemplateRequest) => Promise<void>;
  
  // Filters and search
  setFilters: (filters: Partial<TemplateSearchFilters>) => void;
  clearFilters: () => void;
  
  // Categories and tags
  loadCategories: () => Promise<void>;
  loadTags: () => Promise<void>;
  
  // Utility
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  // Initial state
  templates: [],
  currentTemplate: null,
  previewData: null,
  categories: [],
  tags: [],
  loading: false,
  error: null,
  currentPage: 1,
  totalPages: 1,
  totalTemplates: 0,
  filters: {},

  // Actions
  loadTemplates: async (page = 1, limit = 20) => {
    set({ loading: true, error: null });
    
    try {
      const { filters } = get();
      const response = await templateAPI.listTemplates(filters, page, limit);
      
      set({
        templates: response.templates,
        currentPage: response.page,
        totalPages: response.totalPages,
        totalTemplates: response.total,
        loading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load templates',
        loading: false,
      });
    }
  },

  createTemplate: async (template: CreateTemplateRequest) => {
    set({ loading: true, error: null });
    
    try {
      const newTemplate = await templateAPI.createTemplate(template);
      
      // Add to the beginning of the templates list
      set(state => ({
        templates: [newTemplate, ...state.templates],
        totalTemplates: state.totalTemplates + 1,
        loading: false,
      }));
      
      return newTemplate;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create template';
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  updateTemplate: async (templateId: string, updates: UpdateTemplateRequest) => {
    set({ loading: true, error: null });
    
    try {
      const updatedTemplate = await templateAPI.updateTemplate(templateId, updates);
      
      set(state => ({
        templates: state.templates.map(t => 
          t.id === templateId ? updatedTemplate : t
        ),
        currentTemplate: state.currentTemplate?.id === templateId ? updatedTemplate : state.currentTemplate,
        loading: false,
      }));
      
      return updatedTemplate;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update template';
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  deleteTemplate: async (templateId: string) => {
    set({ loading: true, error: null });
    
    try {
      await templateAPI.deleteTemplate(templateId);
      
      set(state => ({
        templates: state.templates.filter(t => t.id !== templateId),
        currentTemplate: state.currentTemplate?.id === templateId ? null : state.currentTemplate,
        totalTemplates: state.totalTemplates - 1,
        loading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete template';
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  duplicateTemplate: async (templateId: string) => {
    set({ loading: true, error: null });
    
    try {
      const duplicatedTemplate = await templateAPI.duplicateTemplate(templateId);
      
      set(state => ({
        templates: [duplicatedTemplate, ...state.templates],
        totalTemplates: state.totalTemplates + 1,
        loading: false,
      }));
      
      return duplicatedTemplate;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate template';
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  setCurrentTemplate: (template: EmailTemplate | null) => {
    set({ currentTemplate: template });
  },

  getTemplate: async (templateId: string) => {
    set({ loading: true, error: null });
    
    try {
      const template = await templateAPI.getTemplate(templateId);
      set({ currentTemplate: template, loading: false });
      return template;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load template';
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  previewTemplate: async (request: TemplatePreviewRequest) => {
    set({ loading: true, error: null });
    
    try {
      const previewData = await templateAPI.previewTemplate(request);
      set({ previewData, loading: false });
      return previewData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to preview template';
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  clearPreview: () => {
    set({ previewData: null });
  },

  shareTemplate: async (shareRequest: ShareTemplateRequest) => {
    set({ loading: true, error: null });
    
    try {
      await templateAPI.shareTemplate(shareRequest);
      
      // Update the template in the list to reflect sharing status
      set(state => ({
        templates: state.templates.map(t => 
          t.id === shareRequest.templateId 
            ? { ...t, isShared: true, sharedWith: [...t.sharedWith, ...shareRequest.shareWith] }
            : t
        ),
        loading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to share template';
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  setFilters: (newFilters: Partial<TemplateSearchFilters>) => {
    set(state => ({
      filters: { ...state.filters, ...newFilters },
      currentPage: 1, // Reset to first page when filters change
    }));
    
    // Automatically reload templates with new filters
    get().loadTemplates();
  },

  clearFilters: () => {
    set({ filters: {}, currentPage: 1 });
    get().loadTemplates();
  },

  loadCategories: async () => {
    try {
      const categories = await templateAPI.getTemplateCategories();
      set({ categories });
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  },

  loadTags: async () => {
    try {
      const tags = await templateAPI.getTemplateTags();
      set({ tags });
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  },

  setLoading: (loading: boolean) => {
    set({ loading });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },
}));