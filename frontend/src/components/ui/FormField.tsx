'use client';

import React from 'react';
import { Input } from './Input';
import { cn } from '@/lib/utils';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
}

export interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  validation?: ValidationRule;
  showValidation?: boolean;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ 
    label, 
    error, 
    helperText, 
    validation, 
    showValidation = true,
    onValidationChange,
    className,
    value,
    onChange,
    ...props 
  }, ref) => {
    const [internalError, setInternalError] = React.useState<string>('');
    const [touched, setTouched] = React.useState(false);

    const validateValue = React.useCallback((val: string): string | null => {
      if (!validation) return null;

      // Required validation
      if (validation.required && (!val || val.trim() === '')) {
        return `${label} is required`;
      }

      // Skip other validations if empty and not required
      if (!val || val.trim() === '') {
        return null;
      }

      // Min length validation
      if (validation.minLength && val.length < validation.minLength) {
        return `${label} must be at least ${validation.minLength} characters`;
      }

      // Max length validation
      if (validation.maxLength && val.length > validation.maxLength) {
        return `${label} must be no more than ${validation.maxLength} characters`;
      }

      // Pattern validation
      if (validation.pattern && !validation.pattern.test(val)) {
        return `${label} format is invalid`;
      }

      // Custom validation
      if (validation.custom) {
        return validation.custom(val);
      }

      return null;
    }, [validation, label]);

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      
      if (onChange) {
        onChange(e);
      }

      // Validate on change if touched
      if (touched && showValidation) {
        const validationError = validateValue(newValue);
        setInternalError(validationError || '');
        
        if (onValidationChange) {
          onValidationChange(!validationError, validationError || undefined);
        }
      }
    }, [onChange, touched, showValidation, validateValue, onValidationChange]);

    const handleBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true);
      
      if (showValidation) {
        const validationError = validateValue(e.target.value);
        setInternalError(validationError || '');
        
        if (onValidationChange) {
          onValidationChange(!validationError, validationError || undefined);
        }
      }

      if (props.onBlur) {
        props.onBlur(e);
      }
    }, [showValidation, validateValue, onValidationChange, props.onBlur]);

    const displayError = error || (touched && internalError);
    const hasError = Boolean(displayError);

    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {validation?.required && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
        
        <Input
          ref={ref}
          className={cn(
            hasError && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={hasError}
          aria-describedby={
            displayError ? `${props.id || label}-error` : 
            helperText ? `${props.id || label}-helper` : undefined
          }
          {...props}
        />

        {displayError && (
          <div 
            id={`${props.id || label}-error`}
            className="flex items-center space-x-1 text-sm text-red-600"
            role="alert"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{displayError}</span>
          </div>
        )}

        {!displayError && helperText && (
          <div 
            id={`${props.id || label}-helper`}
            className="text-sm text-gray-500"
          >
            {helperText}
          </div>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';