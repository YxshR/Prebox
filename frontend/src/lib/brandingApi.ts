import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

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

export interface LogoUploadResult {
  logoUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  dimensions?: { width: number; height: number };
  uploadId: string;
}

class BrandingApi {
  private getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
      Authorization: `Bearer ${token}`
    };
  }

  async getBrandingSettings(includeHistory = false): Promise<{
    settings: BrandingSettings | null;
    logoHistory?: LogoUpload[];
  }> {
    const response = await axios.get(`${API_BASE_URL}/branding/settings`, {
      headers: this.getAuthHeaders(),
      params: { includeHistory }
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch branding settings');
    }

    return response.data.data;
  }

  async updateBrandingSettings(updates: Partial<BrandingSettings>): Promise<BrandingSettings> {
    const response = await axios.put(`${API_BASE_URL}/branding/settings`, updates, {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to update branding settings');
    }

    return response.data.data.settings;
  }

  async uploadLogo(file: File, position = 'header'): Promise<LogoUploadResult> {
    const formData = new FormData();
    formData.append('logo', file);
    formData.append('position', position);

    const response = await axios.post(`${API_BASE_URL}/branding/logo`, formData, {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to upload logo');
    }

    return response.data.data.logo;
  }

  async deleteLogo(): Promise<void> {
    const response = await axios.delete(`${API_BASE_URL}/branding/logo`, {
      headers: this.getAuthHeaders()
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to delete logo');
    }
  }

  async generatePreview(
    settings: Partial<BrandingSettings>, 
    templateId?: string
  ): Promise<BrandingPreview> {
    const response = await axios.post(`${API_BASE_URL}/branding/preview`, {
      settings,
      templateId
    }, {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to generate preview');
    }

    return response.data.data.preview;
  }

  async getLogoUploadHistory(): Promise<LogoUpload[]> {
    const response = await axios.get(`${API_BASE_URL}/branding/history`, {
      headers: this.getAuthHeaders()
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch logo upload history');
    }

    return response.data.data.history;
  }

  // Utility method to validate hex colors
  validateHexColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  // Utility method to get logo URL with proper base path
  getLogoUrl(logoUrl: string): string {
    if (logoUrl.startsWith('http')) {
      return logoUrl;
    }
    return `${API_BASE_URL.replace('/api', '')}${logoUrl}`;
  }
}

export const brandingApi = new BrandingApi();