import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import passport from 'passport';
import winston from 'winston';
import redisClient from './config/redis';
import db from './config/database';
import { authRoutes, apiKeyRoutes, phoneVerificationRoutes, SecurityMiddleware, ErrorHandlerMiddleware } from './auth';
import ComprehensiveSecurityMiddleware from './auth/comprehensive-security.middleware';
import EnhancedAuthMiddleware from './auth/enhanced-auth.middleware';
import ComprehensiveValidationMiddleware from './auth/comprehensive-validation.middleware';
import adminAuthRoutes from './auth/admin-auth.routes';
import adminRoutes from './admin/admin.routes';
import securityRoutes from './security/security.routes';
import securityPricingRoutes from './security/pricing.routes';
import { pricingRoutes, pricingValidationRoutes } from './pricing';
import { SecurityMiddleware as SecurityComplianceMiddleware } from './security/security.middleware';
import { securityHeaders } from './security/tls.config';
// Billing routes will be imported conditionally
import { createEmailRoutes, scheduledEmailRoutes, scheduledEmailCron } from './emails';
import { campaignRoutes } from './campaigns';
import { brandingRoutes } from './branding';
import { aiTemplateRoutes } from './ai-templates';
import { templateRoutes } from './templates';
import contactRoutes from './contacts/contact.routes';
import { createContactRoutes } from './support/contact.routes';
import { createDomainRoutes } from './domains';
import analyticsRoutes from './analytics/analytics.routes';
import settingsRoutes from './settings/settings.routes';
import healthRoutes from './health/health.routes';
import authMonitoringRoutes from './monitoring/auth-monitoring.routes';
import { connectionRecoveryMiddleware } from './middleware/connection-recovery.middleware';
import { 
  ApiErrorHandlerMiddleware, 
  apiErrorHandler, 
  handleDatabaseError, 
  handleNetworkError, 
  handleValidationError 
} from './middleware/api-error-handler.middleware';
import { 
  createRetryMiddleware, 
  addRetryHeaders, 
  createDatabaseRetry 
} from './middleware/retry-logic.middleware';
import { initializeMonitoring, createMetricsRecorder, createHealthCheckHelpers } from './monitoring/monitoring.integration';
import { ResilientSecurityMonitorService } from './security/resilient-security-monitor.service';
import { AuthMonitoringService } from './monitoring/auth-monitoring.service';
import { AuthMonitoringMiddleware } from './monitoring/auth-monitoring.middleware';
import { PerformanceMonitoringMiddleware } from './monitoring/performance-monitoring.middleware';
import { ComprehensiveHealthService } from './health/comprehensive-health.service';
import deploymentHealthRoutes from './health/deployment-health.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const securityMiddleware = new SecurityMiddleware();
const securityComplianceMiddleware = new SecurityComplianceMiddleware();
const comprehensiveSecurityMiddleware = new ComprehensiveSecurityMiddleware();
const enhancedAuthMiddleware = new EnhancedAuthMiddleware();

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// Initialize Redis connection
redisClient.connect().catch(console.error);

// Initialize monitoring system
let monitoringSystem: any;
let resilientSecurityMonitor: ResilientSecurityMonitorService;
let authMonitoringService: AuthMonitoringService;
let authMonitoringMiddleware: AuthMonitoringMiddleware;
let performanceMonitoringMiddleware: PerformanceMonitoringMiddleware;
let comprehensiveHealthService: ComprehensiveHealthService;

initializeMonitoring(app, db, redisClient, logger)
  .then((monitoring) => {
    monitoringSystem = monitoring;
    
    // Initialize auth monitoring
    authMonitoringService = new AuthMonitoringService(db, redisClient, logger, monitoring);
    authMonitoringMiddleware = new AuthMonitoringMiddleware(authMonitoringService);
    performanceMonitoringMiddleware = new PerformanceMonitoringMiddleware(monitoring, authMonitoringService);
    comprehensiveHealthService = new ComprehensiveHealthService(db, redisClient, logger);
    
    // Store in app locals for access in routes
    app.locals.authMonitoringService = authMonitoringService;
    app.locals.performanceMonitoringMiddleware = performanceMonitoringMiddleware;
    app.locals.comprehensiveHealthService = comprehensiveHealthService;
    
    logger.info('Monitoring system initialized successfully');
  })
  .catch((error) => {
    logger.error('Failed to initialize monitoring system', { error });
  });

