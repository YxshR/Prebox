/**
 * Phone number validation and formatting utilities
 */

export interface PhoneValidationResult {
  isValid: boolean;
  formatted: string;
  error?: string;
}

/**
 * Validates and formats a phone number
 * @param phone - The phone number to validate
 * @returns PhoneValidationResult
 */
export function validateAndFormatPhone(phone: string): PhoneValidationResult {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Check if it's empty
  if (!cleaned) {
    return {
      isValid: false,
      formatted: '',
      error: 'Phone number is required'
    };
  }

  // Check for international format
  if (cleaned.startsWith('+')) {
    // International format validation
    if (cleaned.length < 8 || cleaned.length > 15) {
      return {
        isValid: false,
        formatted: cleaned,
        error: 'Invalid international phone number format'
      };
    }
    
    return {
      isValid: true,
      formatted: cleaned
    };
  }

  // Indian phone number validation (10 digits)
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    return {
      isValid: true,
      formatted: `+91${cleaned}`
    };
  }

  // US phone number validation (10 digits)
  if (cleaned.length === 10 && /^[2-9]\d{9}$/.test(cleaned)) {
    return {
      isValid: true,
      formatted: `+1${cleaned}`
    };
  }

  // If it's 11 digits and starts with 1 (US format)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const number = cleaned.substring(1);
    if (/^[2-9]\d{9}$/.test(number)) {
      return {
        isValid: true,
        formatted: `+${cleaned}`
      };
    }
  }

  return {
    isValid: false,
    formatted: cleaned,
    error: 'Invalid phone number format. Please include country code or use a valid local format.'
  };
}

/**
 * Formats a phone number for display
 * @param phone - The phone number to format
 * @returns Formatted phone number string
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return '';
  
  // Remove non-digits except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  if (cleaned.startsWith('+91') && cleaned.length === 13) {
    // Indian format: +91 XXXXX XXXXX
    return cleaned.replace(/(\+91)(\d{5})(\d{5})/, '$1 $2 $3');
  }
  
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    // US format: +1 (XXX) XXX-XXXX
    return cleaned.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4');
  }
  
  if (cleaned.startsWith('+')) {
    // Generic international format
    const countryCode = cleaned.substring(0, cleaned.length - 10);
    const number = cleaned.substring(cleaned.length - 10);
    return `${countryCode} ${number.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}`;
  }
  
  return phone;
}

/**
 * Validates OTP code format
 * @param otp - The OTP code to validate
 * @returns boolean
 */
export function validateOTPFormat(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

/**
 * Sanitizes phone number input (removes invalid characters)
 * @param input - The input string
 * @returns Sanitized phone number
 */
export function sanitizePhoneInput(input: string): string {
  // Allow digits, +, spaces, hyphens, parentheses
  return input.replace(/[^\d+\s\-()]/g, '');
}