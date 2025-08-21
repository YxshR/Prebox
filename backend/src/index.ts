import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import passport from 'passport';
import winston from 'winston';
import redisClient from './config/redis';
import db from './config/database';
import { authRoutes, apiKeyRoutes, SecurityMiddleware, ErrorHandlerMiddleware } from './auth';
import adminAuthRoutes from './auth/admin-auth.routes';
import adminRoutes from './admin/admin.routes';
import securityRoutes from './security/security.routes';
import pricingRoutes from './security/pricing.routes';
import { pricingValidationRoutes } from './pricing';
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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const securityMiddleware = new SecurityMiddleware();
const securityComplianceMiddleware = new SecurityComplianceMiddleware();

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

initializeMonitoring(app, db, redisClient, logger)
  .then((monitoring) => {
    monitoringSystem = monitoring;
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

// Security middleware (applied first)
app.use(securityHeaders); // TLS and security headers
app.use(securityComplianceMiddleware.initializeSecurityContext);
app.use(securityComplianceMiddleware.checkBlockedIp);
app.use(securityMiddleware.securityHeaders);
app.use(securityMiddleware.securityLogger);
app.use(securityMiddleware.requestTimeout(30000));
app.use(securityMiddleware.generalRateLimit);
app.use(securityMiddleware.slowDown);

// Basic middleware
app.use(helmet());
app.use(securityMiddleware.enhancedCors);
app.use(securityMiddleware.requestSizeLimit('10mb'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add retry logic and error handling middleware
app.use(createRetryMiddleware({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000
}));
app.use(addRetryHeaders);

// Input sanitization and API versioning
app.use(securityComplianceMiddleware.sanitizeRequest);
app.use(securityMiddleware.sanitizeInput);
app.use(securityMiddleware.apiVersioning);
app.use(securityMiddleware.validateApiKeyFormat);

// Initialize Passport
app.use(passport.initialize());

// Routes with enhanced security
app.use('/api/auth', 
  securityMiddleware.authRateLimit, 
  securityComplianceMiddleware.monitorAuthentication,
  authRoutes
);
app.use('/api/auth/api-keys', apiKeyRoutes);

// Security and compliance routes
app.use('/api/security', securityRoutes);

// Pricing protection routes
app.use('/api/pricing', 
  securityComplianceMiddleware.monitorPricingAccess,
  securityComplianceMiddleware.logDataAccess('pricing'),
  pricingRoutes
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