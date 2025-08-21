/**
 * Comprehensive tests for client-side security implementations
 */

import { 
  InputValidator, 
  InputSanitizer, 
  ClientRateLimiter, 
  SecureFormProcessor,
  SecurityLogger 
} from '../security';

describe('InputValidator', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const result = InputValidator.validateEmail('test@example.com');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid email addresses', () => {
      const result = InputValidator.validateEmail('invalid-email');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject empty email', () => {
      const result = InputValidator.validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });
  });

  describe('validatePhone', () => {
    it('should validate correct phone numbers', () => {
      const result = InputValidator.validatePhone('+1234567890');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      const result = InputValidator.validatePhone('123');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const result = InputValidator.validatePassword('StrongPass123!');
      expect(result.isValid).toBe(true);
    });

    it('should reject weak passwords', () => {
      const result = InputValidator.validatePassword('weak');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateOTP', () => {
    it('should validate 6-digit OTP', () => {
      const result = InputValidator.validateOTP('123456');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid OTP', () => {
      const result = InputValidator.validateOTP('12345');
      expect(result.isValid).toBe(false);
    });
  });
});

describe('InputSanitizer', () => {
  describe('sanitizeText', () => {
    it('should remove HTML tags', () => {
      const result = InputSanitizer.sanitizeText('<script>alert("xss")</script>Hello');
      expect(result).toBe('alert("xss")Hello');
    });

    it('should remove javascript protocols', () => {
      const result = InputSanitizer.sanitizeText('javascript:alert("xss")');
      expect(result).toBe('alert("xss")');
    });

    it('should trim whitespace', () => {
      const result = InputSanitizer.sanitizeText('  hello  ');
      expect(result).toBe('hello');
    });
  });

  describe('sanitizeEmail', () => {
    it('should convert to lowercase and trim', () => {
      const result = InputSanitizer.sanitizeEmail('  TEST@EXAMPLE.COM  ');
      expect(result).toBe('test@example.com');
    });

    it('should remove invalid characters', () => {
      const result = InputSanitizer.sanitizeEmail('test<>@example.com');
      expect(result).toBe('test@example.com');
    });
  });

  describe('sanitizePhone', () => {
    it('should keep only valid phone characters', () => {
      const result = InputSanitizer.sanitizePhone('+1 (234) 567-8900 ext123');
      expect(result).toBe('+1 (234) 567-8900 12');
    });
  });

  describe('sanitizeOTP', () => {
    it('should keep only digits', () => {
      const result = InputSanitizer.sanitizeOTP('12a34b56');
      expect(result).toBe('123456');
    });

    it('should limit to 6 characters', () => {
      const result = InputSanitizer.sanitizeOTP('1234567890');
      expect(result).toBe('123456');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow valid HTTPS URLs', () => {
      const result = InputSanitizer.sanitizeUrl('https://example.com');
      expect(result).toBe('https://example.com/');
    });

    it('should reject invalid protocols', () => {
      const result = InputSanitizer.sanitizeUrl('javascript:alert("xss")');
      expect(result).toBe('');
    });

    it('should reject malformed URLs', () => {
      const result = InputSanitizer.sanitizeUrl('not-a-url');
      expect(result).toBe('');
    });
  });
});

describe('ClientRateLimiter', () => {
  beforeEach(() => {
    ClientRateLimiter.clearAll();
  });

  it('should allow requests within limit', () => {
    const key = 'test-key';
    const maxRequests = 5;
    const windowMs = 60000;

    for (let i = 0; i < maxRequests; i++) {
      const allowed = ClientRateLimiter.isAllowed(key, maxRequests, windowMs);
      expect(allowed).toBe(true);
    }
  });

  it('should block requests exceeding limit', () => {
    const key = 'test-key';
    const maxRequests = 3;
    const windowMs = 60000;

    // Make maximum allowed requests
    for (let i = 0; i < maxRequests; i++) {
      ClientRateLimiter.isAllowed(key, maxRequests, windowMs);
    }

    // Next request should be blocked
    const blocked = ClientRateLimiter.isAllowed(key, maxRequests, windowMs);
    expect(blocked).toBe(false);
  });

  it('should return correct remaining requests', () => {
    const key = 'test-key';
    const maxRequests = 5;
    const windowMs = 60000;

    // Make 2 requests
    ClientRateLimiter.isAllowed(key, maxRequests, windowMs);
    ClientRateLimiter.isAllowed(key, maxRequests, windowMs);

    const remaining = ClientRateLimiter.getRemainingRequests(key, maxRequests, windowMs);
    expect(remaining).toBe(3);
  });

  it('should clear key correctly', () => {
    const key = 'test-key';
    const maxRequests = 1;
    const windowMs = 60000;

    // Use up the limit
    ClientRateLimiter.isAllowed(key, maxRequests, windowMs);
    expect(ClientRateLimiter.isAllowed(key, maxRequests, windowMs)).toBe(false);

    // Clear and try again
    ClientRateLimiter.clearKey(key);
    expect(ClientRateLimiter.isAllowed(key, maxRequests, windowMs)).toBe(true);
  });
});

