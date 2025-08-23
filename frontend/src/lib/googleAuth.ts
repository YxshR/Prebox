import { secureApiClient } from './secureApiClient';
import { SecurityLogger } from './security';

export interface GoogleAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface GoogleAuthResult {
  success: boolean;
  user?: any;
  error?: string;
}

export class GoogleOAuthService {
  private config: GoogleAuthConfig;

  constructor() {
    this.config = {
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/google/callback`,
      scopes: ['profile', 'email']
    };
  }

  /**
   * Initiate Google OAuth login flow
   */
  initiateLogin(): void {
    if (!this.config.clientId) {
      throw new Error('Google OAuth is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable.');
    }

    SecurityLogger.log('GOOGLE_AUTH_INITIATE', 'Google OAuth login initiated');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    window.location.href = `${apiUrl}/auth/google`;
  }

  /**
   * Handle Google OAuth callback
   */
  async handleCallback(code: string): Promise<GoogleAuthResult> {
    try {
      SecurityLogger.log('GOOGLE_AUTH_CALLBACK', 'Processing Google OAuth callback');

      const response = await secureApiClient.post('/auth/google/callback', {
        code,
        redirectUri: this.config.redirectUri
      });

      if (response.success) {
        SecurityLogger.log('GOOGLE_AUTH_SUCCESS', 'Google OAuth authentication successful');
        
        // Store tokens if provided
        const data = response.data as any;
        if (data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
        }
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }

        return {
          success: true,
          user: data.user
        };
      } else {
        SecurityLogger.log('GOOGLE_AUTH_FAILED', 'Google OAuth authentication failed', {
          error: response.error
        });
        
        return {
          success: false,
          error: response.error?.message || 'Google authentication failed'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google authentication failed';
      
      SecurityLogger.log('GOOGLE_AUTH_ERROR', 'Google OAuth authentication error', {
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get user profile from Google
   */
  async getProfile(token: string): Promise<any> {
    try {
      SecurityLogger.log('GOOGLE_PROFILE_REQUEST', 'Requesting Google user profile');

      const response = await secureApiClient.get('/auth/google/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.success) {
        SecurityLogger.log('GOOGLE_PROFILE_SUCCESS', 'Google profile retrieved successfully');
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Failed to get Google profile');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get Google profile';
      
      SecurityLogger.log('GOOGLE_PROFILE_ERROR', 'Google profile request failed', {
        error: errorMessage
      });

      throw new Error(errorMessage);
    }
  }

  /**
   * Check if Google OAuth is configured
   */
  isConfigured(): boolean {
    return !!this.config.clientId;
  }

  /**
   * Get configuration status for debugging
   */
  getConfigStatus(): { configured: boolean; clientId: string; redirectUri: string } {
    return {
      configured: this.isConfigured(),
      clientId: this.config.clientId ? 'Set' : 'Not set',
      redirectUri: this.config.redirectUri
    };
  }
}

// Export singleton instance
export const googleOAuthService = new GoogleOAuthService();