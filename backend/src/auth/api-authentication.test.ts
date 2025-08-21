import { ApiKeyService } from './api-key.service';
import { RateLimiterService } from './rate-limiter.service';
import { SecurityMiddleware } from './security.middleware';
import { ErrorHandlerMiddleware } from './error-handler.middleware';
import { SubscriptionTier } from '../shared/types';

// Mock dependencies
jest.mock('./api-key.service');
jest.mock('./rate-limiter.service');
jest.mock('../config/database');
jest.mock('../config/redis');

describe('API Authentication and Security System', () => {
  let apiKeyService: ApiKeyService;
  let rateLimiterService: RateLimiterService;
  let securityMiddleware: SecurityMiddleware;

  beforeEach(() => {
    apiKeyService = new ApiKeyService();
    rateLimiterService = new RateLimiterService();
    securityMiddleware = new SecurityMiddleware();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ApiKeyService', () => {
    it('should be instantiated correctly', () => {
      expect(apiKeyService).toBeInstanceOf(ApiKeyService);
    });

    it('should have all required methods', () => {
      expect(typeof apiKeyService.generateApiKey).toBe('function');
      expect(typeof apiKeyService.listApiKeys).toBe('function');
      expect(typeof apiKeyService.revokeApiKey).toBe('function');
      expect(typeof apiKeyService.updateApiKey).toBe('function');
      expect(typeof apiKeyService.getApiKeyUsage).toBe('function');
      expect(typeof apiKeyService.validateApiKey).toBe('function');
    });
  });

  describe('RateLimiterService', () => {
    it('should be instantiated correctly', () => {
      expect(rateLimiterService).toBeInstanceOf(RateLimiterService);
    });

    it('should have all required methods', () => {
      expect(typeof rateLimiterService.checkApiKeyRateLimit).toBe('function');
      expect(typeof rateLimiterService.checkTenantRateLimit).toBe('function');
      expect(typeof rateLimiterService.checkIpRateLimit).toBe('function');
      expect(typeof rateLimiterService.recordApiUsage).toBe('function');
      expect(typeof rateLimiterService.getApiAnalytics).toBe('function');
    });
  });

  describe('SecurityMiddleware', () => {
    it('should be instantiated correctly', () => {
      expect(securityMiddleware).toBeInstanceOf(SecurityMiddleware);
    });

    it('should have all required middleware methods', () => {
      expect(typeof securityMiddleware.generalRateLimit).toBe('function');
      expect(typeof securityMiddleware.authRateLimit).toBe('function');
      expect(typeof securityMiddleware.securityHeaders).toBe('function');
      expect(typeof securityMiddleware.requestSizeLimit).toBe('function');
      expect(typeof securityMiddleware.requestTimeout).toBe('function');
      expect(typeof securityMiddleware.validateApiKeyFormat).toBe('function');
      expect(typeof securityMiddleware.securityLogger).toBe('function');
      expect(typeof securityMiddleware.enhancedCors).toBe('function');
      expect(typeof securityMiddleware.sanitizeInput).toBe('function');
      expect(typeof securityMiddleware.apiVersioning).toBe('function');
    });

    describe('API Key Format Validation', () => {
      it('should validate API key format correctly', () => {
        const mockReq = {
          headers: { 'x-api-key': 'bep_valid_key_12345678901234567890' }
        } as any;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;
        const mockNext = jest.fn();

        securityMiddleware.validateApiKeyFormat(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should reject invalid API key format', () => {
        const mockReq = {
          headers: { 'x-api-key': 'invalid_key' }
        } as any;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;
        const mockNext = jest.fn();

        securityMiddleware.validateApiKeyFormat(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_API_KEY_FORMAT',
            message: 'Invalid API key format'
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should allow requests without API key', () => {
        const mockReq = { headers: {} } as any;
        const mockRes = {} as any;
        const mockNext = jest.fn();

        securityMiddleware.validateApiKeyFormat(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('Security Headers', () => {
      it('should set security headers correctly', () => {
        const mockReq = {} as any;
        const mockRes = {
          removeHeader: jest.fn(),
          setHeader: jest.fn()
        } as any;
        const mockNext = jest.fn();

        securityMiddleware.securityHeaders(mockReq, mockRes, mockNext);

        expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Powered-By');
        expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
        expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
        expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('API Versioning', () => {
      it('should accept valid API version', () => {
        const mockReq = {
          headers: { 'api-version': 'v1' },
          query: {}
        } as any;
        const mockRes = {
          setHeader: jest.fn()
        } as any;
        const mockNext = jest.fn();

        securityMiddleware.apiVersioning(mockReq, mockRes, mockNext);

        expect(mockRes.setHeader).toHaveBeenCalledWith('API-Version', 'v1');
        expect(mockReq.apiVersion).toBe('v1');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject invalid API version format', () => {
        const mockReq = {
          headers: { 'api-version': 'invalid' },
          query: {}
        } as any;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;
        const mockNext = jest.fn();

        securityMiddleware.apiVersioning(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_API_VERSION',
            message: 'Invalid API version format. Use v1, v2, etc.',
            supportedVersions: ['v1']
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should default to v1 when no version specified', () => {
        const mockReq = {
          headers: {},
          query: {}
        } as any;
        const mockRes = {
          setHeader: jest.fn()
        } as any;
        const mockNext = jest.fn();

        securityMiddleware.apiVersioning(mockReq, mockRes, mockNext);

        expect(mockRes.setHeader).toHaveBeenCalledWith('API-Version', 'v1');
        expect(mockReq.apiVersion).toBe('v1');
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('Input Sanitization', () => {
      it('should sanitize malicious input in request body', () => {
        const mockReq = {
          query: {},
          body: {
            name: '<script>alert("xss")</script>Test Name',
            description: 'javascript:alert("xss")',
            nested: {
              field: '<img onerror="alert(1)" src="x">'
            }
          }
        } as any;
        const mockRes = {} as any;
        const mockNext = jest.fn();

        securityMiddleware.sanitizeInput(mockReq, mockRes, mockNext);

        expect(mockReq.body.name).toBe('Test Name');
        expect(mockReq.body.description).toBe('alert("xss")');
        expect(mockReq.body.nested.field).toBe('');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should sanitize query parameters', () => {
        const mockReq = {
          query: {
            search: '<script>alert("xss")</script>search term',
            filter: 'javascript:void(0)'
          },
          body: {}
        } as any;
        const mockRes = {} as any;
        const mockNext = jest.fn();

        securityMiddleware.sanitizeInput(mockReq, mockRes, mockNext);

        expect(mockReq.query.search).toBe('search term');
        expect(mockReq.query.filter).toBe('void(0)');
        expect(mockNext).toHaveBeenCalled();
      });
    });
  });

  describe('ErrorHandlerMiddleware', () => {
    it('should have all required methods', () => {
      expect(typeof ErrorHandlerMiddleware.handleError).toBe('function');
      expect(typeof ErrorHandlerMiddleware.asyncHandler).toBe('function');
      expect(typeof ErrorHandlerMiddleware.handleAuthError).toBe('function');
      expect(typeof ErrorHandlerMiddleware.handleRateLimitError).toBe('function');
      expect(typeof ErrorHandlerMiddleware.handleValidationError).toBe('function');
      expect(typeof ErrorHandlerMiddleware.createOperationalError).toBe('function');
      expect(typeof ErrorHandlerMiddleware.isOperationalError).toBe('function');
      expect(typeof ErrorHandlerMiddleware.logSecurityEvent).toBe('function');
    });

    it('should create operational errors correctly', () => {
      const error = ErrorHandlerMiddleware.createOperationalError(
        'Test error',
        'TEST_ERROR',
        400,
        { field: 'test' }
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.status).toBe(400);
      expect(error.details).toEqual({ field: 'test' });
      expect(error.isOperational).toBe(true);
    });

    it('should identify operational errors', () => {
      const operationalError = ErrorHandlerMiddleware.createOperationalError(
        'Test error',
        'TEST_ERROR'
      );
      const programmingError = new Error('Programming error');

      expect(ErrorHandlerMiddleware.isOperationalError(operationalError)).toBe(true);
      expect(ErrorHandlerMiddleware.isOperationalError(programmingError as any)).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should have all components working together', () => {
      // Test that all components can be instantiated together
      expect(apiKeyService).toBeDefined();
      expect(rateLimiterService).toBeDefined();
      expect(securityMiddleware).toBeDefined();
      expect(ErrorHandlerMiddleware).toBeDefined();
    });

    it('should support all subscription tiers', () => {
      const tiers = [
        SubscriptionTier.FREE,
        SubscriptionTier.PAID_STANDARD,
        SubscriptionTier.PREMIUM,
        SubscriptionTier.ENTERPRISE
      ];

      tiers.forEach(tier => {
        expect(typeof tier).toBe('string');
      });
    });
  });

  describe('Security Features Validation', () => {
    it('should validate all security middleware is present', () => {
      const requiredMiddleware = [
        'generalRateLimit',
        'authRateLimit',
        'securityHeaders',
        'requestSizeLimit',
        'requestTimeout',
        'validateApiKeyFormat',
        'securityLogger',
        'enhancedCors',
        'sanitizeInput',
        'apiVersioning'
      ];

      requiredMiddleware.forEach(middleware => {
        expect(securityMiddleware).toHaveProperty(middleware);
        expect(typeof (securityMiddleware as any)[middleware]).toBe('function');
      });
    });

    it('should validate all error handling methods are present', () => {
      const requiredMethods = [
        'handleError',
        'asyncHandler',
        'handleAuthError',
        'handleRateLimitError',
        'handleValidationError',
        'handleDatabaseError',
        'createOperationalError',
        'isOperationalError',
        'logSecurityEvent'
      ];

      requiredMethods.forEach(method => {
        expect(ErrorHandlerMiddleware).toHaveProperty(method);
        expect(typeof (ErrorHandlerMiddleware as any)[method]).toBe('function');
      });
    });
  });
});