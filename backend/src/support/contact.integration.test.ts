import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { createContactRoutes } from './contact.routes';
import { AuthMiddleware } from '../auth/auth.middleware';

// Mock the auth middleware
const mockAuthMiddleware = (req: any, res: any, next: any) => {
  req.user = {
    id: 'user-123',
    tenantId: 'tenant-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User'
  };
  next();
};

jest.mock('../auth/auth.middleware', () => ({
  AuthMiddleware: jest.fn().mockImplementation(() => ({
    authenticate: mockAuthMiddleware
  }))
}));

// Mock the database
const mockDb = {
  query: jest.fn()
} as unknown as Pool;

describe('Contact Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/support', createContactRoutes(mockDb));
    jest.clearAllMocks();
  });

  describe('POST /api/support/contact-form', () => {
    it('should successfully submit a contact form', async () => {
      const mockContactForm = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'Test message content',
        priority: 'medium',
        category: 'technical'
      };

      const mockDbResult = {
        rows: [{
          id: 'contact-123',
          tenant_id: 'tenant-123',
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Test Subject',
          message: 'Test message content',
          priority: 'medium',
          category: 'technical',
          status: 'open',
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce(mockDbResult) // Contact form insert
        .mockResolvedValueOnce({ rows: [{}] }); // Support ticket insert

      const response = await request(app)
        .post('/api/support/contact-form')
        .send(mockContactForm)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 'contact-123',
        tenantId: 'tenant-123',
        name: 'John Doe',
        email: 'john@example.com'
      });
    });

    it('should return validation error for missing required fields', async () => {
      const invalidContactForm = {
        name: 'John Doe',
        // Missing email, subject, message, priority, category
      };

      const response = await request(app)
        .post('/api/support/contact-form')
        .send(invalidContactForm)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
    });

    it('should return validation error for invalid email', async () => {
      const invalidContactForm = {
        name: 'John Doe',
        email: 'invalid-email',
        subject: 'Test Subject',
        message: 'Test message',
        priority: 'medium',
        category: 'technical'
      };

      const response = await request(app)
        .post('/api/support/contact-form')
        .send(invalidContactForm)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for invalid priority', async () => {
      const invalidContactForm = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'Test message',
        priority: 'invalid-priority',
        category: 'technical'
      };

      const response = await request(app)
        .post('/api/support/contact-form')
        .send(invalidContactForm)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/support/contact-forms', () => {
    it('should retrieve contact forms for the tenant', async () => {
      const mockDbResult = {
        rows: [
          {
            id: 'contact-1',
            tenant_id: 'tenant-123',
            name: 'John Doe',
            email: 'john@example.com',
            subject: 'Test 1',
            message: 'Message 1',
            priority: 'medium',
            category: 'technical',
            status: 'open',
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      };

      (mockDb.query as jest.Mock).mockResolvedValue(mockDbResult);

      const response = await request(app)
        .get('/api/support/contact-forms')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: 'contact-1',
        tenantId: 'tenant-123',
        name: 'John Doe'
      });
    });

    it('should handle pagination parameters', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/support/contact-forms?limit=10&offset=20')
        .expect(200);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['tenant-123', 10, 20]
      );
    });
  });

  describe('PATCH /api/support/contact-forms/:id/status', () => {
    it('should successfully update contact form status', async () => {
      const mockDbResult = {
        rows: [{
          id: 'contact-123',
          tenant_id: 'tenant-123',
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Test Subject',
          message: 'Test message',
          priority: 'medium',
          category: 'technical',
          status: 'resolved',
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      (mockDb.query as jest.Mock).mockResolvedValue(mockDbResult);

      const response = await request(app)
        .patch('/api/support/contact-forms/contact-123/status')
        .send({ status: 'resolved' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('resolved');
    });

    it('should return validation error for invalid status', async () => {
      const response = await request(app)
        .patch('/api/support/contact-forms/contact-123/status')
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/support/chat/message', () => {
    it('should successfully send a chat message', async () => {
      const mockUserMessage = {
        id: 'message-1',
        session_id: 'session-123',
        tenant_id: 'tenant-123',
        content: 'Hello, I need help',
        sender: 'user',
        timestamp: new Date(),
        metadata: '{}'
      };

      const mockAiMessage = {
        id: 'message-2',
        session_id: 'session-123',
        tenant_id: 'tenant-123',
        content: 'Hi! How can I help you?',
        sender: 'ai',
        timestamp: new Date(),
        metadata: '{}'
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUserMessage] })
        .mockResolvedValueOnce({ rows: [mockAiMessage] });

      const response = await request(app)
        .post('/api/support/chat/message')
        .send({
          content: 'Hello, I need help',
          sessionId: 'session-123',
          sender: 'user'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userMessage).toMatchObject({
        content: 'Hello, I need help',
        sender: 'user'
      });
      expect(response.body.data.aiResponse).toMatchObject({
        sender: 'ai'
      });
    });

    it('should return validation error for missing content', async () => {
      const response = await request(app)
        .post('/api/support/chat/message')
        .send({
          sessionId: 'session-123',
          sender: 'user'
          // Missing content
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/support/chat/:sessionId/history', () => {
    it('should retrieve chat history for a session', async () => {
      const mockDbResult = {
        rows: [
          {
            id: 'message-1',
            session_id: 'session-123',
            tenant_id: 'tenant-123',
            content: 'Hello',
            sender: 'user',
            timestamp: new Date(),
            metadata: '{}'
          },
          {
            id: 'message-2',
            session_id: 'session-123',
            tenant_id: 'tenant-123',
            content: 'Hi there!',
            sender: 'ai',
            timestamp: new Date(),
            metadata: '{}'
          }
        ]
      };

      (mockDb.query as jest.Mock).mockResolvedValue(mockDbResult);

      const response = await request(app)
        .get('/api/support/chat/session-123/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toMatchObject({
        content: 'Hello',
        sender: 'user'
      });
    });
  });

  describe('POST /api/support/chat/session', () => {
    it('should create a new chat session', async () => {
      const response = await request(app)
        .post('/api/support/chat/session')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();
    });
  });

  describe('POST /api/support/enterprise/contact', () => {
    it('should successfully submit enterprise contact request', async () => {
      const mockDbResult = {
        rows: [{
          id: 'contact-123',
          tenant_id: 'tenant-123',
          name: 'Test User',
          email: 'test@example.com',
          subject: 'Enterprise Support Request - demo',
          message: 'Need help with integration\n\nPreferred Contact Time: 2:00 PM EST',
          priority: 'urgent',
          category: 'general',
          status: 'open',
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce(mockDbResult) // Contact form insert
        .mockResolvedValueOnce({ rows: [{}] }); // Support ticket insert

      const response = await request(app)
        .post('/api/support/enterprise/contact')
        .send({
          contactType: 'demo',
          message: 'Need help with integration',
          preferredTime: '2:00 PM EST'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('15 minutes');
    });
  });
});