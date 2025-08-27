/**
 * Mock API service for offline/demo mode
 */

export interface MockApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class MockApiService {
  private isOnline = false;

  constructor() {
    this.checkConnection();
  }

  private async checkConnection(): Promise<void> {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // Increased timeout to 10 seconds
      });
      this.isOnline = response.ok;
    } catch {
      this.isOnline = false;
    }
  }

  async healthCheck(): Promise<MockApiResponse> {
    if (this.isOnline) {
      try {
        const response = await fetch('/api/health');
        return await response.json();
      } catch {
        // Fall through to mock response
      }
    }

    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        mode: 'OFFLINE_DEMO'
      }
    };
  }

  async login(credentials: { email: string; password: string }): Promise<MockApiResponse> {
    if (this.isOnline) {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });
        return await response.json();
      } catch {
        // Fall through to mock response
      }
    }

    // Mock successful login
    await this.delay(1000); // Simulate network delay
    
    return {
      success: true,
      data: {
        user: {
          id: 1,
          email: credentials.email,
          name: 'Demo User',
          subscriptionTier: 'free'
        },
        token: 'mock-jwt-token-' + Date.now()
      }
    };
  }

  async getCurrentUser(): Promise<MockApiResponse> {
    if (this.isOnline) {
      try {
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': 'Bearer mock-token' }
        });
        return await response.json();
      } catch {
        // Fall through to mock response
      }
    }

    await this.delay(500);
    
    return {
      success: true,
      data: {
        user: {
          id: 1,
          email: 'demo@example.com',
          name: 'Demo User',
          subscriptionTier: 'free'
        }
      }
    };
  }

  async getDashboardData(): Promise<MockApiResponse> {
    await this.delay(800);
    
    return {
      success: true,
      data: {
        stats: {
          totalEmails: 1250,
          emailsSent: 1180,
          openRate: 24.5,
          clickRate: 3.2,
          bounceRate: 2.1
        },
        recentCampaigns: [
          {
            id: 1,
            name: 'Welcome Series',
            status: 'active',
            sent: 450,
            opens: 112,
            clicks: 18,
            createdAt: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 2,
            name: 'Product Update',
            status: 'completed',
            sent: 730,
            opens: 175,
            clicks: 23,
            createdAt: new Date(Date.now() - 172800000).toISOString()
          }
        ]
      }
    };
  }

  async getCampaigns(): Promise<MockApiResponse> {
    await this.delay(600);
    
    return {
      success: true,
      data: {
        campaigns: [
          {
            id: 1,
            name: 'Welcome Series',
            status: 'active',
            recipients: 450,
            sent: 450,
            opens: 112,
            clicks: 18,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            updatedAt: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 2,
            name: 'Product Update',
            status: 'completed',
            recipients: 730,
            sent: 730,
            opens: 175,
            clicks: 23,
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            updatedAt: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 3,
            name: 'Newsletter #5',
            status: 'draft',
            recipients: 0,
            sent: 0,
            opens: 0,
            clicks: 0,
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            updatedAt: new Date(Date.now() - 3600000).toISOString()
          }
        ]
      }
    };
  }

  async getTemplates(): Promise<MockApiResponse> {
    await this.delay(400);
    
    return {
      success: true,
      data: {
        templates: [
          {
            id: 1,
            name: 'Welcome Email',
            subject: 'Welcome to our platform!',
            category: 'onboarding',
            createdAt: new Date(Date.now() - 604800000).toISOString()
          },
          {
            id: 2,
            name: 'Product Announcement',
            subject: 'Exciting new features are here!',
            category: 'marketing',
            createdAt: new Date(Date.now() - 1209600000).toISOString()
          },
          {
            id: 3,
            name: 'Newsletter Template',
            subject: 'Your weekly update',
            category: 'newsletter',
            createdAt: new Date(Date.now() - 1814400000).toISOString()
          }
        ]
      }
    };
  }

  async getContacts(): Promise<MockApiResponse> {
    await this.delay(700);
    
    return {
      success: true,
      data: {
        contacts: [
          {
            id: 1,
            email: 'john.doe@example.com',
            firstName: 'John',
            lastName: 'Doe',
            status: 'subscribed',
            createdAt: new Date(Date.now() - 2592000000).toISOString()
          },
          {
            id: 2,
            email: 'jane.smith@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
            status: 'subscribed',
            createdAt: new Date(Date.now() - 1987200000).toISOString()
          },
          {
            id: 3,
            email: 'bob.wilson@example.com',
            firstName: 'Bob',
            lastName: 'Wilson',
            status: 'unsubscribed',
            createdAt: new Date(Date.now() - 1382400000).toISOString()
          }
        ],
        total: 1250,
        subscribed: 1180,
        unsubscribed: 70
      }
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setOnlineStatus(online: boolean): void {
    this.isOnline = online;
  }

  getConnectionStatus(): boolean {
    return this.isOnline;
  }
}

export const mockApiService = new MockApiService();