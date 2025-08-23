/**
 * Comprehensive error handling tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { FormField } from '@/components/ui/FormField';
import { validateEmail, validatePhone, validatePassword } from '@/lib/validation';
import { parseConstraintError, isConstraintError } from '@/lib/constraintErrorHandler';
import { enhancedRetry } from '@/lib/enhancedRetry';
import { useFormValidation } from '@/hooks/useFormValidation';

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe('Error Boundary', () => {
  const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
      throw new Error('Test error');
    }
    return <div>No error</div>;
  };

  it('should catch and display errors', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should allow retry functionality', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const retryButton = screen.getByText(/try again/i);
    fireEvent.click(retryButton);

    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });
});

describe('FormField Validation', () => {
  it('should validate email format', () => {
    const mockValidation = jest.fn();
    
    render(
      <FormField
        label="Email"
        type="email"
        validation={{
          required: true,
          custom: (value) => validateEmail(value)
        }}
        onValidationChange={mockValidation}
      />
    );

    const input = screen.getByLabelText(/email/i);
    
    // Test invalid email
    fireEvent.change(input, { target: { value: 'invalid-email' } });
    fireEvent.blur(input);

    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
  });

  it('should validate phone number format', () => {
    render(
      <FormField
        label="Phone"
        type="tel"
        validation={{
          required: true,
          custom: (value) => validatePhone(value)
        }}
      />
    );

    const input = screen.getByLabelText(/phone/i);
    
    // Test invalid phone
    fireEvent.change(input, { target: { value: '123' } });
    fireEvent.blur(input);

    expect(screen.getByText(/please enter a valid phone number/i)).toBeInTheDocument();
  });

  it('should validate password strength', () => {
    render(
      <FormField
        label="Password"
        type="password"
        validation={{
          required: true,
          custom: (value) => validatePassword(value)
        }}
      />
    );

    const input = screen.getByLabelText(/password/i);
    
    // Test weak password
    fireEvent.change(input, { target: { value: '123' } });
    fireEvent.blur(input);

    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('should show required field error', () => {
    render(
      <FormField
        label="Required Field"
        validation={{ required: true }}
      />
    );

    const input = screen.getByLabelText(/required field/i);
    
    fireEvent.blur(input);

    expect(screen.getByText(/required field is required/i)).toBeInTheDocument();
  });
});

describe('Validation Functions', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('test@example.com')).toEqual({ isValid: true });
      expect(validateEmail('user.name+tag@domain.co.uk')).toEqual({ isValid: true });
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid-email')).toEqual({
        isValid: false,
        error: 'Please enter a valid email address'
      });
      expect(validateEmail('')).toEqual({
        isValid: false,
        error: 'Email is required'
      });
    });
  });

  describe('validatePhone', () => {
    it('should validate correct phone formats', () => {
      expect(validatePhone('+1234567890')).toEqual({ isValid: true });
      expect(validatePhone('1234567890')).toEqual({ isValid: true });
      expect(validatePhone('+919876543210')).toEqual({ isValid: true });
    });

    it('should reject invalid phone formats', () => {
      expect(validatePhone('123')).toEqual({
        isValid: false,
        error: expect.stringContaining('valid phone number')
      });
      expect(validatePhone('')).toEqual({
        isValid: false,
        error: 'Phone number is required'
      });
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      expect(validatePassword('StrongPass123!')).toEqual({ isValid: true });
    });

    it('should reject weak passwords', () => {
      expect(validatePassword('weak')).toEqual({
        isValid: false,
        error: 'Password must be at least 8 characters long'
      });
      expect(validatePassword('NoNumbers!')).toEqual({
        isValid: false,
        error: expect.stringContaining('number')
      });
    });
  });
});

describe('Constraint Error Handling', () => {
  it('should detect constraint errors', () => {
    const duplicateError = {
      response: { status: 409 },
      data: { message: 'duplicate key value violates unique constraint' }
    };

    expect(isConstraintError(duplicateError)).toBe(true);
  });

  it('should parse duplicate email errors', () => {
    const error = {
      response: { status: 409 },
      data: { 
        message: 'duplicate key value violates unique constraint "users_email_key"',
        code: '23505'
      }
    };

    const parsed = parseConstraintError(error);
    
    expect(parsed.type).toBe('duplicate');
    expect(parsed.field).toBe('email');
    expect(parsed.userMessage).toContain('email address is already registered');
    expect(parsed.retryable).toBe(false);
  });

  it('should parse duplicate phone errors', () => {
    const error = {
      response: { status: 409 },
      data: { 
        message: 'duplicate key value violates unique constraint "users_phone_key"',
        code: '23505'
      }
    };

    const parsed = parseConstraintError(error);
    
    expect(parsed.type).toBe('duplicate');
    expect(parsed.field).toBe('phone');
    expect(parsed.userMessage).toContain('phone number is already registered');
  });
});

describe('Enhanced Retry Logic', () => {
  it('should retry on network errors', async () => {
    let attempts = 0;
    const mockFn = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        const error = new Error('Network error');
        (error as any).code = 'ERR_NETWORK';
        throw error;
      }
      return 'success';
    });

    const result = await enhancedRetry(mockFn, { maxAttempts: 3 });
    
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should not retry on constraint violations', async () => {
    let attempts = 0;
    const mockFn = jest.fn().mockImplementation(() => {
      attempts++;
      const error = new Error('Duplicate key');
      (error as any).response = { status: 409 };
      throw error;
    });

    await expect(enhancedRetry(mockFn, { maxAttempts: 3 })).rejects.toThrow();
    expect(attempts).toBe(1);
  });

  it('should not retry on validation errors', async () => {
    let attempts = 0;
    const mockFn = jest.fn().mockImplementation(() => {
      attempts++;
      const error = new Error('Validation failed');
      (error as any).response = { status: 400 };
      throw error;
    });

    await expect(enhancedRetry(mockFn, { maxAttempts: 3 })).rejects.toThrow();
    expect(attempts).toBe(1);
  });
});

describe('Form Validation Hook', () => {
  const TestComponent = () => {
    const {
      fields,
      errors,
      isValid,
      setValue,
      validateField,
      handleSubmit
    } = useFormValidation(
      { email: '', password: '' },
      {
        email: {
          required: true,
          custom: (value) => validateEmail(value)
        },
        password: {
          required: true,
          custom: (value) => validatePassword(value)
        }
      }
    );

    const onSubmit = handleSubmit(async (values) => {
      // Mock submit
    });

    return (
      <form onSubmit={onSubmit}>
        <input
          data-testid="email"
          value={fields.email?.value || ''}
          onChange={(e) => setValue('email', e.target.value)}
          onBlur={() => validateField('email')}
        />
        {errors.email && <div data-testid="email-error">{errors.email}</div>}
        
        <input
          data-testid="password"
          type="password"
          value={fields.password?.value || ''}
          onChange={(e) => setValue('password', e.target.value)}
          onBlur={() => validateField('password')}
        />
        {errors.password && <div data-testid="password-error">{errors.password}</div>}
        
        <button type="submit" disabled={!isValid}>
          Submit
        </button>
      </form>
    );
  };

  it('should validate form fields', async () => {
    render(<TestComponent />);

    const emailInput = screen.getByTestId('email');
    const passwordInput = screen.getByTestId('password');

    // Test invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid' } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByTestId('email-error')).toBeInTheDocument();
    });

    // Test invalid password
    fireEvent.change(passwordInput, { target: { value: 'weak' } });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(screen.getByTestId('password-error')).toBeInTheDocument();
    });

    // Submit button should be disabled
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('should enable submit when form is valid', async () => {
    render(<TestComponent />);

    const emailInput = screen.getByTestId('email');
    const passwordInput = screen.getByTestId('password');

    // Enter valid values
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.blur(emailInput);

    fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
    });
  });
});

describe('Error Message Display', () => {
  it('should display user-friendly error messages', () => {
    const error = {
      code: 'DUPLICATE_EMAIL',
      message: 'This email address is already registered.',
      suggestions: ['Use a different email', 'Try logging in']
    };

    render(
      <div>
        <div>{error.message}</div>
        <ul>
          {error.suggestions?.map((suggestion, index) => (
            <li key={index}>{suggestion}</li>
          ))}
        </ul>
      </div>
    );

    expect(screen.getByText(/email address is already registered/i)).toBeInTheDocument();
    expect(screen.getByText(/use a different email/i)).toBeInTheDocument();
    expect(screen.getByText(/try logging in/i)).toBeInTheDocument();
  });
});

export {};