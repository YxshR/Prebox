import { Pool } from 'pg';
import { ContactService, ContactFormData, ChatMessage } from './contact.service';

// Mock the database
const mockDb = {
  query: jest.fn()
} as unknown as Pool;

describe('ContactService', () => {
  let contactService: ContactService;

  beforeEach(() => {
    contactService = new ContactService(mockDb);
    jest.clearAllMocks();
  });

  describe('submitContactForm', () => {
    it('should successfully submit a contact form', async () => {
      const mockContactFormData = {
        tenantId: 'tenant-123',
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'Test message',
        priority: 'medium' as const,
        category: 'technical' as const,
        status: 'open' as const
      };

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
          status: 'open',
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce(mockDbResult) // Contact form insert
        .mockResolvedValueOnce({ rows: [{}] }); // Support ticket insert

      const result = await contactService.submitContactForm(mockContactFormData);

      expect(result).toMatchObject({
        id: 'contact-123',
        tenantId: 'tenant-123',
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'Test message',
        priority: 'medium',
        category: 'technical',
        status: 'open'
      });

      expect(mockDb.query).toHaveBeenCalledTimes(2); // Contact form + support ticket
    });

    it('should handle database errors', async () => {
      const mockContactFormData = {
        tenantId: 'tenant-123',
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'Test message',
        priority: 'medium' as const,
        category: 'technical' as const,
        status: 'open' as const
      };

      (mockDb.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(contactService.submitContactForm(mockContactFormData))
        .rejects.toThrow('Failed to submit contact form');
    });
  });

  describe('saveChatMessage', () => {
    it('should successfully save a chat message', async () => {
      const mockChatMessage = {
        sessionId: 'session-123',
        tenantId: 'tenant-123',
        content: 'Hello, I need help',
        sender: 'user' as const
      };

      const mockDbResult = {
        rows: [{
          id: 'message-123',
          session_id: 'session-123',
          tenant_id: 'tenant-123',
          content: 'Hello, I need help',
          sender: 'user',
          timestamp: new Date(),
          metadata: '{}'
        }]
      };

      (mockDb.query as jest.Mock).mockResolvedValue(mockDbResult);

      const result = await contactService.saveChatMessage(mockChatMessage);

      expect(result).toMatchObject({
        id: 'message-123',
        sessionId: 'session-123',
        tenantId: 'tenant-123',
        content: 'Hello, I need help',
        sender: 'user'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_messages'),
        expect.arrayContaining([
          expect.any(String), // id
          'session-123',
          'tenant-123',
          'Hello, I need help',
          'user',
          expect.any(Date),
          '{}'
        ])
      );
    });
  });

  describe('getChatHistory', () => {
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
            content: 'Hi there! How can I help?',
            sender: 'ai',
            timestamp: new Date(),
            metadata: '{}'
          }
        ]
      };

      (mockDb.query as jest.Mock).mockResolvedValue(mockDbResult);

      const result = await contactService.getChatHistory('session-123', 'tenant-123', 50);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'message-1',
        sessionId: 'session-123',
        content: 'Hello',
        sender: 'user'
      });
      expect(result[1]).toMatchObject({
        id: 'message-2',
        sessionId: 'session-123',
        content: 'Hi there! How can I help?',
        sender: 'ai'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM chat_messages'),
        ['session-123', 'tenant-123', 50]
      );
    });
  });

  describe('generateAIResponse', () => {
    it('should generate billing-related response for billing keywords', async () => {
      const response = await contactService.generateAIResponse('I have a billing question');
      
      expect(response).toContain('billing');
      expect(response).toContain('Usage & Billing');
    });

    it('should generate template-related response for template keywords', async () => {
      const response = await contactService.generateAIResponse('How do I create a template?');
      
      expect(response).toContain('template');
    });

    it('should generate delivery-related response for delivery keywords', async () => {
      const response = await contactService.generateAIResponse('My emails are bouncing');
      
      expect(response).toContain('delivery');
    });

    it('should generate API-related response for API keywords', async () => {
      const response = await contactService.generateAIResponse('How do I use the API?');
      
      expect(response).toContain('API');
    });

    it('should generate generic response for other messages', async () => {
      const response = await contactService.generateAIResponse('Hello there');
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });
  });

  describe('updateContactFormStatus', () => {
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

      const result = await contactService.updateContactFormStatus('contact-123', 'tenant-123', 'resolved');

      expect(result.status).toBe('resolved');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE contact_forms'),
        ['resolved', expect.any(Date), 'contact-123', 'tenant-123']
      );
    });

    it('should throw error when contact form not found', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(contactService.updateContactFormStatus('nonexistent', 'tenant-123', 'resolved'))
        .rejects.toThrow('Contact form not found');
    });
  });

  describe('getContactFormsByTenant', () => {
    it('should retrieve contact forms for a tenant', async () => {
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
          },
          {
            id: 'contact-2',
            tenant_id: 'tenant-123',
            name: 'Jane Smith',
            email: 'jane@example.com',
            subject: 'Test 2',
            message: 'Message 2',
            priority: 'high',
            category: 'billing',
            status: 'resolved',
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      };

      (mockDb.query as jest.Mock).mockResolvedValue(mockDbResult);

      const result = await contactService.getContactFormsByTenant('tenant-123', 20, 0);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'contact-1',
        tenantId: 'tenant-123',
        name: 'John Doe'
      });
      expect(result[1]).toMatchObject({
        id: 'contact-2',
        tenantId: 'tenant-123',
        name: 'Jane Smith'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM contact_forms'),
        ['tenant-123', 20, 0]
      );
    });
  });
});