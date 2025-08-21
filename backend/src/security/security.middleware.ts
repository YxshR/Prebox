import { Request, Response, NextFunction } from 'express';
import { ThreatDetectionService } from './threat-detection.service';
import { AuditLogService } from '../compliance/audit-log.service';
import { EncryptionService } from './encryption.service';

export interface SecurityRequest extends Request {
  user?: any;
  securityContext?: {
    ipAddress: string;
    userAgent: string;
    requestId: string;
    startTime: number;
  };
}

export class SecurityMiddleware {
  private threatDetectionService: ThreatDetectionService;
  private auditLogService: AuditLogService;
  private encryptionService: EncryptionService;

  constructor() {
    this.threatDetectionService = new ThreatDetectionService();
    this.auditLogService = new AuditLogService();
    this.encryptionService = new EncryptionService();
  }

  /**
   * Initialize security context for request
   */
  initializeSecurityContext = (req: SecurityRequest, res: Response, next: NextFunction): void => {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('User-Agent') || '';
    const requestId = this.encryptionService.generateSecureToken(16);
    const startTime = Date.now();

    req.securityContext = {
      ipAddress,
      userAgent,
      requestId,
      startTime
    };

    // Add request ID to response headers for tracking
    res.setHeader('X-Request-ID', requestId);

    next();
  };

