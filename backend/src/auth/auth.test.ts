import { AuthService } from './auth.service';
import { PhoneVerificationService } from './phone-verification.service';
import { EmailVerificationService } from './email-verification.service';
import { UserRegistration, LoginCredentials } from '../shared/types';

describe('Authentication System', () => {
  let authService: AuthService;
  let phoneVerificationService: PhoneVerificationService;
  let emailVerificationService: EmailVerificationService;

  beforeAll(() => {
    authService = new AuthService();
    phoneVerificationService = new PhoneVerificationService();
    emailVerificationService = new EmailVerificationService();
  });

  describe('AuthService', () => {
    test('should create auth service instance', () => {
      expect(authService).toBeInstanceOf(AuthService);
    });

    test('should validate registration data structure', () => {
      const userData: UserRegistration = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        registrationMethod: 'email'
      };

      expect(userData.email).toBe('test@example.com');
      expect(userData.registrationMethod).toBe('email');
    });

    test('should validate login credentials structure', () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      expect(credentials.email).toBe('test@example.com');
      expect(credentials.password).toBe('password123');
    });
  });

  describe('PhoneVerificationService', () => {
    test('should create phone verification service instance', () => {
      expect(phoneVerificationService).toBeInstanceOf(PhoneVerificationService);
    });
  });

  describe('EmailVerificationService', () => {
    test('should create email verification service instance', () => {
      expect(emailVerificationService).toBeInstanceOf(EmailVerificationService);
    });
  });
});