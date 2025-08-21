import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface ContactFormData {
  id?: string;
  tenantId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'technical' | 'billing' | 'feature' | 'general';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChatMessage {
  id?: string;
  sessionId: string;
  tenantId: string;
  content: string;
  sender: 'user' | 'ai' | 'support';
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface SupportTicket {
  id?: string;
  contactFormId: string;
  tenantId: string;
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt?: Date;
  updatedAt?: Date;
}

export class ContactService {
  constructor(private db: Pool) {}

  async submitContactForm(data: Omit<ContactFormData, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContactFormData> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO contact_forms (
        id, tenant_id, name, email, subject, message, priority, category, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      id,
      data.tenantId,
      data.name,
      data.email,
      data.subject,
      data.message,
      data.priority,
      data.category,
      'open',
      now,
      now
    ];

    try {
      const result = await this.db.query(query, values);
      const contactForm = result.rows[0];

      // Create support ticket
      await this.createSupportTicket({
        contactFormId: id,
        tenantId: data.tenantId,
        priority: data.priority,
        status: 'open'
      });

      // Send notification email to support team
      await this.notifySupportTeam(contactForm);

      return this.mapDbRowToContactForm(contactForm);
    } catch (error) {
      console.error('Error submitting contact form:', error);
      throw new Error('Failed to submit contact form');
    }
  }

  async createSupportTicket(data: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>): Promise<SupportTicket> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO support_tickets (
        id, contact_form_id, tenant_id, assigned_to, priority, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      id,
      data.contactFormId,
      data.tenantId,
      data.assignedTo || null,
      data.priority,
      data.status,
      now,
      now
    ];

    try {
      const result = await this.db.query(query, values);
      return this.mapDbRowToSupportTicket(result.rows[0]);
    } catch (error) {
      console.error('Error creating support ticket:', error);
      throw new Error('Failed to create support ticket');
    }
  }

  async saveChatMessage(data: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO chat_messages (
        id, session_id, tenant_id, content, sender, timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      id,
      data.sessionId,
      data.tenantId,
      data.content,
      data.sender,
      now,
      JSON.stringify(data.metadata || {})
    ];

    try {
      const result = await this.db.query(query, values);
      return this.mapDbRowToChatMessage(result.rows[0]);
    } catch (error) {
      console.error('Error saving chat message:', error);
      throw new Error('Failed to save chat message');
    }
  }

  async getChatHistory(sessionId: string, tenantId: string, limit: number = 50): Promise<ChatMessage[]> {
    const query = `
      SELECT * FROM chat_messages 
      WHERE session_id = $1 AND tenant_id = $2 
      ORDER BY timestamp ASC 
      LIMIT $3
    `;

    try {
      const result = await this.db.query(query, [sessionId, tenantId, limit]);
      return result.rows.map(row => this.mapDbRowToChatMessage(row));
    } catch (error) {
      console.error('Error getting chat history:', error);
      throw new Error('Failed to get chat history');
    }
  }

  async getContactFormsByTenant(tenantId: string, limit: number = 20, offset: number = 0): Promise<ContactFormData[]> {
    const query = `
      SELECT * FROM contact_forms 
      WHERE tenant_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await this.db.query(query, [tenantId, limit, offset]);
      return result.rows.map(row => this.mapDbRowToContactForm(row));
    } catch (error) {
      console.error('Error getting contact forms:', error);
      throw new Error('Failed to get contact forms');
    }
  }

  async updateContactFormStatus(id: string, tenantId: string, status: ContactFormData['status']): Promise<ContactFormData> {
    const query = `
      UPDATE contact_forms 
      SET status = $1, updated_at = $2 
      WHERE id = $3 AND tenant_id = $4 
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [status, new Date(), id, tenantId]);
      if (result.rows.length === 0) {
        throw new Error('Contact form not found');
      }
      return this.mapDbRowToContactForm(result.rows[0]);
    } catch (error) {
      console.error('Error updating contact form status:', error);
      if (error instanceof Error && error.message === 'Contact form not found') {
        throw error;
      }
      throw new Error('Failed to update contact form status');
    }
  }

  async generateAIResponse(message: string, context?: Record<string, any>): Promise<string> {
    // This would integrate with OpenAI or Claude API
    // For now, return a mock response
    const responses = [
      "I understand your concern. Let me help you with that. Can you provide more details about the issue you're experiencing?",
      "That's a great question! Based on your subscription tier, here are the available options...",
      "I can help you troubleshoot this issue. Let's start by checking your account settings.",
      "For billing-related questions, I recommend checking your Usage & Billing page in the dashboard. Would you like me to guide you there?",
      "This seems like a technical issue. I'm connecting you with our technical support team who can provide more detailed assistance.",
      "Let me check your account details to provide you with the most accurate information.",
      "I can see you're having trouble with email delivery. Let's verify your domain authentication settings.",
      "Based on your message, it looks like you need help with template creation. I can walk you through the process."
    ];

    // Simple keyword-based response selection
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('billing') || lowerMessage.includes('payment') || lowerMessage.includes('invoice')) {
      return "For billing-related questions, I recommend checking your Usage & Billing page in the dashboard. Would you like me to guide you there?";
    }
    
    if (lowerMessage.includes('template') || lowerMessage.includes('design')) {
      return "Based on your message, it looks like you need help with template creation. I can walk you through the process.";
    }
    
    if (lowerMessage.includes('delivery') || lowerMessage.includes('bounce') || lowerMessage.includes('spam')) {
      return "I can see you're having trouble with email delivery. Let's verify your domain authentication settings.";
    }
    
    if (lowerMessage.includes('api') || lowerMessage.includes('integration')) {
      return "For API-related questions, I can help you with authentication, rate limits, and integration examples. What specific aspect would you like to know about?";
    }

    return responses[Math.floor(Math.random() * responses.length)];
  }

  private async notifySupportTeam(contactForm: any): Promise<void> {
    // This would send an email notification to the support team
    // Implementation would depend on the email service being used
    console.log('Notifying support team about new contact form:', contactForm.id);
  }

  private mapDbRowToContactForm(row: any): ContactFormData {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      message: row.message,
      priority: row.priority,
      category: row.category,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbRowToSupportTicket(row: any): SupportTicket {
    return {
      id: row.id,
      contactFormId: row.contact_form_id,
      tenantId: row.tenant_id,
      assignedTo: row.assigned_to,
      priority: row.priority,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbRowToChatMessage(row: any): ChatMessage {
    return {
      id: row.id,
      sessionId: row.session_id,
      tenantId: row.tenant_id,
      content: row.content,
      sender: row.sender,
      timestamp: row.timestamp,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    };
  }
}