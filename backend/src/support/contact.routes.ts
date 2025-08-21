import { Router, Request, Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import { ContactService, ContactFormData, ChatMessage } from './contact.service';
import { AuthMiddleware } from '../auth/auth.middleware';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export function createContactRoutes(db: Pool): Router {
  const router = Router();
  const contactService = new ContactService(db);
  const authMiddleware = new AuthMiddleware().authenticate;

  // Validation middleware
  const validateContactForm = [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('priority').isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('category').isIn(['technical', 'billing', 'feature', 'general']).withMessage('Invalid category')
  ];

  const validateChatMessage = [
    body('content').notEmpty().withMessage('Message content is required'),
    body('sessionId').notEmpty().withMessage('Session ID is required'),
    body('sender').isIn(['user', 'ai', 'support']).withMessage('Invalid sender type')
  ];

  // Submit contact form
  router.post('/contact-form', authMiddleware, validateContactForm, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const { name, email, subject, message, priority, category } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Tenant ID not found'
          }
        });
      }

      const contactForm = await contactService.submitContactForm({
        tenantId,
        name,
        email,
        subject,
        message,
        priority,
        category,
        status: 'open'
      });

      res.status(201).json({
        success: true,
        data: contactForm
      });
    } catch (error) {
      console.error('Error submitting contact form:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to submit contact form'
        }
      });
    }
  });

  // Get contact forms for tenant
  router.get('/contact-forms', authMiddleware, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Tenant ID not found'
          }
        });
      }

      const contactForms = await contactService.getContactFormsByTenant(tenantId, limit, offset);

      res.json({
        success: true,
        data: contactForms,
        pagination: {
          limit,
          offset,
          total: contactForms.length
        }
      });
    } catch (error) {
      console.error('Error getting contact forms:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get contact forms'
        }
      });
    }
  });

  // Update contact form status
  router.patch('/contact-forms/:id/status', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Tenant ID not found'
          }
        });
      }

      if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid status value'
          }
        });
      }

      const updatedForm = await contactService.updateContactFormStatus(id, tenantId, status);

      res.json({
        success: true,
        data: updatedForm
      });
    } catch (error) {
      console.error('Error updating contact form status:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update contact form status'
        }
      });
    }
  });

  // Send chat message
  router.post('/chat/message', authMiddleware, validateChatMessage, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const { content, sessionId, sender } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Tenant ID not found'
          }
        });
      }

      // Save user message
      const userMessage = await contactService.saveChatMessage({
        sessionId,
        tenantId,
        content,
        sender: 'user'
      });

      let aiResponse = null;

      // Generate AI response if sender is user and this is an AI chat
      if (sender === 'user') {
        const aiResponseContent = await contactService.generateAIResponse(content);
        
        aiResponse = await contactService.saveChatMessage({
          sessionId,
          tenantId,
          content: aiResponseContent,
          sender: 'ai'
        });
      }

      res.status(201).json({
        success: true,
        data: {
          userMessage,
          aiResponse
        }
      });
    } catch (error) {
      console.error('Error sending chat message:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to send chat message'
        }
      });
    }
  });

  // Get chat history
  router.get('/chat/:sessionId/history', authMiddleware, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const tenantId = req.user?.tenantId;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Tenant ID not found'
          }
        });
      }

      const messages = await contactService.getChatHistory(sessionId, tenantId, limit);

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      console.error('Error getting chat history:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get chat history'
        }
      });
    }
  });

  // Generate new chat session
  router.post('/chat/session', authMiddleware, async (req, res) => {
    try {
      const sessionId = uuidv4();
      
      res.status(201).json({
        success: true,
        data: {
          sessionId,
          createdAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error creating chat session:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create chat session'
        }
      });
    }
  });

  // Enterprise support endpoints
  router.post('/enterprise/contact', authMiddleware, async (req, res) => {
    try {
      const { contactType, message, preferredTime } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Tenant ID not found'
          }
        });
      }

      // Check if user has enterprise tier
      // This would be implemented based on your subscription system
      
      // For now, create a high-priority contact form
      const contactForm = await contactService.submitContactForm({
        tenantId,
        name: req.user?.firstName + ' ' + req.user?.lastName || 'Enterprise User',
        email: req.user?.email || '',
        subject: `Enterprise Support Request - ${contactType}`,
        message: `${message}\n\nPreferred Contact Time: ${preferredTime}`,
        priority: 'urgent',
        category: 'general',
        status: 'open'
      });

      res.status(201).json({
        success: true,
        data: contactForm,
        message: 'Enterprise support request submitted. You will be contacted within 15 minutes.'
      });
    } catch (error) {
      console.error('Error submitting enterprise contact:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to submit enterprise contact request'
        }
      });
    }
  });

  return router;
}