import { Router } from 'express';
import { TemplateController } from './template.controller';

const router = Router();
const templateController = new TemplateController();

// Template CRUD operations
router.post('/', templateController.createTemplate.bind(templateController));
router.get('/', templateController.listTemplates.bind(templateController));
router.get('/categories', templateController.getTemplateCategories.bind(templateController));
router.get('/tags', templateController.getTemplateTags.bind(templateController));
router.get('/:templateId', templateController.getTemplate.bind(templateController));
router.put('/:templateId', templateController.updateTemplate.bind(templateController));
router.delete('/:templateId', templateController.deleteTemplate.bind(templateController));

// Template collaboration
router.post('/:templateId/share', templateController.shareTemplate.bind(templateController));
router.get('/:templateId/collaborators', templateController.getTemplateCollaborators.bind(templateController));

// Template preview and duplication
router.post('/:templateId/preview', templateController.previewTemplate.bind(templateController));
router.post('/:templateId/duplicate', templateController.duplicateTemplate.bind(templateController));

export { router as templateRoutes };