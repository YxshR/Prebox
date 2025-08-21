import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AdminUser;
}

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('admin_access_token');
      this.refreshToken = localStorage.getItem('admin_refresh_token');
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthToken> {
    try {
      const response = await axios.post(`${API_BASE_URL}/admin/auth/login`, credentials);
      
      if (response.data.success) {
        const authData = response.data.data;
        this.setTokens(authData.accessToken, authData.refreshToken);
        return authData;
      } else {
        throw new Error(response.data.error?.message || 'Login failed');
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Network error occurred');
    }
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/admin/auth/refresh`, {
        refreshToken: this.refreshToken
      });

      if (response.data.success) {
        const authData = response.data.data;
        this.setTokens(authData.accessToken, authData.refreshToken);
        return authData.accessToken;
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await axios.post(`${API_BASE_URL}/admin/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        });
      }
    } catch (error) {
      // Ignore logout errors
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/admin/auth/me`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });

      if (response.data.success) {
        return response.data.data.user;
      } else {
        throw new Error('Failed to get user info');
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Try to refresh token
        try {
          await this.refreshAccessToken();
          return this.getCurrentUser();
        } catch (refreshError) {
          this.logout();
          throw new Error('Session expired');
        }
      }
      throw error;
    }
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_access_token', accessToken);
      localStorage.setItem('admin_refresh_token', refreshToken);
    }
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }
}

export const authService = new AuthService();