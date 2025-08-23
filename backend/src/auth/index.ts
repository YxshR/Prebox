// Export all authentication services and middleware
export { AuthService } from './auth.service';
export { PhoneVerificationService } from './phone-verification.service';
export { EnhancedPhoneVerificationService } from './enhanced-phone-verification.service';
export { EmailVerificationService } from './email-verification.service';
export { GoogleOAuthService } from './google-oauth.service';
export { AuthMiddleware } from './auth.middleware';
export { ApiKeyService } from './api-key.service';
export { RateLimiterService } from './rate-limiter.service';
export { SecurityMiddleware } from './security.middleware';
export { ErrorHandlerMiddleware, ErrorCodes } from './error-handler.middleware';
export { default as authRoutes } from './auth.routes';
export { default as apiKeyRoutes } from './api-key.routes';
export { default as phoneVerificationRoutes } from './phone-verification.routes';