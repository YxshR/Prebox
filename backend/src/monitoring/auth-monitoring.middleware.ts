import { Request, Response, NextFunction } from 'express';
import { AuthMonitoringService } from './auth-monitoring.service';

export interface AuthMonitoringRequest extends Request {
  authMonitoring?: {
    startTime: number;
    eventType?: string;
    method?: string;
  };
}

export class AuthMonitoringMiddleware {
  private authMonitoringService: AuthMonitoringService;

  constructor(authMonitoringService: AuthMonitoringService) {
    this.authMonitoringService = authMonitoringService;
  }

  /**
   * Middleware to track authentication performance
   */
  trackAuthPerformance = (eventType: string, method: string) => {
    return (req: AuthMonitoringRequest, res: Response, next: NextFunction) => {
      req.authMonitoring = {
        startTime: Date.now(),
        eventType,
        method
      };

      // Override res.json to capture response
      const originalJson = res.json;
      res.json = function(body: any) {
        const responseTime = Date.now() - req.authMonitoring!.startTime;
        const success = res.statusCode >= 200 && res.statusCode < 400;

        // Record the auth event
        setImmediate(() => {
          authMonitoringService.recordAuthEvent({
            eventType: eventType as any,
            userId: body?.data?.user?.id,
            email: req.body?.email || body?.data?.user?.email,
            phone: req.body?.phone || body?.data?.user?.phone,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            method: method as any,
            success,
            errorCode: !success ? body?.error?.code : undefined,
            errorMessage: !success ? body?.error?.message : undefined,
            responseTime,
            metadata: {
              statusCode: res.statusCode,
              endpoint: req.path,
              httpMethod: req.method
            }
          });
        });

        return originalJson.call(this, body);
      };

      next();
    };
  };

  /**
   * Middleware to track login attempts
   */
  trackLogin = this.trackAuthPerformance('login_attempt', 'email_password');

  /**
   * Middleware to track phone OTP login
   */
  trackPhoneLogin = this.trackAuthPerformance('login_attempt', 'phone_otp');

  /**
   * Middleware to track Auth0 login
   */
  trackAuth0Login = this.trackAuthPerformance('login_attempt', 'auth0');

  /**
   * Middleware to track signup start
   */
  trackSignupStart = this.trackAuthPerformance('signup_start', 'email_password');

  /**
   * Middleware to track phone signup
   */
  trackPhoneSignup = this.trackAuthPerformance('signup_start', 'phone_otp');

  /**
   * Middleware to track phone verification
   */
  trackPhoneVerification = this.trackAuthPerformance('phone_verification', 'phone_otp');

  /**
   * Middleware to track email verification
   */
  trackEmailVerification = this.trackAuthPerformance('email_verification', 'email_password');

  /**
   * Middleware to track logout
   */
  trackLogout = this.trackAuthPerformance('logout', 'email_password');

  /**
   * Generic middleware for custom auth events
   */
  trackCustomEvent = (eventType: string, method: string) => {
    return this.trackAuthPerformance(eventType, method);
  };
}