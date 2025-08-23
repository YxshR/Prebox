'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useForm, FieldValues, UseFormProps, Path, FieldError } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  InputValidator, 
  InputSanitizer, 
  SecureFormProcessor, 
  SecurityLogger,
  ClientRateLimiter 
} from '../../lib/security';
import { FormErrorBoundary } from './ErrorBoundary';

/**
 * Security configuration for forms
 */
interface FormSecurityConfig {
  enableRateLimiting?: boolean;
  maxSubmissions?: number;
  rateLimitWindowMs?: number;
  enableInputSanitization?: boolean;
  enableSecurityLogging?: boolean;
  preventMultipleSubmissions?: boolean;
}

/**
 * Secure form field configuration
 */
interface SecureFieldConfig {
  type: 'email' | 'phone' | 'password' | 'text' | 'otp' | 'url' | 'number';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => { isValid: boolean; error?: string };
  sanitizer?: (value: string) => string;
}

/**
 * Secure form props
 */
interface SecureFormProps<T extends FieldValues> extends Omit<UseFormProps<T>, 'onSubmit'> {
  onSubmit: (data: T) => Promise<void> | void;
  onError?: (errors: Record<string, FieldError>) => void;
  children: React.ReactNode;
  securityConfig?: FormSecurityConfig;
  fieldConfigs?: Record<Path<T>, SecureFieldConfig>;
  className?: string;
  formId?: string;
}

/**
 * Secure form component with built-in validation, sanitization, and security features
 */