  /**
   * Check if IP is blocked
   */
  checkBlockedIp = async (req: SecurityRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ipAddress = req.securityContext?.ipAddress || this.getClientIp(req);
      const isBlocked = await this.threatDetectionService.isIpBlocked(ipAddress);

      if (isBlocked) {
        await this.auditLogService.logSecurityEvent(
          'system',
          null,
          'BLOCKED_IP_ACCESS_ATTEMPT',
          ipAddress,
          req.securityContext?.userAgent || '',
          {
            requestId: req.securityContext?.requestId,
            endpoint: req.path,
            method: req.method
          }
        );

        res.status(403).json({
          success: false,
          error: {
            code: 'IP_BLOCKED',
            message: 'Access denied from this IP address'
          }
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking blocked IP:', error);
      next(); // Continue on error to avoid breaking the service
    }
  };

  /**
   * Monitor authentication events
   */
  monitorAuthentication = async (req: SecurityRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.send;
    const self = this;

    res.send = function(data: any) {
      // Monitor authentication after response is sent
      setImmediate(async () => {
        try {
          const user = req.user;
          const ipAddress = req.securityContext?.ipAddress || self.getClientIp(req);
          const userAgent = req.securityContext?.userAgent || '';
          
          // Check if this is an authentication endpoint
          if (req.path.includes('/auth/login') || req.path.includes('/auth/signin')) {
            const success = res.statusCode === 200;
            const tenantId = user?.tenantId || 'system';
            const userId = user?.id || null;

            await self.threatDetectionService.monitorAuthenticationEvents(
              tenantId,
              userId,
              ipAddress,
              userAgent,
              success
            );

            // Log authentication event
            await self.auditLogService.logAuth(
              tenantId,
              userId,
              success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
              ipAddress,
              userAgent,
              {
                requestId: req.securityContext?.requestId,
                endpoint: req.path
              }
            );
          }
        } catch (error) {
          console.error('Error monitoring authentication:', error);
        }
      });

      return originalSend.call(this, data);
    };

    next();
  };

  /**
   * Monitor API usage
   */
  monitorApiUsage = async (req: SecurityRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.send;
    const self = this;

    res.send = function(data: any) {
      // Monitor API usage after response is sent
      setImmediate(async () => {
        try {
          const user = req.user;
          const apiKeyId = (req as any).apiKeyId;
          
          if (user && apiKeyId && req.path.startsWith('/api/')) {
            const ipAddress = req.securityContext?.ipAddress || self.getClientIp(req);
            const userAgent = req.securityContext?.userAgent || '';

            await self.threatDetectionService.monitorApiUsage(
              user.tenantId,
              user.id,
              apiKeyId,
              req.path,
              ipAddress,
              userAgent
            );

            // Log API usage
            await self.auditLogService.logApiUsage(
              user.tenantId,
              user.id,
              apiKeyId,
              `${req.method} ${req.path}`,
              req.method,
              res.statusCode,
              Date.now() - (req.securityContext?.startTime || 0),
              ipAddress,
              userAgent
            );
          }
        } catch (error) {
          console.error('Error monitoring API usage:', error);
        }
      });

      return originalSend.call(this, data);
    };

    next();
  };

  /**
   * Monitor email sending
   */
  monitorEmailSending = async (req: SecurityRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.send;
    const self = this;

    res.send = function(data: any) {
      // Monitor email sending after response is sent
      setImmediate(async () => {
        try {
          const user = req.user;
          
          if (user && (req.path.includes('/emails/send') || req.path.includes('/campaigns'))) {
            const ipAddress = req.securityContext?.ipAddress || self.getClientIp(req);
            const userAgent = req.securityContext?.userAgent || '';
            
            const campaignId = req.body?.campaignId || 'unknown';
            const recipientCount = req.body?.recipients?.length || 0;
            const content = req.body?.content || req.body?.htmlContent || '';

            await self.threatDetectionService.monitorEmailSending(
              user.tenantId,
              user.id,
              campaignId,
              recipientCount,
              content,
              ipAddress,
              userAgent
            );

            // Log email sending event
            await self.auditLogService.logEmailEvent(
              user.tenantId,
              user.id,
              'EMAIL_SENT',
              campaignId,
              'multiple', // Don't log individual emails for privacy
              ipAddress,
              userAgent,
              {
                recipientCount,
                contentLength: content.length,
                requestId: req.securityContext?.requestId
              }
            );
          }
        } catch (error) {
          console.error('Error monitoring email sending:', error);
        }
      });

      return originalSend.call(this, data);
    };

    next();
  };

  /**
   * Monitor pricing access events
   */
  monitorPricingAccess = async (req: SecurityRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.send;
    const self = this;

    res.send = function(data: any) {
      // Monitor pricing access after response is sent
      setImmediate(async () => {
        try {
          const user = req.user;
          const ipAddress = req.securityContext?.ipAddress || self.getClientIp(req);
          const userAgent = req.securityContext?.userAgent || '';
          
          // Log pricing access events for security monitoring
          await self.auditLogService.logSecurityEvent(
            user?.tenantId || 'system',
            user?.id || null,
            'PRICING_ACCESS',
            ipAddress,
            userAgent,
            {
              requestId: req.securityContext?.requestId,
              endpoint: req.path,
              method: req.method,
              planId: req.params?.planId || req.body?.planId,
              amount: req.body?.amount,
              statusCode: res.statusCode
            }
          );

          // Monitor for suspicious pricing access patterns
          if (user) {
            await self.threatDetectionService.monitorPricingAccess(
              user.tenantId,
              user.id,
              req.path,
              ipAddress,
              userAgent
            );
          }
        } catch (error) {
          console.error('Error monitoring pricing access:', error);
        }
      });

      return originalSend.call(this, data);
    };

    next();
  };

  /**
   * Log data access events
   */
  logDataAccess = (resourceType: string) => {
    return async (req: SecurityRequest, res: Response, next: NextFunction): Promise<void> => {
      const originalSend = res.send;
      const self = this;

      res.send = function(data: any) {
        // Log data access after response is sent
        setImmediate(async () => {
          try {
            const user = req.user;
            
            if (user && res.statusCode < 400) {
              const ipAddress = req.securityContext?.ipAddress || self.getClientIp(req);
              const userAgent = req.securityContext?.userAgent || '';
              
              let action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' = 'READ';
              if (req.method === 'POST') action = 'CREATE';
              else if (req.method === 'PUT' || req.method === 'PATCH') action = 'UPDATE';
              else if (req.method === 'DELETE') action = 'DELETE';

              const resourceId = req.params.id || req.body?.id || 'multiple';

              await self.auditLogService.logDataAccess(
                user.tenantId,
                user.id,
                action,
                resourceType,
                resourceId,
                ipAddress,
                userAgent,
                {
                  requestId: req.securityContext?.requestId,
                  endpoint: req.path,
                  method: req.method
                }
              );
            }
          } catch (error) {
            console.error('Error logging data access:', error);
          }
        });

        return originalSend.call(this, data);
      };

      next();
    };
  };

  /**
   * Validate request integrity (for webhooks)
   */
  validateWebhookSignature = (secretKey: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const signature = req.get('X-Signature-256') || req.get('X-Hub-Signature-256');
        
        if (!signature) {
          res.status(401).json({
            success: false,
            error: {
              code: 'MISSING_SIGNATURE',
              message: 'Webhook signature required'
            }
          });
          return;
        }

        const payload = JSON.stringify(req.body);
        const expectedSignature = this.encryptionService.generateHmacSignature(payload, secretKey);
        const providedSignature = signature.replace('sha256=', '');

        const isValid = this.encryptionService.verifyHmacSignature(
          payload,
          providedSignature,
          secretKey
        );

        if (!isValid) {
          res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_SIGNATURE',
              message: 'Invalid webhook signature'
            }
          });
          return;
        }

        next();
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SIGNATURE_VALIDATION_ERROR',
            message: 'Error validating webhook signature'
          }
        });
      }
    };
  };

  /**
   * Sanitize request data
   */
  sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }

      // Sanitize request body
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }

      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'REQUEST_SANITIZATION_ERROR',
          message: 'Error sanitizing request data'
        }
      });
    }
  };

  /**
   * Sanitize object recursively
   */
  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeString(key);
      sanitized[sanitizedKey] = this.sanitizeObject(value);
    }

    return sanitized;
  }

  /**
   * Sanitize string to prevent XSS and injection attacks
   */
  private sanitizeString(str: any): any {
    if (typeof str !== 'string') {
      return str;
    }

    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/data:text\/html/gi, '') // Remove data URLs
      .trim();
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           '127.0.0.1';
  }
}