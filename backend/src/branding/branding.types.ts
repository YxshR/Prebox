// Branding and Logo Upload Types
export interface BrandingSettings {
  id: string;
  tenantId: string;
  logoUrl?: string;
  logoPosition: LogoPosition;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  fontFamily: string;
  customCss?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  uploadStatus: UploadStatus;
  createdAt: Date;
}

export enum LogoPosition {
  HEADER = 'header',
  FOOTER = 'footer',
  SIDEBAR = 'sidebar'
}

export enum UploadStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Request/Response Types
export interface LogoUploadRequest {
  file: Express.Multer.File;
  position?: LogoPosition;
}

export interface LogoUploadResult {
  logoUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  dimensions?: { width: number; height: number };
  uploadId: string;
}

export interface BrandingUpdateRequest {
  logoPosition?: LogoPosition;
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  fontFamily?: string;
  customCss?: string;
}

export interface BrandingPreviewRequest {
  settings: BrandingUpdateRequest;
  templateId?: string;
}

export interface BrandingPreviewResult {
  previewHtml: string;
  previewUrl?: string;
}

export interface BrandingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Template Branding Application
export interface TemplateWithBranding {
  templateId: string;
  originalHtml: string;
  brandedHtml: string;
  brandingSettings: BrandingSettings;
}

// File Upload Configuration
export interface FileUploadConfig {
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  uploadPath: string;
  thumbnailSizes: { width: number; height: number }[];
}

// Default branding settings for different tiers
export interface DefaultBrandingSettings {
  [key: string]: Partial<BrandingSettings>;
}

export const DEFAULT_BRANDING_CONFIG: DefaultBrandingSettings = {
  free: {
    logoPosition: LogoPosition.FOOTER,
    primaryColor: '#6366f1',
    secondaryColor: '#ffffff',
    textColor: '#374151',
    fontFamily: 'Arial, sans-serif'
  },
  paid_standard: {
    logoPosition: LogoPosition.HEADER,
    primaryColor: '#3b82f6',
    secondaryColor: '#ffffff',
    textColor: '#1f2937',
    fontFamily: 'Inter, sans-serif'
  },
  premium: {
    logoPosition: LogoPosition.HEADER,
    primaryColor: '#059669',
    secondaryColor: '#ffffff',
    textColor: '#111827',
    fontFamily: 'Inter, sans-serif'
  },
  enterprise: {
    logoPosition: LogoPosition.HEADER,
    primaryColor: '#7c3aed',
    secondaryColor: '#ffffff',
    textColor: '#111827',
    fontFamily: 'Inter, sans-serif'
  }
};

// File validation constants
export const LOGO_UPLOAD_CONFIG: FileUploadConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.svg', '.webp'],
  uploadPath: 'uploads/logos',
  thumbnailSizes: [
    { width: 150, height: 150 },
    { width: 300, height: 300 }
  ]
};