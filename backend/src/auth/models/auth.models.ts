/**
 * Authentication Data Models
 * 
 * This file contains the core data models for the authentication system rebuild.
 * These models support multi-step signup flows, phone/email verification, and Auth0 integration.
 */

export interface User {
  id: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  auth0Id?: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

export interface PhoneVerification {
  id: string;
  phone: string;
  otpCode: string;
  expiresAt: Date;
  verifiedAt?: Date;
  attempts: number;
  createdAt: Date;
}

export interface EmailVerification {
  id: string;
  email: string;
  verificationCode: string;
  expiresAt: Date;
  verifiedAt?: Date;
  createdAt: Date;
}

export interface Auth0Profile {
  id: string;
  userId: string;
  auth0Id: string;
  profileData: Record<string, any>;
  createdAt: Date;
}

export interface UserSession {
  id: string;
  userId: string;
  jwtToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
}

// Input DTOs for creating new records
export interface CreateUserInput {
  email: string;
  phone?: string;
  passwordHash?: string;
  auth0Id?: string;
}

export interface CreatePhoneVerificationInput {
  phone: string;
  otpCode: string;
  expiresAt: Date;
}

export interface CreateEmailVerificationInput {
  email: string;
  verificationCode: string;
  expiresAt: Date;
}

export interface CreateAuth0ProfileInput {
  userId: string;
  auth0Id: string;
  profileData: Record<string, any>;
}

export interface CreateUserSessionInput {
  userId: string;
  jwtToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// Update DTOs
export interface UpdateUserInput {
  email?: string;
  phone?: string;
  passwordHash?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  lastLogin?: Date;
}

export interface UpdatePhoneVerificationInput {
  verifiedAt?: Date;
  attempts?: number;
}

export interface UpdateEmailVerificationInput {
  verifiedAt?: Date;
}

// Database constraint error types
export enum DatabaseConstraintError {
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',
  DUPLICATE_PHONE = 'DUPLICATE_PHONE',
  DUPLICATE_AUTH0_ID = 'DUPLICATE_AUTH0_ID',
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',
  NOT_NULL_VIOLATION = 'NOT_NULL_VIOLATION'
}

export class AuthDatabaseError extends Error {
  constructor(
    public constraintType: DatabaseConstraintError,
    public field: string,
    public value: string,
    message: string
  ) {
    super(message);
    this.name = 'AuthDatabaseError';
  }
}

// Validation helpers
export class UserValidator {
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhone(phone: string): boolean {
    // Basic phone validation - can be enhanced based on requirements
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  static validatePassword(password: string): boolean {
    // Minimum 8 characters, at least one letter and one number
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(password);
  }

  static validateOTP(otp: string): boolean {
    // 6-digit OTP
    const otpRegex = /^\d{6}$/;
    return otpRegex.test(otp);
  }

  static validateVerificationCode(code: string): boolean {
    // 8-character alphanumeric verification code
    const codeRegex = /^[A-Za-z0-9]{8}$/;
    return codeRegex.test(code);
  }
}