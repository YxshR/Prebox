/**
 * Comprehensive validation utilities for form inputs
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => ValidationResult;
}

/**
 * Email validation with comprehensive checks
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'Email is required' };
  }

  const trimmedEmail = email.trim();

  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  // Length check
  if (trimmedEmail.length > 254) {
    return { isValid: false, error: 'Email address is too long' };
  }

  // Local part length check (before @)
  const localPart = trimmedEmail.split('@')[0];
  if (localPart.length > 64) {
    return { isValid: false, error: 'Email address is invalid' };
  }

  // Common domain validation
  const domain = trimmedEmail.split('@')[1];
  if (domain.length < 2) {
    return { isValid: false, error: 'Please enter a valid email domain' };
  }

  // Check for consecutive dots
  if (trimmedEmail.includes('..')) {
    return { isValid: false, error: 'Email address format is invalid' };
  }

  return { isValid: true };
}

/**
 * Phone number validation with international support
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone || phone.trim() === '') {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  if (!cleaned) {
    return { isValid: false, error: 'Please enter a valid phone number' };
  }

  // International format validation
  if (cleaned.startsWith('+')) {
    if (cleaned.length < 8 || cleaned.length > 15) {
      return { isValid: false, error: 'Invalid international phone number format' };
    }
    return { isValid: true };
  }

  // US phone number (10 digits)
  if (cleaned.length === 10 && /^[2-9]\d{9}$/.test(cleaned)) {
    return { isValid: true };
  }

  // US phone number with country code (11 digits starting with 1)
  if (cleaned.length === 11 && cleaned.startsWith('1') && /^1[2-9]\d{9}$/.test(cleaned)) {
    return { isValid: true };
  }

  // Indian phone number (10 digits starting with 6-9)
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    return { isValid: true };
  }

  return { 
    isValid: false, 
    error: 'Please enter a valid phone number with country code or use a supported local format' 
  };
}

/**
 * Password validation with strength requirements
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must be no more than 128 characters long');
  }

  // Character type checks
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Common password checks
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Please choose a less common password');
  }

  // Sequential characters check
  if (/123456|abcdef|qwerty/i.test(password)) {
    warnings.push('Avoid using sequential characters for better security');
  }

  // Repeated characters check
  if (/(.)\1{2,}/.test(password)) {
    warnings.push('Avoid repeating the same character multiple times');
  }

  return {
    isValid: errors.length === 0,
    error: errors.length > 0 ? errors[0] : undefined,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * OTP validation
 */
export function validateOTP(otp: string): ValidationResult {
  if (!otp || otp.trim() === '') {
    return { isValid: false, error: 'Verification code is required' };
  }

  const cleaned = otp.replace(/\D/g, '');
  
  if (cleaned.length !== 6) {
    return { isValid: false, error: 'Verification code must be 6 digits' };
  }

  return { isValid: true };
}

/**
 * Generic field validation based on rules
 */
export function validateField(value: string, rules: ValidationRule, fieldName: string): ValidationResult {
  // Required check
  if (rules.required && (!value || value.trim() === '')) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  // Skip other validations if empty and not required
  if (!value || value.trim() === '') {
    return { isValid: true };
  }

  // Length validations
  if (rules.minLength && value.length < rules.minLength) {
    return { 
      isValid: false, 
      error: `${fieldName} must be at least ${rules.minLength} characters` 
    };
  }

  if (rules.maxLength && value.length > rules.maxLength) {
    return { 
      isValid: false, 
      error: `${fieldName} must be no more than ${rules.maxLength} characters` 
    };
  }

  // Pattern validation
  if (rules.pattern && !rules.pattern.test(value)) {
    return { isValid: false, error: `${fieldName} format is invalid` };
  }

  // Custom validation
  if (rules.custom) {
    return rules.custom(value);
  }

  return { isValid: true };
}

/**
 * Validate multiple fields at once
 */
export function validateForm(
  fields: Record<string, string>, 
  rules: Record<string, ValidationRule>
): { isValid: boolean; errors: Record<string, string>; warnings: Record<string, string[]> } {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string[]> = {};

  for (const [fieldName, value] of Object.entries(fields)) {
    const fieldRules = rules[fieldName];
    if (fieldRules) {
      const result = validateField(value, fieldRules, fieldName);
      if (!result.isValid && result.error) {
        errors[fieldName] = result.error;
      }
      if (result.warnings && result.warnings.length > 0) {
        warnings[fieldName] = result.warnings;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings
  };
}

/**
 * Sanitize input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Format phone number for display
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return '';
  
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    // US format: +1 (XXX) XXX-XXXX
    return cleaned.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4');
  }
  
  if (cleaned.startsWith('+91') && cleaned.length === 13) {
    // Indian format: +91 XXXXX XXXXX
    return cleaned.replace(/(\+91)(\d{5})(\d{5})/, '$1 $2 $3');
  }
  
  if (cleaned.length === 10) {
    // US format without country code: (XXX) XXX-XXXX
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }
  
  return phone;
}

/**
 * Normalize phone number for storage
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Add country code if missing
  if (cleaned.length === 10 && /^[2-9]\d{9}$/.test(cleaned)) {
    return `+1${cleaned}`; // US number
  }
  
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`; // Indian number
  }
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`; // US number with country code
  }
  
  return cleaned; // Already has country code or international format
}