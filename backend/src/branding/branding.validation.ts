import Joi from 'joi';
import { LogoPosition } from './branding.types';

// Logo upload validation
export const logoUploadSchema = Joi.object({
  position: Joi.string()
    .valid(...Object.values(LogoPosition))
    .optional()
    .default(LogoPosition.HEADER)
});

// Branding settings update validation
export const brandingUpdateSchema = Joi.object({
  logoPosition: Joi.string()
    .valid(...Object.values(LogoPosition))
    .optional(),
  
  primaryColor: Joi.string()
    .pattern(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Primary color must be a valid hex color (e.g., #FF0000)'
    }),
  
  secondaryColor: Joi.string()
    .pattern(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Secondary color must be a valid hex color (e.g., #FF0000)'
    }),
  
  textColor: Joi.string()
    .pattern(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Text color must be a valid hex color (e.g., #FF0000)'
    }),
  
  fontFamily: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Font family must not exceed 100 characters'
    }),
  
  customCss: Joi.string()
    .max(10000)
    .optional()
    .messages({
      'string.max': 'Custom CSS must not exceed 10,000 characters'
    })
}).min(1).messages({
  'object.min': 'At least one branding setting must be provided'
});

// Branding preview validation
export const brandingPreviewSchema = Joi.object({
  settings: brandingUpdateSchema.required(),
  templateId: Joi.string()
    .uuid()
    .optional()
});

// Query parameters validation
export const brandingQuerySchema = Joi.object({
  includeHistory: Joi.boolean()
    .optional()
    .default(false),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .optional()
    .default(10)
});

// File validation constants (used in multer configuration)
export const LOGO_FILE_VALIDATION = {
  fileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.svg', '.webp']
};

// Custom validation functions
export const validateHexColor = (color: string): boolean => {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
};

export const validateFontFamily = (fontFamily: string): boolean => {
  // Basic validation for font family - can be enhanced
  return fontFamily.length <= 100 && /^[a-zA-Z0-9\s,'-]+$/.test(fontFamily);
};

export const validateCustomCss = (css: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Basic CSS validation - in production, use a proper CSS parser
  if (css.length > 10000) {
    errors.push('CSS exceeds maximum length of 10,000 characters');
  }
  
  // Check for potentially dangerous CSS
  const dangerousPatterns = [
    /@import/i,
    /javascript:/i,
    /expression\(/i,
    /behavior:/i,
    /binding:/i
  ];
  
  dangerousPatterns.forEach(pattern => {
    if (pattern.test(css)) {
      errors.push(`CSS contains potentially dangerous content: ${pattern.source}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};