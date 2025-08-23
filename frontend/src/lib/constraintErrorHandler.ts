/**
 * Constraint violation error handling utilities
 */

export interface ConstraintError {
  type: 'duplicate' | 'invalid_reference' | 'missing_field' | 'format_error' | 'unknown';
  field?: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  suggestions?: string[];
}

/**
 * Parse constraint violation errors from API responses
 */
export function parseConstraintError(error: any): ConstraintError {
  // Handle different error response formats
  const errorData = error.response?.data || error.data || error;
  const errorMessage = errorData.message || errorData.error?.message || error.message || '';
  const errorCode = errorData.code || errorData.error?.code || error.code || '';
  const status = error.response?.status || error.status;

  // Database constraint violations (PostgreSQL error codes)
  if (errorCode === '23505' || errorMessage.includes('duplicate key') || errorMessage.includes('already exists')) {
    return handleDuplicateConstraint(errorData, errorMessage);
  }

  if (errorCode === '23503' || errorMessage.includes('foreign key')) {
    return {
      type: 'invalid_reference',
      message: errorMessage,
      userMessage: 'The referenced item no longer exists. Please refresh and try again.',
      retryable: false,
      suggestions: ['Refresh the page', 'Check if the item still exists']
    };
  }

  if (errorCode === '23502' || errorMessage.includes('not null')) {
    return {
      type: 'missing_field',
      field: extractFieldFromError(errorMessage),
      message: errorMessage,
      userMessage: 'A required field is missing. Please fill in all required information.',
      retryable: false,
      suggestions: ['Check all required fields are filled']
    };
  }

  // HTTP status-based errors
  if (status === 409) {
    return handleDuplicateConstraint(errorData, errorMessage);
  }

  if (status === 400) {
    return {
      type: 'format_error',
      field: extractFieldFromError(errorMessage),
      message: errorMessage,
      userMessage: getValidationErrorMessage(errorMessage),
      retryable: false,
      suggestions: getValidationSuggestions(errorMessage)
    };
  }

  // Default unknown error
  return {
    type: 'unknown',
    message: errorMessage,
    userMessage: 'An unexpected error occurred. Please try again.',
    retryable: true,
    suggestions: ['Try again in a moment', 'Refresh the page']
  };
}

/**
 * Handle duplicate constraint violations
 */
function handleDuplicateConstraint(errorData: any, errorMessage: string): ConstraintError {
  const field = extractFieldFromError(errorMessage);
  
  // Phone number duplicate
  if (field === 'phone' || errorMessage.toLowerCase().includes('phone')) {
    return {
      type: 'duplicate',
      field: 'phone',
      message: errorMessage,
      userMessage: 'This phone number is already registered. Please use a different number or try logging in.',
      retryable: false,
      suggestions: [
        'Use a different phone number',
        'Try logging in instead',
        'Contact support if this is your number'
      ]
    };
  }

  // Email duplicate
  if (field === 'email' || errorMessage.toLowerCase().includes('email')) {
    return {
      type: 'duplicate',
      field: 'email',
      message: errorMessage,
      userMessage: 'This email address is already registered. Please use a different email or try logging in.',
      retryable: false,
      suggestions: [
        'Use a different email address',
        'Try logging in instead',
        'Use the forgot password option'
      ]
    };
  }

  // Generic duplicate
  return {
    type: 'duplicate',
    field,
    message: errorMessage,
    userMessage: 'This information is already in use. Please try different values.',
    retryable: false,
    suggestions: ['Use different information', 'Check if you already have an account']
  };
}

/**
 * Extract field name from error message
 */
function extractFieldFromError(errorMessage: string): string | undefined {
  // Common patterns for field extraction
  const patterns = [
    /Key \(([^)]+)\)/, // PostgreSQL: Key (field_name)
    /column "([^"]+)"/, // PostgreSQL: column "field_name"
    /field[:\s]+([a-zA-Z_]+)/, // Generic: field: field_name
    /"([^"]+)" already exists/, // Generic: "field_name" already exists
    /duplicate.*?([a-zA-Z_]+)/, // Generic: duplicate field_name
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  }

  // Check for common field names in message
  const commonFields = ['email', 'phone', 'username', 'name'];
  for (const field of commonFields) {
    if (errorMessage.toLowerCase().includes(field)) {
      return field;
    }
  }

  return undefined;
}