export function SecureForm<T extends FieldValues>({
  onSubmit,
  onError,
  children,
  securityConfig = {},
  fieldConfigs = {} as Record<Path<T>, SecureFieldConfig>,
  className = '',
  formId = 'secure-form',
  ...formProps
}: SecureFormProps<T>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempts, setSubmitAttempts] = useState(0);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const lastSubmitTime = useRef<number>(0);
  
  const config: Required<FormSecurityConfig> = {
    enableRateLimiting: true,
    maxSubmissions: 5,
    rateLimitWindowMs: 300000, // 5 minutes
    enableInputSanitization: true,
    enableSecurityLogging: true,
    preventMultipleSubmissions: true,
    ...securityConfig
  };

  const form = useForm<T>({
    mode: 'onChange',
    ...formProps
  });

  const { handleSubmit, formState: { errors } } = form;

  /**
   * Check rate limiting for form submissions
   */
  const checkRateLimit = useCallback((): boolean => {
    if (!config.enableRateLimiting) {
      return true;
    }

    const rateLimitKey = `form_${formId}`;
    return ClientRateLimiter.isAllowed(
      rateLimitKey,
      config.maxSubmissions,
      config.rateLimitWindowMs
    );
  }, [config, formId]);

  /**
   * Validate and sanitize form data
   */
  const processFormData = useCallback((data: T): { isValid: boolean; sanitizedData?: T; errors?: Record<string, string> } => {
    const validationRules: any = {};

    // Build validation rules from field configs
    Object.entries(fieldConfigs).forEach(([fieldName, config]) => {
      const fieldConfig = config as SecureFieldConfig;
      validationRules[fieldName] = (value: any) => {
        // Custom validator takes precedence
        if (fieldConfig.customValidator) {
          return fieldConfig.customValidator(value);
        }

        // Built-in validators based on type
        switch (fieldConfig.type) {
          case 'email':
            return InputValidator.validateEmail(value);
          case 'phone':
            return InputValidator.validatePhone(value);
          case 'password':
            return InputValidator.validatePassword(value);
          case 'otp':
            return InputValidator.validateOTP(value);
          case 'url':
            return InputValidator.validateUrl(value);
          default:
            // Basic validation for text fields
            if (fieldConfig.required && (!value || value.trim() === '')) {
              return { isValid: false, error: 'This field is required' };
            }
            if (fieldConfig.minLength && value.length < fieldConfig.minLength) {
              return { isValid: false, error: `Minimum length is ${fieldConfig.minLength} characters` };
            }
            if (fieldConfig.maxLength && value.length > fieldConfig.maxLength) {
              return { isValid: false, error: `Maximum length is ${fieldConfig.maxLength} characters` };
            }
            if (fieldConfig.pattern && !fieldConfig.pattern.test(value)) {
              return { isValid: false, error: 'Invalid format' };
            }
            return { isValid: true };
        }
      };
    });

    return SecureFormProcessor.processFormData(data, validationRules);
  }, [fieldConfigs]);

  /**
   * Handle secure form submission
   */
  const handleSecureSubmit = useCallback(async (data: T) => {
    // Prevent multiple rapid submissions
    if (config.preventMultipleSubmissions) {
      const now = Date.now();
      if (now - lastSubmitTime.current < 1000) { // 1 second cooldown
        setSecurityError('Please wait before submitting again');
        return;
      }
      lastSubmitTime.current = now;
    }

    // Check rate limiting
    if (!checkRateLimit()) {
      const remaining = ClientRateLimiter.getRemainingRequests(
        `form_${formId}`,
        config.maxSubmissions,
        config.rateLimitWindowMs
      );
      
      setSecurityError(`Too many submissions. Please try again later. (${remaining} attempts remaining)`);
      
      if (config.enableSecurityLogging) {
        SecurityLogger.log('FORM_RATE_LIMITED', `Form submission rate limited: ${formId}`, {
          formId,
          attempts: submitAttempts + 1
        });
      }
      return;
    }

    setIsSubmitting(true);
    setSecurityError(null);
    
    try {
      // Process and validate form data
      const result = processFormData(data);
      
      if (!result.isValid) {
        if (config.enableSecurityLogging) {
          SecurityLogger.log('FORM_VALIDATION_FAILED', `Form validation failed: ${formId}`, {
            formId,
            errors: result.errors
          });
        }
        
        // Convert validation errors to react-hook-form format
        if (result.errors && onError) {
          const formErrors: Record<string, FieldError> = {};
          Object.entries(result.errors).forEach(([field, message]) => {
            formErrors[field] = { type: 'validation', message };
          });
          onError(formErrors);
        }
        return;
      }

      if (config.enableSecurityLogging) {
        SecurityLogger.log('FORM_SUBMITTED', `Secure form submitted: ${formId}`, {
          formId,
          hasData: !!result.sanitizedData
        });
      }

      // Submit with sanitized data
      await onSubmit(result.sanitizedData || data);
      
      setSubmitAttempts(0); // Reset on successful submission
      
    } catch (error: any) {
      if (config.enableSecurityLogging) {
        SecurityLogger.log('FORM_SUBMISSION_ERROR', `Form submission error: ${formId}`, {
          formId,
          error: error.message
        });
      }
      
      setSecurityError('Submission failed. Please try again.');
      setSubmitAttempts(prev => prev + 1);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    config,
    checkRateLimit,
    processFormData,
    onSubmit,
    onError,
    formId,
    submitAttempts
  ]);

  return (
    <FormErrorBoundary>
      <form
        onSubmit={handleSubmit(handleSecureSubmit)}
        className={`secure-form ${className}`}
        noValidate
        autoComplete="off"
      >
        {/* Security Error Display */}
        <AnimatePresence>
          {securityError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800 font-medium">Security Error</span>
              </div>
              <p className="text-red-700 mt-1">{securityError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form Content */}
        <SecureFormProvider form={form} fieldConfigs={fieldConfigs} config={config}>
          {children}
        </SecureFormProvider>

        {/* Security Status */}
        {config.enableSecurityLogging && process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-2 bg-gray-50 rounded text-xs text-gray-600">
            <div>Security: Rate limiting {config.enableRateLimiting ? 'enabled' : 'disabled'}</div>
            <div>Sanitization: {config.enableInputSanitization ? 'enabled' : 'disabled'}</div>
            <div>Submit attempts: {submitAttempts}</div>
          </div>
        )}
      </form>
    </FormErrorBoundary>
  );
}

