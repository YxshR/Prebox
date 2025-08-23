/**
 * Comprehensive form validation hook with error handling
 */

import { useState, useCallback, useRef } from 'react';
import { validateForm, ValidationRule, ValidationResult } from '@/lib/validation';

export interface FormField {
  value: string;
  error: string;
  touched: boolean;
  valid: boolean;
}

export interface FormState {
  [key: string]: FormField;
}

export interface FormValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  validateOnSubmit?: boolean;
  showErrorsOnlyAfterSubmit?: boolean;
}

export interface UseFormValidationReturn {
  fields: FormState;
  errors: Record<string, string>;
  isValid: boolean;
  isSubmitting: boolean;
  hasBeenSubmitted: boolean;
  setValue: (field: string, value: string) => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  clearAllErrors: () => void;
  touchField: (field: string) => void;
  validateField: (field: string) => boolean;
  validateAllFields: () => boolean;
  handleSubmit: (onSubmit: (values: Record<string, string>) => Promise<void> | void) => (e: React.FormEvent) => Promise<void>;
  reset: () => void;
  setSubmitting: (submitting: boolean) => void;
}

/**
 * Enhanced form validation hook
 */
export function useFormValidation(
  initialValues: Record<string, string>,
  validationRules: Record<string, ValidationRule>,
  options: FormValidationOptions = {}
): UseFormValidationReturn {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    validateOnSubmit = true,
    showErrorsOnlyAfterSubmit = false
  } = options;

  // Initialize form state
  const [fields, setFields] = useState<FormState>(() => {
    const initialState: FormState = {};
    Object.keys(initialValues).forEach(key => {
      initialState[key] = {
        value: initialValues[key] || '',
        error: '',
        touched: false,
        valid: true
      };
    });
    return initialState;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasBeenSubmitted, setHasBeenSubmitted] = useState(false);
  const validationRulesRef = useRef(validationRules);

  // Update validation rules if they change
  validationRulesRef.current = validationRules;

  /**
   * Get current field values
   */
  const getValues = useCallback((): Record<string, string> => {
    const values: Record<string, string> = {};
    Object.keys(fields).forEach(key => {
      values[key] = fields[key].value;
    });
    return values;
  }, [fields]);

  /**
   * Get current errors
   */
  const errors = Object.keys(fields).reduce((acc, key) => {
    const field = fields[key];
    const shouldShowError = showErrorsOnlyAfterSubmit 
      ? hasBeenSubmitted || field.touched
      : field.touched;
    
    if (shouldShowError && field.error) {
      acc[key] = field.error;
    }
    return acc;
  }, {} as Record<string, string>);

  /**
   * Check if form is valid
   */
  const isValid = Object.values(fields).every(field => field.valid);

  /**
   * Validate a single field
   */
  const validateSingleField = useCallback((fieldName: string, value: string): ValidationResult => {
    const rule = validationRulesRef.current[fieldName];
    if (!rule) {
      return { isValid: true };
    }

    // Use the validation library
    return rule.custom ? rule.custom(value) : { isValid: true };
  }, []);

  /**
   * Set field value
   */
  const setValue = useCallback((fieldName: string, value: string) => {
    setFields(prev => {
      const newFields = { ...prev };
      
      if (!newFields[fieldName]) {
        newFields[fieldName] = {
          value: '',
          error: '',
          touched: false,
          valid: true
        };
      }

      newFields[fieldName] = {
        ...newFields[fieldName],
        value
      };

      // Validate on change if enabled
      if (validateOnChange && (newFields[fieldName].touched || hasBeenSubmitted)) {
        const validation = validateSingleField(fieldName, value);
        newFields[fieldName].error = validation.error || '';
        newFields[fieldName].valid = validation.isValid;
      }

      return newFields;
    });
  }, [validateOnChange, hasBeenSubmitted, validateSingleField]);

  /**
   * Set field error
   */
  const setError = useCallback((fieldName: string, error: string) => {
    setFields(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        error,
        valid: !error
      }
    }));
  }, []);

  /**
   * Clear field error
   */
  const clearError = useCallback((fieldName: string) => {
    setFields(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        error: '',
        valid: true
      }
    }));
  }, []);

  /**
   * Clear all errors
   */
  const clearAllErrors = useCallback(() => {
    setFields(prev => {
      const newFields = { ...prev };
      Object.keys(newFields).forEach(key => {
        newFields[key] = {
          ...newFields[key],
          error: '',
          valid: true
        };
      });
      return newFields;
    });
  }, []);

  /**
   * Touch a field (mark as interacted with)
   */
  const touchField = useCallback((fieldName: string) => {
    setFields(prev => {
      const newFields = { ...prev };
      
      if (!newFields[fieldName]) {
        return prev;
      }

      newFields[fieldName] = {
        ...newFields[fieldName],
        touched: true
      };

      // Validate on blur if enabled
      if (validateOnBlur) {
        const validation = validateSingleField(fieldName, newFields[fieldName].value);
        newFields[fieldName].error = validation.error || '';
        newFields[fieldName].valid = validation.isValid;
      }

      return newFields;
    });
  }, [validateOnBlur, validateSingleField]);

  /**
   * Validate a specific field
   */
  const validateField = useCallback((fieldName: string): boolean => {
    const field = fields[fieldName];
    if (!field) return true;

    const validation = validateSingleField(fieldName, field.value);
    
    setFields(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        error: validation.error || '',
        valid: validation.isValid,
        touched: true
      }
    }));

    return validation.isValid;
  }, [fields, validateSingleField]);

  /**
   * Validate all fields
   */
  const validateAllFields = useCallback((): boolean => {
    const values = getValues();
    const validationResult = validateForm(values, validationRulesRef.current);

    setFields(prev => {
      const newFields = { ...prev };
      
      // Mark all fields as touched
      Object.keys(newFields).forEach(key => {
        newFields[key] = {
          ...newFields[key],
          touched: true,
          error: validationResult.errors[key] || '',
          valid: !validationResult.errors[key]
        };
      });

      return newFields;
    });

    return validationResult.isValid;
  }, [getValues]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback((
    onSubmit: (values: Record<string, string>) => Promise<void> | void
  ) => {
    return async (e: React.FormEvent) => {
      e.preventDefault();
      
      setHasBeenSubmitted(true);
      
      // Validate all fields if validation on submit is enabled
      if (validateOnSubmit) {
        const isFormValid = validateAllFields();
        if (!isFormValid) {
          return;
        }
      }

      setIsSubmitting(true);

      try {
        const values = getValues();
        await onSubmit(values);
      } catch (error: any) {
        // Handle submission errors
        if (error.field && error.message) {
          setError(error.field, error.message);
        }
        throw error; // Re-throw for component to handle
      } finally {
        setIsSubmitting(false);
      }
    };
  }, [validateOnSubmit, validateAllFields, getValues, setError]);

  /**
   * Reset form to initial state
   */
  const reset = useCallback(() => {
    setFields(() => {
      const resetState: FormState = {};
      Object.keys(initialValues).forEach(key => {
        resetState[key] = {
          value: initialValues[key] || '',
          error: '',
          touched: false,
          valid: true
        };
      });
      return resetState;
    });
    setIsSubmitting(false);
    setHasBeenSubmitted(false);
  }, [initialValues]);

  /**
   * Set submitting state
   */
  const setSubmitting = useCallback((submitting: boolean) => {
    setIsSubmitting(submitting);
  }, []);

  return {
    fields,
    errors,
    isValid,
    isSubmitting,
    hasBeenSubmitted,
    setValue,
    setError,
    clearError,
    clearAllErrors,
    touchField,
    validateField,
    validateAllFields,
    handleSubmit,
    reset,
    setSubmitting
  };
}

/**
 * Hook for handling API errors in forms
 */
export function useFormErrorHandler() {
  const handleApiError = useCallback((error: any, setFieldError: (field: string, error: string) => void) => {
    // Handle constraint violations
    if (error.field && error.message) {
      setFieldError(error.field, error.message);
      return;
    }

    // Handle validation errors
    if (error.code === 'VALIDATION_ERROR' && error.field) {
      setFieldError(error.field, error.message);
      return;
    }

    // Handle duplicate errors
    if (error.code === 'DUPLICATE_EMAIL') {
      setFieldError('email', error.message);
      return;
    }

    if (error.code === 'DUPLICATE_PHONE') {
      setFieldError('phone', error.message);
      return;
    }

    // Generic error - throw to be handled by component
    throw error;
  }, []);

  return { handleApiError };
}

export default useFormValidation;