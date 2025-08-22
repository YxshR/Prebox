/**
 * End-to-End Tests for Complete User Workflows
 * 
 * These tests simulate complete user journeys through the application,
 * testing the integration between frontend, backend, and external services.
 */

import { apiClient } from '../../lib/api-client';
import { googleOAuthService } from '../../lib/googleAuth';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock external dependencies for E2E testing
global.fetch = jest.fn();

// Mock window.location for OAuth redirects
const mockLocation = {
  href: '',
  assign: jest.fn(),
  reload: jest.fn()
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('End-to-End User Workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
    localStorageMock.clear();
    
    // Setup environment
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000/api';
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  describe('Complete User Registration and Login Flow', () => {
    it('should complete full user registration workflow', async () => {
      // Step 1: User visits registration page and chooses Google OAuth
      expect(googleOAuthService.isConfigured()).toBe(true);
      
      // Step 2: User clicks Google OAuth button - redirects to backend
      googleOAuthService.initiateLogin();
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
      
      // Step 3: User completes OAuth flow and returns with auth code
      // Mock successful OAuth callback response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: {
              id: 'user-123',
              email: 'newuser@example.com',
              name: 'New User',
              isNewUser: true
            },
            accessToken: 'jwt-access-token',
            refreshToken: 'jwt-refresh-token'
          }
        })
      });
      
      const authResult = await googleOAuthService.handleCallback('google-auth-code');
      
      expect(authResult.success).toBe(true);
      expect(authResult.user?.email).toBe('newuser@example.com');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'jwt-access-token');
      
      // Step 4: User is redirected to dashboard and can access protected resources
      apiClient.setAuthToken('jwt-access-token');
      
      // Mock dashboard data request
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: authResult.user,
            stats: {
              emailsSent: 0,
              templatesCreated: 0,
              contactsImported: 0
            }
          }
        })
      });
      
      const dashboardResponse = await apiClient.get('/dashboard');
      
      expect(dashboardResponse.success).toBe(true);
      expect(dashboardResponse.data.user.email).toBe('newuser@example.com');
      
      // Step 5: User can perform authenticated actions
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { message: 'Profile updated successfully' }
        })
      });
      
      const profileUpdate = await apiClient.put('/profile', {
        name: 'Updated Name',
        preferences: { theme: 'dark' }
      });
      
      expect(profileUpdate.success).toBe(true);
    });

    it('should handle returning user login workflow', async () => {
      // Step 1: Returning user initiates login
      googleOAuthService.initiateLogin();
      
      // Step 2: OAuth callback for existing user
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: {
              id: 'user-456',
              email: 'existinguser@example.com',
              name: 'Existing User',
              isNewUser: false,
              lastLogin: new Date().toISOString()
            },
            accessToken: 'returning-user-token',
            refreshToken: 'returning-user-refresh'
          }
        })
      });
      
      const authResult = await googleOAuthService.handleCallback('returning-user-code');
      
      expect(authResult.success).toBe(true);
      expect(authResult.user?.isNewUser).toBe(false);
      
      // Step 3: Load user's existing data
      apiClient.setAuthToken('returning-user-token');
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: authResult.user,
            stats: {
              emailsSent: 1250,
              templatesCreated: 15,
              contactsImported: 500
            },
            recentActivity: [
              { type: 'email_sent', count: 50, date: '2023-12-01' }
            ]
          }
        })
      });
      
      const dashboardResponse = await apiClient.get('/dashboard');
      
      expect(dashboardResponse.success).toBe(true);
      expect(dashboardResponse.data.stats.emailsSent).toBe(1250);
    });

    it('should handle authentication failures gracefully', async () => {
      // Step 1: User attempts login but OAuth fails
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: {
            code: 'OAUTH_ERROR',
            message: 'Invalid authorization code'
          }
        })
      });
      
      const authResult = await googleOAuthService.handleCallback('invalid-code');
      
      expect(authResult.success).toBe(false);
      expect(authResult.error).toBe('Invalid authorization code');
      
      // Step 2: User should be able to retry authentication
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: { id: 'user-retry', email: 'retry@example.com' },
            accessToken: 'retry-token'
          }
        })
      });
      
      const retryResult = await googleOAuthService.handleCallback('valid-retry-code');
      
      expect(retryResult.success).toBe(true);
      expect(retryResult.user?.email).toBe('retry@example.com');
    });
  });

  describe('Email Campaign Creation Workflow', () => {
    beforeEach(async () => {
      // Setup authenticated user
      apiClient.setAuthToken('authenticated-user-token');
      localStorageMock.getItem.mockReturnValue('authenticated-user-token');
    });

    it('should complete full email campaign creation workflow', async () => {
      // Step 1: User creates a new template
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            id: 'template-123',
            name: 'Welcome Email',
            subject: 'Welcome to our platform!',
            content: '<h1>Welcome!</h1><p>Thank you for joining us.</p>',
            createdAt: new Date().toISOString()
          }
        })
      });
      
      const templateResponse = await apiClient.post('/templates', {
        name: 'Welcome Email',
        subject: 'Welcome to our platform!',
        content: '<h1>Welcome!</h1><p>Thank you for joining us.</p>'
      });
      
      expect(templateResponse.success).toBe(true);
      expect(templateResponse.data.id).toBe('template-123');
      
      // Step 2: User imports contacts
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            imported: 100,
            failed: 0,
            contactListId: 'list-456'
          }
        })
      });
      
      const contactsResponse = await apiClient.post('/contacts/import', {
        contacts: [
          { email: 'user1@example.com', name: 'User One' },
          { email: 'user2@example.com', name: 'User Two' }
        ]
      });
      
      expect(contactsResponse.success).toBe(true);
      expect(contactsResponse.data.imported).toBe(100);
      
      // Step 3: User creates campaign
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            id: 'campaign-789',
            name: 'Welcome Campaign',
            templateId: 'template-123',
            contactListId: 'list-456',
            status: 'draft',
            scheduledFor: null
          }
        })
      });
      
      const campaignResponse = await apiClient.post('/campaigns', {
        name: 'Welcome Campaign',
        templateId: 'template-123',
        contactListId: 'list-456'
      });
      
      expect(campaignResponse.success).toBe(true);
      expect(campaignResponse.data.id).toBe('campaign-789');
      
      // Step 4: User sends campaign
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            campaignId: 'campaign-789',
            status: 'sending',
            recipientCount: 100,
            estimatedDeliveryTime: '2023-12-01T10:00:00Z'
          }
        })
      });
      
      const sendResponse = await apiClient.post('/campaigns/campaign-789/send');
      
      expect(sendResponse.success).toBe(true);
      expect(sendResponse.data.status).toBe('sending');
      
      // Step 5: User can track campaign progress
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            campaignId: 'campaign-789',
            status: 'completed',
            stats: {
              sent: 100,
              delivered: 98,
              opened: 45,
              clicked: 12,
              bounced: 2
            }
          }
        })
      });
      
      const statsResponse = await apiClient.get('/campaigns/campaign-789/stats');
      
      expect(statsResponse.success).toBe(true);
      expect(statsResponse.data.stats.sent).toBe(100);
      expect(statsResponse.data.stats.delivered).toBe(98);
    });

    it('should handle campaign creation with validation errors', async () => {
      // Step 1: User attempts to create campaign with invalid data
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Template ID is required',
            details: {
              field: 'templateId',
              value: null
            }
          }
        })
      });
      
      const campaignResponse = await apiClient.post('/campaigns', {
        name: 'Invalid Campaign'
        // Missing templateId and contactListId
      });
      
      expect(campaignResponse.success).toBe(false);
      expect(campaignResponse.error?.message).toContain('HTTP 400');
      
      // Step 2: User corrects the data and retries
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            id: 'campaign-corrected',
            name: 'Corrected Campaign',
            templateId: 'template-123',
            contactListId: 'list-456'
          }
        })
      });
      
      const correctedResponse = await apiClient.post('/campaigns', {
        name: 'Corrected Campaign',
        templateId: 'template-123',
        contactListId: 'list-456'
      });
      
      expect(correctedResponse.success).toBe(true);
      expect(correctedResponse.data.id).toBe('campaign-corrected');
    });
  });

  describe('System Recovery and Error Handling Workflows', () => {
    it('should handle network connectivity issues during user workflow', async () => {
      const { result } = renderHook(() => useConnectionStatus());
      
      // Step 1: User starts with good connection
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { status: 'healthy' } })
      });
      
      await waitFor(() => {
        expect(result.current.status.isConnected).toBe(true);
      });
      
      // Step 2: Network connection fails
      const networkError = new Error('Network error');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';
      (global.fetch as jest.Mock).mockRejectedValue(networkError);
      
      // Simulate connection check
      act(() => {
        result.current.checkConnection();
      });
      
      await waitFor(() => {
        expect(result.current.status.isConnected).toBe(false);
        expect(result.current.status.error).toContain('Network error');
      });
      
      // Step 3: User attempts to retry connection
      act(() => {
        result.current.retryConnection();
      });
      
      expect(result.current.isRetrying).toBe(true);
      
      // Step 4: Connection is restored
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { status: 'healthy' } })
      });
      
      await waitFor(() => {
        expect(result.current.status.isConnected).toBe(true);
        expect(result.current.isRetrying).toBe(false);
      });
    });

    it('should handle server errors with automatic retry', async () => {
      // Step 1: Initial request fails with server error
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway'
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { message: 'Request successful after retry' }
          })
        });
      
      // Step 2: API client automatically retries and succeeds
      const response = await apiClient.get('/test-endpoint');
      
      expect(response.success).toBe(true);
      expect(response.data.message).toBe('Request successful after retry');
      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should handle authentication token expiration during workflow', async () => {
      // Step 1: User starts authenticated
      apiClient.setAuthToken('expired-token');
      
      // Step 2: Token expires during API call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired'
          }
        })
      });
      
      const response = await apiClient.get('/protected-resource');
      
      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('HTTP 401');
      
      // Step 3: User re-authenticates
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: { id: 'user-123', email: 'user@example.com' },
            accessToken: 'new-fresh-token'
          }
        })
      });
      
      const reAuthResult = await googleOAuthService.handleCallback('refresh-auth-code');
      
      expect(reAuthResult.success).toBe(true);
      
      // Step 4: User can continue with new token
      apiClient.setAuthToken('new-fresh-token');
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { message: 'Access granted with new token' }
        })
      });
      
      const retryResponse = await apiClient.get('/protected-resource');
      
      expect(retryResponse.success).toBe(true);
      expect(retryResponse.data.message).toBe('Access granted with new token');
    });
  });

  describe('Pricing and Subscription Workflows', () => {
    beforeEach(() => {
      apiClient.setAuthToken('authenticated-user-token');
    });

    it('should complete subscription upgrade workflow', async () => {
      // Step 1: User views current pricing
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            plans: [
              {
                id: 'starter',
                name: 'Starter Plan',
                price: 29.99,
                currency: 'USD',
                interval: 'month',
                features: ['1000 emails/month']
              },
              {
                id: 'professional',
                name: 'Professional Plan',
                price: 79.99,
                currency: 'USD',
                interval: 'month',
                features: ['10000 emails/month', 'Advanced analytics']
              }
            ]
          }
        })
      });
      
      const pricingResponse = await apiClient.get('/pricing');
      
      expect(pricingResponse.success).toBe(true);
      expect(pricingResponse.data.plans).toHaveLength(2);
      
      // Step 2: User selects upgrade plan
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            subscriptionId: 'sub-123',
            planId: 'professional',
            status: 'active',
            nextBillingDate: '2024-01-01T00:00:00Z'
          }
        })
      });
      
      const upgradeResponse = await apiClient.post('/subscriptions/upgrade', {
        planId: 'professional',
        paymentMethodId: 'pm-test-123'
      });
      
      expect(upgradeResponse.success).toBe(true);
      expect(upgradeResponse.data.planId).toBe('professional');
      
      // Step 3: User's limits are updated
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            user: {
              id: 'user-123',
              subscription: {
                planId: 'professional',
                limits: {
                  emailsPerMonth: 10000,
                  templatesCount: 50,
                  contactsCount: 5000
                }
              }
            }
          }
        })
      });
      
      const userResponse = await apiClient.get('/user/profile');
      
      expect(userResponse.success).toBe(true);
      expect(userResponse.data.user.subscription.limits.emailsPerMonth).toBe(10000);
    });

    it('should handle payment failures during subscription', async () => {
      // Step 1: User attempts to upgrade but payment fails
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: () => Promise.resolve({
          success: false,
          error: {
            code: 'PAYMENT_FAILED',
            message: 'Payment method declined',
            details: {
              paymentMethodId: 'pm-declined-123'
            }
          }
        })
      });
      
      const failedUpgrade = await apiClient.post('/subscriptions/upgrade', {
        planId: 'professional',
        paymentMethodId: 'pm-declined-123'
      });
      
      expect(failedUpgrade.success).toBe(false);
      expect(failedUpgrade.error?.message).toContain('HTTP 402');
      
      // Step 2: User updates payment method and retries
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            subscriptionId: 'sub-retry-123',
            planId: 'professional',
            status: 'active'
          }
        })
      });
      
      const retryUpgrade = await apiClient.post('/subscriptions/upgrade', {
        planId: 'professional',
        paymentMethodId: 'pm-valid-456'
      });
      
      expect(retryUpgrade.success).toBe(true);
      expect(retryUpgrade.data.status).toBe('active');
    });
  });

  describe('Data Persistence and Session Management', () => {
    it('should maintain user session across browser refresh', async () => {
      // Step 1: User logs in and token is stored
      localStorageMock.setItem('accessToken', 'persistent-token');
      localStorageMock.setItem('refreshToken', 'persistent-refresh');
      
      // Step 2: Simulate browser refresh - token should be retrieved
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'accessToken') return 'persistent-token';
        if (key === 'refreshToken') return 'persistent-refresh';
        return null;
      });
      
      expect(localStorageMock.getItem('accessToken')).toBe('persistent-token');
      
      // Step 3: User can make authenticated requests
      apiClient.setAuthToken('persistent-token');
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { message: 'Authenticated request successful' }
        })
      });
      
      const response = await apiClient.get('/protected-endpoint');
      
      expect(response.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer persistent-token'
          })
        })
      );
    });

    it('should handle session cleanup on logout', async () => {
      // Step 1: User is logged in
      localStorageMock.setItem('accessToken', 'logout-token');
      localStorageMock.setItem('refreshToken', 'logout-refresh');
      apiClient.setAuthToken('logout-token');
      
      // Step 2: User logs out
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { message: 'Logged out successfully' }
        })
      });
      
      const logoutResponse = await apiClient.post('/auth/logout');
      
      expect(logoutResponse.success).toBe(true);
      
      // Step 3: Clear local storage and API client auth
      localStorageMock.removeItem('accessToken');
      localStorageMock.removeItem('refreshToken');
      apiClient.clearAuth();
      
      // Step 4: Subsequent requests should not include auth headers
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { message: 'Public endpoint accessed' }
        })
      });
      
      await apiClient.get('/public-endpoint');
      
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String)
          })
        })
      );
    });
  });
});