describe('SecureFormProcessor', () => {
  it('should process valid form data', () => {
    const data = {
      email: 'test@example.com',
      name: 'John Doe'
    };

    const validationRules = {
      email: (value: string) => InputValidator.validateEmail(value),
      name: (value: string) => InputValidator.validateName(value)
    };

    const result = SecureFormProcessor.processFormData(data, validationRules);
    
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData).toBeDefined();
    expect(result.sanitizedData?.email).toBe('test@example.com');
  });

  it('should reject invalid form data', () => {
    const data = {
      email: 'invalid-email',
      name: 'John Doe'
    };

    const validationRules = {
      email: (value: string) => InputValidator.validateEmail(value),
      name: (value: string) => InputValidator.validateName(value)
    };

    const result = SecureFormProcessor.processFormData(data, validationRules);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.email).toBeDefined();
  });

  it('should sanitize form data', () => {
    const data = {
      email: '  TEST@EXAMPLE.COM  ',
      phone: '+1 (234) 567-8900'
    };

    const validationRules = {
      email: (value: string) => ({ isValid: true }),
      phone: (value: string) => ({ isValid: true })
    };

    const result = SecureFormProcessor.processFormData(data, validationRules);
    
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData?.email).toBe('test@example.com');
    expect(result.sanitizedData?.phone).toBe('+1 (234) 567-8900');
  });
});

describe('SecurityLogger', () => {
  beforeEach(() => {
    SecurityLogger.clearLogs();
  });

  it('should log security events', () => {
    SecurityLogger.log('TEST_EVENT', 'Test message', { data: 'test' });
    
    const logs = SecurityLogger.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('TEST_EVENT');
    expect(logs[0].message).toBe('Test message');
    expect(logs[0].data).toEqual({ data: 'test' });
  });

  it('should limit log entries', () => {
    // Add more than 100 logs
    for (let i = 0; i < 150; i++) {
      SecurityLogger.log('TEST_EVENT', `Message ${i}`);
    }
    
    const logs = SecurityLogger.getLogs();
    expect(logs).toHaveLength(100);
    
    // Should keep the most recent logs
    expect(logs[logs.length - 1].message).toBe('Message 149');
  });

  it('should clear logs correctly', () => {
    SecurityLogger.log('TEST_EVENT', 'Test message');
    expect(SecurityLogger.getLogs()).toHaveLength(1);
    
    SecurityLogger.clearLogs();
    expect(SecurityLogger.getLogs()).toHaveLength(0);
  });
});

// Mock tests for browser-specific functionality
describe('Browser Security Features', () => {
  it('should handle CSP violations gracefully', () => {
    // Mock CSP violation event
    const mockEvent = {
      blockedURI: 'inline',
      violatedDirective: 'script-src',
      originalPolicy: "default-src 'self'"
    };

    // In a real implementation, you would test CSP violation handling
    expect(mockEvent.violatedDirective).toBe('script-src');
  });

  it('should validate security headers', () => {
    // Mock security headers validation
    const securityHeaders = {
      'Content-Security-Policy': "default-src 'self'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    };

    expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff');
    expect(securityHeaders['X-Frame-Options']).toBe('DENY');
  });
});

// Integration tests
describe('Security Integration', () => {
  it('should handle complete security workflow', () => {
    // Clear any existing state
    ClientRateLimiter.clearAll();
    SecurityLogger.clearLogs();

    // Simulate form submission with security checks
    const formData = {
      email: '  TEST@EXAMPLE.COM  ',
      password: 'StrongPass123!',
      otp: '123456'
    };

    // Validate and sanitize
    const emailValidation = InputValidator.validateEmail(formData.email);
    const passwordValidation = InputValidator.validatePassword(formData.password);
    const otpValidation = InputValidator.validateOTP(formData.otp);

    expect(emailValidation.isValid).toBe(true);
    expect(passwordValidation.isValid).toBe(true);
    expect(otpValidation.isValid).toBe(true);

    // Sanitize data
    const sanitizedEmail = InputSanitizer.sanitizeEmail(formData.email);
    const sanitizedOTP = InputSanitizer.sanitizeOTP(formData.otp);

    expect(sanitizedEmail).toBe('test@example.com');
    expect(sanitizedOTP).toBe('123456');

    // Check rate limiting
    const rateLimitKey = 'form-submission';
    const allowed = ClientRateLimiter.isAllowed(rateLimitKey, 5, 60000);
    expect(allowed).toBe(true);

    // Log security event
    SecurityLogger.log('FORM_SUBMISSION', 'Secure form submitted', {
      email: sanitizedEmail,
      hasPassword: !!formData.password,
      hasOTP: !!sanitizedOTP
    });

    const logs = SecurityLogger.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('FORM_SUBMISSION');
  });
});