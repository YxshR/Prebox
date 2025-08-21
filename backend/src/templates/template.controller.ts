import { Request, Response } from 'express';
import { TemplateService } from './template.service';
import { 
  CreateTemplateRequest, 
  UpdateTemplateRequest,
  TemplateSearchFilters,
  ShareTemplateRequest,
  TemplatePreviewRequest
} from './template.types';

export class TemplateController {
  private templateService: TemplateService;

  constructor() {
    this.templateService = new TemplateService();
  }

  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateData: CreateTemplateRequest = req.body;
      const userId = req.user?.id || 'anonymous';
      
      // Validate required fields
      if (!templateData.name || !templateData.subject || !templateData.htmlContent) {
        res.status(400).json({
          error: 'Missing required fields: name, subject, and htmlContent are required'
        });
        return;
      }

      const template = await this.templateService.createTemplate(templateData, userId);
      
      res.status(201).json({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({
        error: 'Failed to create template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const tenantId = req.user?.tenantId || 'default';

      const template = await this.templateService.getTemplate(templateId, tenantId);
      
      if (!template) {
        res.status(404).json({
          error: 'Template not found'
        });
        return;
      }

      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({
        error: 'Failed to fetch template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const updates: UpdateTemplateRequest = req.body;
      const tenantId = req.user?.tenantId || 'default';
      const userId = req.user?.id || 'anonymous';

      const template = await this.templateService.updateTemplate(templateId, tenantId, updates, userId);
      
      if (!template) {
        res.status(404).json({
          error: 'Template not found'
        });
        return;
      }

      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({
        error: 'Failed to update template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const tenantId = req.user?.tenantId || 'default';

      const deleted = await this.templateService.deleteTemplate(templateId, tenantId);
      
      if (!deleted) {
        res.status(404).json({
          error: 'Template not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({
        error: 'Failed to delete template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async listTemplates(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const filters: TemplateSearchFilters = {
        search: req.query.search as string,
        category: req.query.category as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        isAIGenerated: req.query.isAIGenerated ? req.query.isAIGenerated === 'true' : undefined,
        isShared: req.query.isShared ? req.query.isShared === 'true' : undefined,
        createdBy: req.query.createdBy as string,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined
      };

      const result = await this.templateService.listTemplates(tenantId, filters, page, limit);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error listing templates:', error);
      res.status(500).json({
        error: 'Failed to list templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async shareTemplate(req: Request, res: Response): Promise<void> {
    try {
      const shareRequest: ShareTemplateRequest = req.body;
      const userId = req.user?.id || 'anonymous';

      // Validate required fields
      if (!shareRequest.templateId || !shareRequest.shareWith || shareRequest.shareWith.length === 0) {
        res.status(400).json({
          error: 'Missing required fields: templateId and shareWith are required'
        });
        return;
      }

      const shared = await this.templateService.shareTemplate(shareRequest, userId);
      
      if (!shared) {
        res.status(404).json({
          error: 'Template not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Template shared successfully'
      });
    } catch (error) {
      console.error('Error sharing template:', error);
      res.status(500).json({
        error: 'Failed to share template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getTemplateCollaborators(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;

      const collaborators = await this.templateService.getTemplateCollaborators(templateId);
      
      res.json({
        success: true,
        data: collaborators
      });
    } catch (error) {
      console.error('Error fetching collaborators:', error);
      res.status(500).json({
        error: 'Failed to fetch collaborators',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async previewTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const previewRequest: TemplatePreviewRequest = {
        templateId,
        variables: req.body.variables,
        previewType: req.body.previewType || 'desktop'
      };

      const preview = await this.templateService.previewTemplate(previewRequest);
      
      res.json({
        success: true,
        data: preview
      });
    } catch (error) {
      console.error('Error previewing template:', error);
      res.status(500).json({
        error: 'Failed to preview template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async duplicateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const tenantId = req.user?.tenantId || 'default';
      const userId = req.user?.id || 'anonymous';

      const duplicatedTemplate = await this.templateService.duplicateTemplate(templateId, tenantId, userId);
      
      if (!duplicatedTemplate) {
        res.status(404).json({
          error: 'Template not found'
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: duplicatedTemplate
      });
    } catch (error) {
      console.error('Error duplicating template:', error);
      res.status(500).json({
        error: 'Failed to duplicate template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getTemplateCategories(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default';

      const categories = await this.templateService.getTemplateCategories(tenantId);
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        error: 'Failed to fetch categories',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getTemplateTags(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'default';

      const tags = await this.templateService.getTemplateTags(tenantId);
      
      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      console.error('Error fetching tags:', error);
      res.status(500).json({
        error: 'Failed to fetch tags',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}