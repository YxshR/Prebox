'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { authApi, type User, type AuthResponse } from '@/lib/auth';
import { secureApiClient } from '@/lib/secureApiClient';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  login: (authResponse: AuthResponse) => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
}

// Token storage utilities
const TOKEN_STORAGE_KEY = 'accessToken';
const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';
const TOKEN_EXPIRY_KEY = 'tokenExpiry';

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

const getStoredRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
};

const getTokenExpiry = (): number | null => {
  if (typeof window === 'undefined') return null;
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  return expiry ? parseInt(expiry, 10) : null;
};

const setTokens = (accessToken: string, refreshToken: string, expiresIn: number) => {
  if (typeof window === 'undefined') return;
  
  const expiryTime = Date.now() + (expiresIn * 1000);
  
  localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  
  // Set token in API client
  secureApiClient.setAuthToken(accessToken);
};

const clearTokens = () => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  
  // Clear token from API client
  secureApiClient.clearAuth();
};

const isTokenExpired = (): boolean => {
  const expiry = getTokenExpiry();
  if (!expiry) return true;
  
  // Consider token expired if it expires in the next 5 minutes
  return Date.now() >= (expiry - 5 * 60 * 1000);
};

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const updateState = useCallback((updates: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Schedule automatic token refresh
  const scheduleTokenRefresh = useCallback((expiresIn: number) => {
    // Clear existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Schedule refresh 5 minutes before expiry
    const refreshTime = Math.max(0, (expiresIn * 1000) - (5 * 60 * 1000));
    
    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        await refreshToken();
      } catch (error) {
        console.error('Automatic token refresh failed:', error);
        logout();
      }
    }, refreshTime);
  }, []);

  // Refresh token function
  const refreshToken = useCallback(async (): Promise<boolean> => {
    const storedRefreshToken = getStoredRefreshToken();
    
    if (!storedRefreshToken) {
      updateState({ isAuthenticated: false, user: null });
      return false;
    }

    try {
      const response = await secureApiClient.post<AuthResponse>('/auth/refresh', {
        refreshToken: storedRefreshToken
      });

      if (response.success && response.data) {
        const { accessToken, refreshToken: newRefreshToken, expiresIn, user } = response.data;
        
        setTokens(accessToken, newRefreshToken, expiresIn);
        scheduleTokenRefresh(expiresIn);
        
        updateState({
          user,
          isAuthenticated: true,
          error: null
        });
        
        return true;
      } else {
        throw new Error(response.error?.message || 'Token refresh failed');
      }
    } catch (error: any) {
      console.error('Token refresh failed:', error);
      clearTokens();
      updateState({
        user: null,
        isAuthenticated: false,
        error: 'Session expired. Please log in again.'
      });
      return false;
    }
  }, [updateState, scheduleTokenRefresh]);

  // Login function
  const login = useCallback((authResponse: AuthResponse) => {
    const { accessToken, refreshToken, expiresIn, user } = authResponse;
    
    setTokens(accessToken, refreshToken, expiresIn);
    scheduleTokenRefresh(expiresIn);
    
    updateState({
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null
    });
  }, [updateState, scheduleTokenRefresh]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      // Clear timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      // Call logout API
      await authApi.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Always clear local state
      clearTokens();
      updateState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    }
  }, [updateState]);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = getStoredToken();
      
      if (!storedToken) {
        updateState({ isLoading: false });
        return;
      }

      // Check if token is expired
      if (isTokenExpired()) {
        const refreshSuccess = await refreshToken();
        if (!refreshSuccess) {
          updateState({ isLoading: false });
          return;
        }
      } else {
        // Token is valid, set it in API client and get user data
        secureApiClient.setAuthToken(storedToken);
        
        try {
          const user = await authApi.getCurrentUser();
          const expiry = getTokenExpiry();
          
          if (expiry) {
            const expiresIn = Math.max(0, (expiry - Date.now()) / 1000);
            scheduleTokenRefresh(expiresIn);
          }
          
          updateState({
            user,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error: any) {
          console.error('Failed to get current user:', error);
          // Try to refresh token
          const refreshSuccess = await refreshToken();
          if (!refreshSuccess) {
            clearTokens();
            updateState({ isLoading: false });
          }
        }
      }
    };

    initializeAuth();

    // Cleanup on unmount
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [refreshToken, updateState, scheduleTokenRefresh]);

  // Listen for storage changes (logout from other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_STORAGE_KEY && !e.newValue) {
        // Token was removed in another tab
        updateState({
          user: null,
          isAuthenticated: false,
          error: null
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [updateState]);

  return {
    ...state,
    login,
    logout,
    refreshToken,
    clearError
  };
}