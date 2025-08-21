/**
 * Comprehensive tests for security middleware and client-side protections
 * Requirements: 8.1, 8.2, 8.4, 8.5
 */

import { 
  SecurityMiddleware,
  CSPViolationHandler,
  RateLimitManager,
  InputSanitizer,
  SecurityLogger,
  ErrorBoundaryHandler
} from '../securityMiddleware';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock console methods
const mockConsole = {
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};
global.console = { ...console, ...mockConsole };

describe('SecurityMiddleware', () => {
  let securityMiddleware: SecurityMiddleware;

  beforeEach(() => {
    securityMiddleware = new SecurityMiddleware({
      enableCSP: true,
      enableRateLimit: true,
      enableInputSanitization: true,
      enableSecurityLogging: true,
      rateLimitConfig: {
        maxRequests: 100,
        windowMs: 60000,
        skipSuccessfulRequests: false
      }
    });

    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  describe('Request Interception', () => {
    it('should intercept and validate API requests', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const request = new Request('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' })
      });

      const response = await securityMiddleware.interceptRequest(request);

      expect(response).toBeDefined();
      expect(fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/test'
        })
      );
    });

    it('should add security headers to requests', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const request = new Request('/api/secure', {
        method: 'GET'
      });

      await securityMiddleware.interceptRequest(request);

      expect(fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Requested-With': 'XMLHttpRequest',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'
          })
        })
      );
    });

    it('should sanitize request payloads', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const maliciousPayload = {
        name: '<script>alert("xss")</script>John',
        email: 'test@example.com<img src=x onerror=alert("xss")>',
        message: 'Hello\n<iframe src="javascript:alert(1)"></iframe>'
      };

      const request = new Request('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maliciousPayload)
      });

      await securityMiddleware.interceptRequest(request);

      const sanitizedCall = (fetch as jest.Mock).mock.calls[0][0];
      const sanitizedBody = JSON.parse(sanitizedCall.body);

      expect(sanitizedBody.name).toBe('alert("xss")John');
      expect(sanitizedBody.email).toBe('test@example.com');
      expect(sanitizedBody.message).toBe('Hello\n');
    });

    it('should enforce rate limiting', async () => {
      const rateLimitManager = new RateLimitManager({
        maxRequests: 2,
        windowMs: 1000
      });

      // Make requests up to the limit
      expect(rateLimitManager.isAllowed('test-key')).toBe(true);
      expect(rateLimitManager.isAllowed('test-key')).toBe(true);
      
      // Next request should be blocked
      expect(rateLimitManager.isAllowed('test-key')).toBe(false);
    });

    it('should handle CORS preflight requests', async () => {
      const preflightRequest = new Request('/api/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      const response = await securityMiddleware.interceptRequest(preflightRequest);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://perbox.io');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });
  });

  describe('Content Security Policy', () => {
    let cspHandler: CSPViolationHandler;

    beforeEach(() => {
      cspHandler = new CSPViolationHandler();
    });

    it('should handle CSP violations', () => {
      const violationEvent = {
        blockedURI: 'inline',
        violatedDirective: 'script-src',
        originalPolicy: "default-src 'self'; script-src 'self'",
        sourceFile: 'https://example.com/page.html',
        lineNumber: 42,
        columnNumber: 15
      };

      cspHandler.handleViolation(violationEvent);

      expect(mockConsole.warn).toHaveBeenCalledWith(
        'CSP Violation:',
        expect.objectContaining({
          directive: 'script-src',
          blockedURI: 'inline'
        })
      );
    });

    it('should report CSP violations to server', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const violationEvent = {
        blockedURI: 'https://malicious.com/script.js',
        violatedDirective: 'script-src',
        originalPolicy: "default-src 'self'",
        sourceFile: 'https://perbox.io/page.html',
        lineNumber: 1,
        columnNumber: 1
      };

      await cspHandler.reportViolation(violationEvent);

      expect(fetch).toHaveBeenCalledWith('/api/security/csp-violation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          violation: violationEvent,
          timestamp: expect.any(String),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      });
    });

    it('should detect inline script injection attempts', () => {
      const suspiciousEvents = [
        {
          blockedURI: 'inline',
          violatedDirective: 'script-src',
          originalPolicy: "script-src 'self'",
          sourceFile: 'https://perbox.io/page.html',
          lineNumber: 1,
          columnNumber: 1
        },
        {
          blockedURI: 'eval',
          violatedDirective: 'script-src',
          originalPolicy: "script-src 'self'",
          sourceFile: 'https://perbox.io/page.html',
          lineNumber: 1,
          columnNumber: 1
        }
      ];

      suspiciousEvents.forEach(event => {
        cspHandler.handleViolation(event);
      });

      expect(mockConsole.warn).toHaveBeenCalledTimes(2);
    });

    it('should validate CSP policy configuration', () => {
      const validPolicies = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'"
      ];

      const invalidPolicies = [
        "script-src *", // Too permissive
        "default-src 'unsafe-eval'", // Dangerous
        "" // Empty policy
      ];

      validPolicies.forEach(policy => {
        expect(cspHandler.validatePolicy(policy)).toBe(true);
      });

      invalidPolicies.forEach(policy => {
        expect(cspHandler.validatePolicy(policy)).toBe(false);
      });
    });
  });

  describe('Input Sanitization', () => {
    let inputSanitizer: InputSanitizer;

    beforeEach(() => {
      inputSanitizer = new InputSanitizer();
    });

    it('should sanitize HTML content', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="javascript:alert(1)"></object>',
        '<embed src="javascript:alert(1)">',
        '<link rel="stylesheet" href="javascript:alert(1)">',
        '<style>@import "javascript:alert(1)";</style>'
      ];

      maliciousInputs.forEach(input => {
        const sanitized = inputSanitizer.sanitizeHTML(input);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized).not.toContain('<object');
        expect(sanitized).not.toContain('<embed');
        expect(sanitized).not.toContain('<link');
        expect(sanitized).not.toContain('@import');
      });
    });

    it('should sanitize URLs', () => {
      const maliciousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
        'ftp://malicious.com/file.exe'
      ];

      const safeUrls = [
        'https://example.com',
        'http://localhost:3000',
        '/relative/path',
        'mailto:test@example.com',
        'tel:+1234567890'
      ];

      maliciousUrls.forEach(url => {
        const sanitized = inputSanitizer.sanitizeURL(url);
        expect(sanitized).toBe('');
      });

      safeUrls.forEach(url => {
        const sanitized = inputSanitizer.sanitizeURL(url);
        expect(sanitized).toBe(url);
      });
    });

    it('should sanitize form data', () => {
      const formData = {
        name: '<script>alert("xss")</script>John Doe',
        email: 'test@example.com<img src=x onerror=alert("xss")>',
        phone: '+1 (555) 123-4567<script>',
        message: 'Hello\n<iframe src="javascript:alert(1)"></iframe>World',
        website: 'javascript:alert(1)'
      };

      const sanitized = inputSanitizer.sanitizeFormData(formData);

      expect(sanitized.name).toBe('alert("xss")John Doe');
      expect(sanitized.email).toBe('test@example.com');
      expect(sanitized.phone).toBe('+1 (555) 123-4567');
      expect(sanitized.message).toBe('Hello\nWorld');
      expect(sanitized.website).toBe('');
    });

    it('should preserve safe HTML when allowed', () => {
      const safeHTML = '<p>This is <strong>safe</strong> content with <em>emphasis</em>.</p>';
      const allowedTags = ['p', 'strong', 'em'];

      const sanitized = inputSanitizer.sanitizeHTML(safeHTML, { allowedTags });

      expect(sanitized).toBe(safeHTML);
    });

    it('should handle nested malicious content', () => {
      const nestedMalicious = '<div><script>alert("xss")</script><p>Safe content</p></div>';
      const sanitized = inputSanitizer.sanitizeHTML(nestedMalicious);

      expect(sanitized).toContain('<p>Safe content</p>');
      expect(sanitized).not.toContain('<script>');
    });
  });

  describe('Error Boundary Handling', () => {
    let errorHandler: ErrorBoundaryHandler;

    beforeEach(() => {
      errorHandler = new ErrorBoundaryHandler();
    });

    it('should handle component errors gracefully', () => {
      const error = new Error('Component crashed');
      const errorInfo = {
        componentStack: 'at Component (Component.tsx:10:5)'
      };

      const result = errorHandler.handleError(error, errorInfo);

      expect(result.hasError).toBe(true);
      expect(result.errorMessage).toBe('Something went wrong');
      expect(result.fallbackComponent).toBeDefined();
    });

    it('should log errors securely', () => {
      const error = new Error('Sensitive error with API key: sk_12345');
      const errorInfo = {
        componentStack: 'at Component (Component.tsx:10:5)'
      };

      errorHandler.handleError(error, errorInfo);

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Component Error:',
        expect.objectContaining({
          message: expect.not.stringContaining('sk_12345')
        })
      );
    });

    it('should provide different fallbacks for different error types', () => {
      const networkError = new Error('Network request failed');
      const syntaxError = new SyntaxError('Unexpected token');
      const referenceError = new ReferenceError('Variable not defined');

      const networkResult = errorHandler.handleError(networkError, {});
      const syntaxResult = errorHandler.handleError(syntaxError, {});
      const referenceResult = errorHandler.handleError(referenceError, {});

      expect(networkResult.fallbackComponent).toContain('network');
      expect(syntaxResult.fallbackComponent).toContain('syntax');
      expect(referenceResult.fallbackComponent).toContain('reference');
    });

    it('should track error frequency', () => {
      const error = new Error('Recurring error');
      const errorInfo = { componentStack: 'at Component' };

      // Trigger same error multiple times
      for (let i = 0; i < 5; i++) {
        errorHandler.handleError(error, errorInfo);
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(5);
      expect(stats.uniqueErrors).toBe(1);
      expect(stats.mostFrequentError).toBe('Recurring error');
    });
  });

  describe('Security Logging', () => {
    let securityLogger: SecurityLogger;

    beforeEach(() => {
      securityLogger = new SecurityLogger();
    });

    it('should log security events', () => {
      const event = {
        type: 'XSS_ATTEMPT',
        severity: 'HIGH',
        details: {
          input: '<script>alert("xss")</script>',
          sanitized: 'alert("xss")',
          source: 'contact-form'
        }
      };

      securityLogger.logEvent(event);

      const logs = securityLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        type: 'XSS_ATTEMPT',
        severity: 'HIGH',
        timestamp: expect.any(String)
      });
    });

    it('should filter sensitive information from logs', () => {
      const event = {
        type: 'AUTH_FAILURE',
        severity: 'MEDIUM',
        details: {
          username: 'user@example.com',
          password: 'secret123',
          token: 'jwt.token.here',
          apiKey: 'sk_live_12345'
        }
      };

      securityLogger.logEvent(event);

      const logs = securityLogger.getLogs();
      const loggedEvent = logs[0];

      expect(loggedEvent.details.password).toBe('[REDACTED]');
      expect(loggedEvent.details.token).toBe('[REDACTED]');
      expect(loggedEvent.details.apiKey).toBe('[REDACTED]');
      expect(loggedEvent.details.username).toBe('user@example.com'); // Should be preserved
    });

    it('should batch log submissions', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      // Generate multiple log events
      for (let i = 0; i < 10; i++) {
        securityLogger.logEvent({
          type: 'TEST_EVENT',
          severity: 'LOW',
          details: { index: i }
        });
      }

      await securityLogger.flush();

      expect(fetch).toHaveBeenCalledWith('/api/security/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"type":"TEST_EVENT"')
      });
    });

    it('should handle log submission failures', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      securityLogger.logEvent({
        type: 'TEST_EVENT',
        severity: 'LOW',
        details: {}
      });

      await securityLogger.flush();

      // Should not throw error, but log locally
      expect(mockConsole.warn).toHaveBeenCalledWith(
        'Failed to submit security logs:',
        expect.any(Error)
      );
    });

    it('should respect log level configuration', () => {
      const logger = new SecurityLogger({ minLevel: 'HIGH' });

      logger.logEvent({ type: 'LOW_EVENT', severity: 'LOW', details: {} });
      logger.logEvent({ type: 'MEDIUM_EVENT', severity: 'MEDIUM', details: {} });
      logger.logEvent({ type: 'HIGH_EVENT', severity: 'HIGH', details: {} });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('HIGH_EVENT');
    });
  });

  describe('Rate Limiting', () => {
    let rateLimitManager: RateLimitManager;

    beforeEach(() => {
      rateLimitManager = new RateLimitManager({
        maxRequests: 5,
        windowMs: 1000
      });
    });

    it('should enforce request limits', () => {
      const key = 'test-endpoint';

      // Make requests up to the limit
      for (let i = 0; i < 5; i++) {
        expect(rateLimitManager.isAllowed(key)).toBe(true);
      }

      // Next request should be blocked
      expect(rateLimitManager.isAllowed(key)).toBe(false);
    });

    it('should reset limits after time window', async () => {
      const key = 'test-endpoint';

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        rateLimitManager.isAllowed(key);
      }

      expect(rateLimitManager.isAllowed(key)).toBe(false);

      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(rateLimitManager.isAllowed(key)).toBe(true);
    });

    it('should handle different keys independently', () => {
      const key1 = 'endpoint-1';
      const key2 = 'endpoint-2';

      // Exhaust limit for key1
      for (let i = 0; i < 5; i++) {
        rateLimitManager.isAllowed(key1);
      }

      expect(rateLimitManager.isAllowed(key1)).toBe(false);
      expect(rateLimitManager.isAllowed(key2)).toBe(true);
    });

    it('should provide remaining request count', () => {
      const key = 'test-endpoint';

      expect(rateLimitManager.getRemainingRequests(key)).toBe(5);

      rateLimitManager.isAllowed(key);
      expect(rateLimitManager.getRemainingRequests(key)).toBe(4);

      rateLimitManager.isAllowed(key);
      expect(rateLimitManager.getRemainingRequests(key)).toBe(3);
    });

    it('should handle burst requests correctly', () => {
      const key = 'burst-test';
      const results: boolean[] = [];

      // Make 10 rapid requests
      for (let i = 0; i < 10; i++) {
        results.push(rateLimitManager.isAllowed(key));
      }

      // First 5 should be allowed, rest blocked
      expect(results.slice(0, 5)).toEqual([true, true, true, true, true]);
      expect(results.slice(5)).toEqual([false, false, false, false, false]);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete security workflow', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const maliciousRequest = new Request('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '<script>alert("xss")</script>Hacker',
          email: 'hacker@evil.com',
          message: 'This is a test<iframe src="javascript:alert(1)"></iframe>'
        })
      });

      const response = await securityMiddleware.interceptRequest(maliciousRequest);

      expect(response).toBeDefined();
      
      // Verify sanitization occurred
      const fetchCall = (fetch as jest.Mock).mock.calls[0][0];
      const sanitizedBody = JSON.parse(fetchCall.body);
      
      expect(sanitizedBody.name).toBe('alert("xss")Hacker');
      expect(sanitizedBody.message).toBe('This is a test');
    });

    it('should coordinate between security components', () => {
      const cspViolation = {
        blockedURI: 'inline',
        violatedDirective: 'script-src',
        originalPolicy: "default-src 'self'",
        sourceFile: 'https://perbox.io/page.html',
        lineNumber: 1,
        columnNumber: 1
      };

      // CSP violation should trigger security logging
      securityMiddleware.handleCSPViolation(cspViolation);

      const logs = securityMiddleware.getSecurityLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('CSP_VIOLATION');
    });

    it('should maintain performance under security load', async () => {
      const startTime = Date.now();

      // Process 100 requests with security checks
      const promises = Array.from({ length: 100 }, (_, i) => {
        const request = new Request(`/api/test-${i}`, {
          method: 'POST',
          body: JSON.stringify({ data: `test-${i}` })
        });
        return securityMiddleware.interceptRequest(request);
      });

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds for 100 requests)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle security component failures gracefully', async () => {
      // Mock a component failure
      const originalSanitize = InputSanitizer.prototype.sanitizeHTML;
      InputSanitizer.prototype.sanitizeHTML = jest.fn().mockImplementation(() => {
        throw new Error('Sanitizer failed');
      });

      const request = new Request('/api/test', {
        method: 'POST',
        body: JSON.stringify({ data: '<script>alert("xss")</script>' })
      });

      // Should not throw, but handle gracefully
      const response = await securityMiddleware.interceptRequest(request);
      expect(response).toBeDefined();

      // Restore original function
      InputSanitizer.prototype.sanitizeHTML = originalSanitize;
    });
  });

  describe('Browser Compatibility', () => {
    it('should work without modern browser features', () => {
      // Mock older browser environment
      const originalFetch = global.fetch;
      const originalPromise = global.Promise;

      delete (global as any).fetch;
      delete (global as any).Promise;

      // Should still initialize without errors
      expect(() => {
        new SecurityMiddleware({
          enableCSP: true,
          enableRateLimit: true
        });
      }).not.toThrow();

      // Restore
      global.fetch = originalFetch;
      global.Promise = originalPromise;
    });

    it('should provide polyfills for missing features', () => {
      const middleware = new SecurityMiddleware({});
      
      // Should provide fallbacks for missing APIs
      expect(middleware.hasFeatureSupport('fetch')).toBeDefined();
      expect(middleware.hasFeatureSupport('Promise')).toBeDefined();
      expect(middleware.hasFeatureSupport('WeakMap')).toBeDefined();
    });
  });
});