// Initialize resilient security monitoring
try {
  resilientSecurityMonitor = new ResilientSecurityMonitorService(logger);
  app.locals.resilientSecurityMonitor = resilientSecurityMonitor;
  logger.info('Resilient security monitoring initialized successfully');
} catch (error) {
  logger.error('Failed to initialize resilient security monitoring', { error });
}

// Initialize enhanced health monitoring and perform startup validation
import { enhancedHealthMonitor } from './health/enhanced-health.routes';
enhancedHealthMonitor.performStartupValidation().catch(error => {
  logger.error('Startup validation failed', { error });
});

// Security middleware (applied first) - Enhanced comprehensive security
app.use(securityHeaders); // TLS and security headers
app.use(comprehensiveSecurityMiddleware.securityHeaders); // Enhanced security headers
app.use(comprehensiveSecurityMiddleware.initializeSecurityContext); // Security context initialization
app.use(comprehensiveSecurityMiddleware.checkBlockedIPs); // IP blocking
app.use(comprehensiveSecurityMiddleware.createRateLimit('general')); // General rate limiting
app.use(comprehensiveSecurityMiddleware.slowDownMiddleware); // Slow down repeated requests
app.use(comprehensiveSecurityMiddleware.requestLimits('10mb', 30000)); // Request size and timeout limits
app.use(comprehensiveSecurityMiddleware.securityMonitoring); // Security monitoring and logging

// Legacy security middleware for backward compatibility
app.use(securityComplianceMiddleware.initializeSecurityContext);
app.use(securityComplianceMiddleware.checkBlockedIp);
app.use(securityMiddleware.securityLogger);

// Basic middleware with enhanced security
app.use(helmet()); // Basic helmet protection
app.use(comprehensiveSecurityMiddleware.corsMiddleware); // Enhanced CORS with security
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add retry logic and error handling middleware
app.use(createRetryMiddleware({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000
}));
app.use(addRetryHeaders);

// Add performance monitoring middleware
app.use((req, res, next) => {
  if (performanceMonitoringMiddleware) {
    performanceMonitoringMiddleware.trackPerformance(req, res, next);
  } else {
    next();
  }
});

// Input sanitization and validation with enhanced security
app.use(comprehensiveSecurityMiddleware.sanitizeInput); // Comprehensive input sanitization
app.use(ComprehensiveValidationMiddleware.handleConstraintViolations); // Database constraint handling
app.use(securityMiddleware.apiVersioning); // API versioning
app.use(securityMiddleware.validateApiKeyFormat); // API key format validation

// Legacy sanitization for backward compatibility
app.use(securityComplianceMiddleware.sanitizeRequest);

// Initialize Passport
app.use(passport.initialize());

// Routes with comprehensive enhanced security
app.use('/api/auth', 
  comprehensiveSecurityMiddleware.createRateLimit('auth'), // Enhanced auth rate limiting
  securityComplianceMiddleware.monitorAuthentication, // Authentication monitoring
  (req, res, next) => {
    if (authMonitoringMiddleware) {
      authMonitoringMiddleware.trackAuthPerformance(req, res, next);
    } else {
      next();
    }
  },
  authRoutes
);
app.use('/api/auth/api-keys', 
  comprehensiveSecurityMiddleware.createRateLimit('auth'), // Rate limit API key operations
  apiKeyRoutes
);
app.use('/api/auth/phone-verification', 
  comprehensiveSecurityMiddleware.createRateLimit('phone'), // Phone-specific rate limiting
  securityComplianceMiddleware.monitorAuthentication,
  phoneVerificationRoutes
);

