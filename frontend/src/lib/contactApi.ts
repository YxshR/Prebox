const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'technical' | 'billing' | 'feature' | 'general';
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai' | 'support';
  timestamp: Date;
}

export interface ChatSession {
  sessionId: string;
  createdAt: Date;
}

export interface ContactFormResponse {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  priority: string;
  category: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

class ContactApi {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || data;
  }

  async submitContactForm(formData: ContactFormData): Promise<ContactFormResponse> {
    const response = await fetch(`${API_BASE_URL}/api/support/contact-form`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(formData)
    });

    return this.handleResponse<ContactFormResponse>(response);
  }

  async getContactForms(limit: number = 20, offset: number = 0): Promise<ContactFormResponse[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/support/contact-forms?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );

    return this.handleResponse<ContactFormResponse[]>(response);
  }

  async updateContactFormStatus(id: string, status: string): Promise<ContactFormResponse> {
    const response = await fetch(`${API_BASE_URL}/api/support/contact-forms/${id}/status`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status })
    });

    return this.handleResponse<ContactFormResponse>(response);
  }

  async createChatSession(): Promise<ChatSession> {
    const response = await fetch(`${API_BASE_URL}/api/support/chat/session`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });

    return this.handleResponse<ChatSession>(response);
  }

  async sendChatMessage(sessionId: string, content: string, sender: 'user' | 'ai' | 'support' = 'user'): Promise<{
    userMessage: ChatMessage;
    aiResponse?: ChatMessage;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/support/chat/message`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        sessionId,
        content,
        sender
      })
    });

    return this.handleResponse<{
      userMessage: ChatMessage;
      aiResponse?: ChatMessage;
    }>(response);
  }

  async getChatHistory(sessionId: string, limit: number = 50): Promise<ChatMessage[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/support/chat/${sessionId}/history?limit=${limit}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );

    return this.handleResponse<ChatMessage[]>(response);
  }

  async submitEnterpriseContact(data: {
    contactType: string;
    message: string;
    preferredTime: string;
  }): Promise<ContactFormResponse> {
    const response = await fetch(`${API_BASE_URL}/api/support/enterprise/contact`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });

    return this.handleResponse<ContactFormResponse>(response);
  }

  // Utility methods for real-time features (would integrate with WebSocket)
  async connectToLiveChat(sessionId: string): Promise<WebSocket | null> {
    try {
      const token = localStorage.getItem('accessToken');
      const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws/chat/${sessionId}?token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      
      return new Promise((resolve, reject) => {
        ws.onopen = () => resolve(ws);
        ws.onerror = () => reject(new Error('Failed to connect to live chat'));
        
        // Timeout after 5 seconds
        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            reject(new Error('Connection timeout'));
          }
        }, 5000);
      });
    } catch (error) {
      console.error('Error connecting to live chat:', error);
      return null;
    }
  }

  // Mock method for typing indicators
  async sendTypingIndicator(sessionId: string, isTyping: boolean): Promise<void> {
    // This would send a typing indicator through WebSocket
    // For now, it's a no-op since we're using mock responses
    console.log(`Typing indicator for session ${sessionId}: ${isTyping}`);
  }

  // Mock method for checking support agent availability
  async checkSupportAvailability(): Promise<{
    available: boolean;
    estimatedWaitTime: number;
    agentsOnline: number;
  }> {
    // Mock response - in real implementation, this would check actual agent availability
    return {
      available: true,
      estimatedWaitTime: 2, // minutes
      agentsOnline: 3
    };
  }

  // Method to get support statistics for admin
  async getSupportStatistics(): Promise<{
    totalTickets: number;
    openTickets: number;
    averageResponseTime: number;
    customerSatisfaction: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/support/statistics`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    return this.handleResponse<{
      totalTickets: number;
      openTickets: number;
      averageResponseTime: number;
      customerSatisfaction: number;
    }>(response);
  }
}

export const contactApi = new ContactApi();