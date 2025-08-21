import { create } from 'zustand';
import axios from 'axios';

export interface BrandingSettings {
  id: string;
  tenantId: string;
  logoUrl?: string;
  logoPosition: 'header' | 'footer' | 'sidebar';
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  fontFamily: string;
  customCss?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LogoUpload {
  id: string;
  tenantId: string;
  originalFilename: string;
  storedFilename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  uploadStatus: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface BrandingPreview {
  previewHtml: string;
  previewUrl?: string;
}

interface BrandingStore {
  // State
  settings: BrandingSettings | null;
  logoHistory: LogoUpload[];
  preview: BrandingPreview | null;
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;

  // Actions
  fetchSettings: (includeHistory?: boolean) => Promise<void>;
  updateSettings: (updates: Partial<BrandingSettings>) => Promise<void>;
  uploadLogo: (file: File, position?: string) => Promise<void>;
  deleteLogo: () => Promise<void>;
  generatePreview: (settings: Partial<BrandingSettings>, templateId?: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const useBrandingStore = create<BrandingStore>((set, get) => ({
  // Initial state
  settings: null,
  logoHistory: [],
  preview: null,
  isLoading: false,
  isUploading: false,
  error: null,

  // Actions
  fetchSettings: async (includeHistory = false) => {
    set({ isLoading: true, error: null });
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_BASE_URL}/branding/settings`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          includeHistory
        }
      });

      if (response.data.success) {
        set({
          settings: response.data.data.settings,
          logoHistory: response.data.data.logoHistory || [],
          isLoading: false
        });
      } else {
        throw new Error(response.data.error?.message || 'Failed to fetch branding settings');
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || error.message || 'Failed to fetch branding settings',
        isLoading: false
      });
    }
  },

  updateSettings: async (updates) => {
    set({ isLoading: true, error: null });
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.put(`${API_BASE_URL}/branding/settings`, updates, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        set({
          settings: response.data.data.settings,
          isLoading: false
        });
      } else {
        throw new Error(response.data.error?.message || 'Failed to update branding settings');
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || error.message || 'Failed to update branding settings',
        isLoading: false
      });
    }
  },

  uploadLogo: async (file, position = 'header') => {
    set({ isUploading: true, error: null });
    
    try {
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('position', position);

      const response = await axios.post(`${API_BASE_URL}/branding/logo`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        // Refresh settings to get updated logo URL
        await get().fetchSettings(true);
        set({ isUploading: false });
      } else {
        throw new Error(response.data.error?.message || 'Failed to upload logo');
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || error.message || 'Failed to upload logo',
        isUploading: false
      });
    }
  },

  deleteLogo: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.delete(`${API_BASE_URL}/branding/logo`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        // Refresh settings to get updated state
        await get().fetchSettings();
        set({ isLoading: false });
      } else {
        throw new Error(response.data.error?.message || 'Failed to delete logo');
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || error.message || 'Failed to delete logo',
        isLoading: false
      });
    }
  },

  generatePreview: async (settings, templateId) => {
    set({ isLoading: true, error: null });
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.post(`${API_BASE_URL}/branding/preview`, {
        settings,
        templateId
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        set({
          preview: response.data.data.preview,
          isLoading: false
        });
      } else {
        throw new Error(response.data.error?.message || 'Failed to generate preview');
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || error.message || 'Failed to generate preview',
        isLoading: false
      });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    settings: null,
    logoHistory: [],
    preview: null,
    isLoading: false,
    isUploading: false,
    error: null
  })
}));