// Security and compliance routes
app.use('/api/security', securityRoutes);

// Core pricing routes
app.use('/api/pricing', 
  securityComplianceMiddleware.monitorPricingAccess,
  securityComplianceMiddleware.logDataAccess('pricing'),
  pricingRoutes
);

// Security pricing protection routes
app.use('/api/pricing/security', 
  securityComplianceMiddleware.monitorPricingAccess,
  securityComplianceMiddleware.logDataAccess('pricing'),
  securityPricingRoutes
);

// Pricing validation routes
app.use('/api/pricing/validation',
  securityComplianceMiddleware.monitorPricingAccess,
  securityComplianceMiddleware.logDataAccess('pricing'),
  pricingValidationRoutes
);

// Admin routes
app.use('/api/admin/auth', securityMiddleware.authRateLimit, adminAuthRoutes);
app.use('/api/admin', adminRoutes);

// Only load billing routes in non-demo mode
if (process.env.DEMO_MODE !== 'true') {
  const { subscriptionRoutes } = require('./billing');
  app.use('/api/subscriptions', subscriptionRoutes);
  
  // Add new billing routes
  const billingRoutes = require('./billing/billing.routes').default;
  app.use('/api/billing', billingRoutes);
} else {
  // Demo mode - provide mock billing endpoints
  app.use('/api/subscriptions', (req, res) => {
    res.json({
      success: true,
      message: 'Billing features are disabled in demo mode',
      data: null
    });
  });
  
  // Demo mode billing routes with mock data
  const billingRoutes = require('./billing/billing.routes').default;
  app.use('/api/billing', billingRoutes);
}

app.use('/api/emails', 
  securityComplianceMiddleware.monitorEmailSending,
  securityComplianceMiddleware.logDataAccess('email'),
  createEmailRoutes(db)
);
app.use('/api/emails', scheduledEmailRoutes);
app.use('/api/campaigns', 
  securityComplianceMiddleware.logDataAccess('campaign'),
  campaignRoutes
);
app.use('/api/branding', brandingRoutes);
app.use('/api/ai-templates', aiTemplateRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/support', createContactRoutes(db));
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);

// Health check routes
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/health/deployment', deploymentHealthRoutes);

// Monitoring routes
app.use('/api/monitoring/auth', authMonitoringRoutes);

// Only load domain routes in non-demo mode
if (process.env.DEMO_MODE !== 'true') {
  app.use('/api/domains', createDomainRoutes(db));
}

// Legacy health check endpoint for backward compatibility
app.get('/health-legacy', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Bulk Email Platform API is running',
    timestamp: new Date().toISOString()
  });
});

// Connection recovery middleware
connectionRecoveryMiddleware.forEach(middleware => app.use(middleware));

// Enhanced error handlers - order matters!
app.use(handleDatabaseError);
app.use(handleNetworkError);
app.use(handleValidationError);
app.use(apiErrorHandler);
app.use(ErrorHandlerMiddleware.handleError);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
  
  // Initialize scheduled email cron job
  if (process.env.SCHEDULED_EMAIL_CRON_ENABLED !== 'false') {
    scheduledEmailCron.start();
    
    // Start cleanup cron job
    scheduledEmailCron.startCleanup();
    
    // Optionally start high-frequency processing
    if (process.env.SCHEDULED_EMAIL_HIGH_FREQUENCY === 'true') {
      scheduledEmailCron.startHighFrequency();
    }
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Cleanup monitoring system
  if (monitoringSystem?.cleanup) {
    monitoringSystem.cleanup();
  }
  
  // Cleanup resilient security monitoring
  if (resilientSecurityMonitor) {
    resilientSecurityMonitor.destroy();
  }
  
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  
  // Cleanup monitoring system
  if (monitoringSystem?.cleanup) {
    monitoringSystem.cleanup();
  }
  
  // Cleanup resilient security monitoring
  if (resilientSecurityMonitor) {
    resilientSecurityMonitor.destroy();
  }
  
  await redisClient.quit();
  process.exit(0);
});

export default app;