/**
 * Context for secure form
 */
const SecureFormContext = React.createContext<{
  form: any;
  fieldConfigs: Record<string, SecureFieldConfig>;
  config: Required<FormSecurityConfig>;
} | null>(null);

/**
 * Provider for secure form context
 */
const SecureFormProvider: React.FC<{
  children: React.ReactNode;
  form: any;
  fieldConfigs: Record<string, SecureFieldConfig>;
  config: Required<FormSecurityConfig>;
}> = ({ children, form, fieldConfigs, config }) => (
  <SecureFormContext.Provider value={{ form, fieldConfigs, config }}>
    {children}
  </SecureFormContext.Provider>
);

/**
 * Hook to use secure form context
 */
export const useSecureForm = () => {
  const context = React.useContext(SecureFormContext);
  if (!context) {
    throw new Error('useSecureForm must be used within a SecureForm');
  }
  return context;
};

/**
 * Secure input component with built-in validation and sanitization
 */
interface SecureInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label?: string;
  error?: string;
  securityType?: SecureFieldConfig['type'];
  showSecurityIndicator?: boolean;
}

export const SecureInput: React.FC<SecureInputProps> = ({
  name,
  label,
  error,
  securityType = 'text',
  showSecurityIndicator = false,
  className = '',
  ...props
}) => {
  const { form, fieldConfigs, config } = useSecureForm();
  const { register, formState: { errors } } = form;
  
  const fieldConfig = fieldConfigs[name] || { type: securityType };
  const fieldError = errors[name]?.message || error;

  // Apply sanitization on blur
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (config.enableInputSanitization) {
      let sanitizedValue = e.target.value;
      
      switch (fieldConfig.type) {
        case 'email':
          sanitizedValue = InputSanitizer.sanitizeEmail(sanitizedValue);
          break;
        case 'phone':
          sanitizedValue = InputSanitizer.sanitizePhone(sanitizedValue);
          break;
        case 'otp':
          sanitizedValue = InputSanitizer.sanitizeOTP(sanitizedValue);
          break;
        case 'url':
          sanitizedValue = InputSanitizer.sanitizeUrl(sanitizedValue);
          break;
        default:
          sanitizedValue = InputSanitizer.sanitizeText(sanitizedValue);
      }
      
      if (sanitizedValue !== e.target.value) {
        form.setValue(name, sanitizedValue);
      }
    }
    
    if (props.onBlur) {
      props.onBlur(e);
    }
  }, [config.enableInputSanitization, fieldConfig.type, form, name, props]);

  return (
    <div className="secure-input-wrapper">
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
          {showSecurityIndicator && (
            <span className="ml-2 text-xs text-green-600">🔒 Secured</span>
          )}
        </label>
      )}
      
      <input
        {...register(name, {
          required: fieldConfig.required ? 'This field is required' : false,
          minLength: fieldConfig.minLength ? {
            value: fieldConfig.minLength,
            message: `Minimum length is ${fieldConfig.minLength} characters`
          } : undefined,
          maxLength: fieldConfig.maxLength ? {
            value: fieldConfig.maxLength,
            message: `Maximum length is ${fieldConfig.maxLength} characters`
          } : undefined,
          pattern: fieldConfig.pattern ? {
            value: fieldConfig.pattern,
            message: 'Invalid format'
          } : undefined
        })}
        {...props}
        onBlur={handleBlur}
        className={`
          w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors
          ${fieldError 
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200' 
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
          }
          ${className}
        `}
        aria-invalid={!!fieldError}
        aria-describedby={fieldError ? `${name}-error` : undefined}
      />
      
      <AnimatePresence>
        {fieldError && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            id={`${name}-error`}
            className="mt-1 text-sm text-red-600"
          >
            {fieldError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};