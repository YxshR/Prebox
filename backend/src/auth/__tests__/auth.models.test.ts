/**
 * Unit tests for authentication data models
 */

import {
  UserValidator,
  DatabaseConstraintError,
  AuthDatabaseError
} from '../models/auth.models';

describe('UserValidator', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(UserValidator.validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..name@example.com',
        'user@.com',
        ''
      ];

      invalidEmails.forEach(email => {
        expect(UserValidator.validateEmail(email)).toBe(false);
      });
    });
  });

  describe('validatePhone', () => {
    it('should validate correct phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '1234567890',
        '+1 (234) 567-8900',
        '+44 20 7946 0958',
        '020 7946 0958'
      ];

      validPhones.forEach(phone => {
        expect(UserValidator.validatePhone(phone)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '123',
        'abc123',
        '+',
        ''
      ];

      invalidPhones.forEach(phone => {
        expect(UserValidator.validatePhone(phone)).toBe(false);
      });
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const validPasswords = [
        'Password123',
        'MySecure1',
        'Test@123',
        'Complex#Pass1'
      ];

      validPasswords.forEach(password => {
        expect(UserValidator.validatePassword(password)).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const invalidPasswords = [
        'password', // no number
        '12345678', // no letter
        'Pass1', // too short
        'PASSWORD123', // no lowercase
        'password123', // no uppercase
        ''
      ];

      invalidPasswords.forEach(password => {
        expect(UserValidator.validatePassword(password)).toBe(false);
      });
    });
  });

  describe('validateOTP', () => {
    it('should validate correct OTP codes', () => {
      const validOTPs = [
        '123456',
        '000000',
        '999999'
      ];

      validOTPs.forEach(otp => {
        expect(UserValidator.validateOTP(otp)).toBe(true);
      });
    });

    it('should reject invalid OTP codes', () => {
      const invalidOTPs = [
        '12345', // too short
        '1234567', // too long
        'abc123', // contains letters
        '12-345', // contains special chars
        ''
      ];

      invalidOTPs.forEach(otp => {
        expect(UserValidator.validateOTP(otp)).toBe(false);
      });
    });
  });

  describe('validateVerificationCode', () => {
    it('should validate correct verification codes', () => {
      const validCodes = [
        'ABC12345',
        'abcd1234',
        '12345678',
        'MixedC0d'
      ];

      validCodes.forEach(code => {
        expect(UserValidator.validateVerificationCode(code)).toBe(true);
      });
    });

    it('should reject invalid verification codes', () => {
      const invalidCodes = [
        'ABC123', // too short
        'ABC123456', // too long
        'ABC-1234', // contains special chars
        'ABC 1234', // contains space
        ''
      ];

      invalidCodes.forEach(code => {
        expect(UserValidator.validateVerificationCode(code)).toBe(false);
      });
    });
  });
});

describe('AuthDatabaseError', () => {
  it('should create error with correct properties', () => {
    const error = new AuthDatabaseError(
      DatabaseConstraintError.DUPLICATE_EMAIL,
      'email',
      'test@example.com',
      'Email already exists'
    );

    expect(error.name).toBe('AuthDatabaseError');
    expect(error.constraintType).toBe(DatabaseConstraintError.DUPLICATE_EMAIL);
    expect(error.field).toBe('email');
    expect(error.value).toBe('test@example.com');
    expect(error.message).toBe('Email already exists');
  });

  it('should be instance of Error', () => {
    const error = new AuthDatabaseError(
      DatabaseConstraintError.DUPLICATE_PHONE,
      'phone',
      '+1234567890',
      'Phone already exists'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AuthDatabaseError);
  });
});

describe('DatabaseConstraintError enum', () => {
  it('should have all expected constraint types', () => {
    expect(DatabaseConstraintError.DUPLICATE_EMAIL).toBe('DUPLICATE_EMAIL');
    expect(DatabaseConstraintError.DUPLICATE_PHONE).toBe('DUPLICATE_PHONE');
    expect(DatabaseConstraintError.DUPLICATE_AUTH0_ID).toBe('DUPLICATE_AUTH0_ID');
    expect(DatabaseConstraintError.FOREIGN_KEY_VIOLATION).toBe('FOREIGN_KEY_VIOLATION');
    expect(DatabaseConstraintError.NOT_NULL_VIOLATION).toBe('NOT_NULL_VIOLATION');
  });
});