/**
 * Get user-friendly validation error message
 */
function getValidationErrorMessage(errorMessage: string): string {
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('email')) {
    return 'Please enter a valid email address.';
  }

  if (lowerMessage.includes('phone')) {
    return 'Please enter a valid phone number.';
  }

  if (lowerMessage.includes('password')) {
    return 'Password does not meet security requirements.';
  }

  if (lowerMessage.includes('required')) {
    return 'Please fill in all required fields.';
  }

  if (lowerMessage.includes('format') || lowerMessage.includes('invalid')) {
    return 'Please check the format of your information.';
  }

  return 'Please check your information and try again.';
}

/**
 * Get validation suggestions based on error message
 */
function getValidationSuggestions(errorMessage: string): string[] {
  const lowerMessage = errorMessage.toLowerCase();
  const suggestions: string[] = [];

  if (lowerMessage.includes('email')) {
    suggestions.push('Use a valid email format (example@domain.com)');
  }

  if (lowerMessage.includes('phone')) {
    suggestions.push('Include country code or use local format');
    suggestions.push('Remove spaces and special characters');
  }

  if (lowerMessage.includes('password')) {
    suggestions.push('Use at least 8 characters');
    suggestions.push('Include uppercase, lowercase, numbers, and symbols');
  }

  if (suggestions.length === 0) {
    suggestions.push('Check the format of your information');
    suggestions.push('Ensure all required fields are filled');
  }

  return suggestions;
}

/**
 * Format constraint error for display
 */
export function formatConstraintErrorForDisplay(error: ConstraintError): {
  title: string;
  message: string;
  suggestions: string[];
  severity: 'error' | 'warning' | 'info';
} {
  let title: string;
  let severity: 'error' | 'warning' | 'info' = 'error';

  switch (error.type) {
    case 'duplicate':
      title = 'Already Registered';
      break;
    case 'invalid_reference':
      title = 'Reference Error';
      break;
    case 'missing_field':
      title = 'Missing Information';
      break;
    case 'format_error':
      title = 'Invalid Format';
      severity = 'warning';
      break;
    default:
      title = 'Error';
  }

  return {
    title,
    message: error.userMessage,
    suggestions: error.suggestions || [],
    severity
  };
}

/**
 * Check if error is a constraint violation
 */
export function isConstraintError(error: any): boolean {
  const errorData = error.response?.data || error.data || error;
  const errorMessage = errorData.message || errorData.error?.message || error.message || '';
  const errorCode = errorData.code || errorData.error?.code || error.code || '';
  const status = error.response?.status || error.status;

  // Database constraint error codes
  const constraintCodes = ['23505', '23503', '23502', '23514'];
  if (constraintCodes.includes(errorCode)) {
    return true;
  }

  // HTTP status codes that typically indicate constraint violations
  if (status === 409 || status === 400) {
    return true;
  }

  // Message-based detection
  const constraintKeywords = [
    'duplicate key',
    'already exists',
    'foreign key',
    'not null',
    'constraint',
    'violation'
  ];

  return constraintKeywords.some(keyword => 
    errorMessage.toLowerCase().includes(keyword)
  );
}

/**
 * Get retry strategy for constraint errors
 */
export function getConstraintErrorRetryStrategy(error: ConstraintError): {
  shouldRetry: boolean;
  retryDelay?: number;
  maxRetries?: number;
} {
  // Most constraint errors are not retryable as they require user action
  if (!error.retryable) {
    return { shouldRetry: false };
  }

  // Unknown errors might be temporary
  if (error.type === 'unknown') {
    return {
      shouldRetry: true,
      retryDelay: 2000, // 2 seconds
      maxRetries: 2
    };
  }

  return { shouldRetry: false };
}