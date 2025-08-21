import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import winston from 'winston';
import { Express } from 'express';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from './metrics.service';
import { AlertingService } from './alerting.service';
import { HealthCheckService } from './health-check.service';
import { MonitoringController } from './monitoring.controller';
import { PerformanceMonitor, errorMonitoringMiddleware, businessMetricsMiddleware } from './performance.middleware';
import { createMonitoringRoutes } from './monitoring.routes';

export interface MonitoringIntegration {
  monitoringService: MonitoringService;
  metricsService: MetricsService;
  alertingService: AlertingService;
  healthCheckService: HealthCheckService;
  performanceMonitor: PerformanceMonitor;
  controller: MonitoringController;
  cleanup: () => void;
}

/**
 * Initialize and integrate the complete monitoring system
 */
export async function initializeMonitoring(
  app: Express,
  db: Pool,
  redis: RedisClientType,
  logger: winston.Logger
): Promise<MonitoringIntegration> {
  
  // Initialize core services
  const monitoringService = new MonitoringService(db, redis, logger);
  const metricsService = new MetricsService(db, redis, logger);
  const alertingService = new AlertingService(db, redis, logger);
  const healthCheckService = new HealthCheckService(db, redis, logger);

  // Initialize performance monitoring
  const performanceMonitor = new PerformanceMonitor(monitoringService, metricsService);

  // Initialize controller
  const controller = new MonitoringController(
    monitoringService,
    metricsService,
    alertingService,
    healthCheckService
  );

  // Set up middleware
  setupMiddleware(app, performanceMonitor, monitoringService, metricsService);

  // Set up routes
  const monitoringRoutes = createMonitoringRoutes(controller);
  app.use('/api/monitoring', monitoringRoutes);

  // Set up default alert rules
  await setupDefaultAlertRules(alertingService, logger);

  // Set up cleanup handlers
  const cleanup = () => {
    metricsService.destroy();
    alertingService.destroy();
    healthCheckService.destroy();
  };

  // Handle graceful shutdown
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  logger.info('Monitoring system initialized successfully');

  return {
    monitoringService,
    metricsService,
    alertingService,
    healthCheckService,
    performanceMonitor,
    controller,
    cleanup
  };
}

/**
 * Set up monitoring middleware
 */
function setupMiddleware(
  app: Express,
  performanceMonitor: PerformanceMonitor,
  monitoringService: MonitoringService,
  metricsService: MetricsService
): void {
  
  // Global performance monitoring
  app.use(performanceMonitor.middleware());

  // Error monitoring
  app.use(errorMonitoringMiddleware(monitoringService));

  // Business metrics for specific endpoints
  app.use('/api/emails/send', businessMetricsMiddleware(
    metricsService,
    'emails_sent',
    (req, res) => {
      // Extract email count from request/response
      const emailCount = req.body?.recipients?.length || 1;
      return emailCount;
    }
  ));

  app.use('/api/subscriptions', businessMetricsMiddleware(
    metricsService,
    'subscription_changes',
    () => 1
  ));

  app.use('/api/billing/payments', businessMetricsMiddleware(
    metricsService,
    'payments_processed',
    (req, res) => {
      // Extract payment amount from request
      return req.body?.amount || 0;
    }
  ));

  app.use('/api/templates/generate', businessMetricsMiddleware(
    metricsService,
    'ai_templates_generated',
    () => 1
  ));
}

/**
 * Set up default alert rules
 */
async function setupDefaultAlertRules(
  alertingService: AlertingService,
  logger: winston.Logger
): Promise<void> {
  
  const defaultRules = [
    {
      name: 'High Error Rate',
      metric: 'performance:error_rate',
      condition: 'greater_than' as const,
      threshold: 0.05, // 5%
      timeWindow: 5, // 5 minutes
      severity: 'high' as const,
      enabled: true,
      channels: [
        {
          type: 'email' as const,
          config: {
            email: process.env.ALERT_EMAIL || 'alerts@bulkemail.com'
          }
        }
      ]
    },
    {
      name: 'Slow Response Time',
      metric: 'performance:avg_response_time',
      condition: 'greater_than' as const,
      threshold: 2000, // 2 seconds
      timeWindow: 10, // 10 minutes
      severity: 'medium' as const,
      enabled: true,
      channels: [
        {
          type: 'email' as const,
          config: {
            email: process.env.ALERT_EMAIL || 'alerts@bulkemail.com'
          }
        }
      ]
    },
    {
      name: 'High Memory Usage',
      metric: 'system:memory_usage',
      condition: 'greater_than' as const,
      threshold: 0.85, // 85%
      timeWindow: 5, // 5 minutes
      severity: 'high' as const,
      enabled: true,
      channels: [
        {
          type: 'email' as const,
          config: {
            email: process.env.ALERT_EMAIL || 'alerts@bulkemail.com'
          }
        }
      ]
    },
    {
      name: 'Low Email Delivery Rate',
      metric: 'business:email_delivery_rate',
      condition: 'less_than' as const,
      threshold: 0.95, // 95%
      timeWindow: 15, // 15 minutes
      severity: 'high' as const,
      enabled: true,
      channels: [
        {
          type: 'email' as const,
          config: {
            email: process.env.ALERT_EMAIL || 'alerts@bulkemail.com'
          }
        }
      ]
    }
  ];

  try {
    // Check if rules already exist to avoid duplicates
    const existingRules = await alertingService.getAlertRules();
    const existingRuleNames = new Set(existingRules.map(rule => rule.name));

    for (const rule of defaultRules) {
      if (!existingRuleNames.has(rule.name)) {
        await alertingService.createAlertRule(rule);
        logger.info('Created default alert rule', { name: rule.name });
      }
    }
  } catch (error) {
    logger.error('Failed to set up default alert rules', { error });
  }
}

/**
 * Helper function to record business metrics from anywhere in the application
 */
export function createMetricsRecorder(metricsService: MetricsService) {
  return {
    // Email metrics
    recordEmailSent: async (tenantId: string, count: number = 1, metadata?: any) => {
      await metricsService.recordMetric({
        name: 'emails_sent',
        value: count,
        timestamp: new Date(),
        type: 'counter',
        tags: { tenant_id: tenantId, ...metadata }
      });
    },

    recordEmailDelivered: async (tenantId: string, count: number = 1) => {
      await metricsService.recordMetric({
        name: 'emails_delivered',
        value: count,
        timestamp: new Date(),
        type: 'counter',
        tags: { tenant_id: tenantId }
      });
    },

    recordEmailBounced: async (tenantId: string, count: number = 1) => {
      await metricsService.recordMetric({
        name: 'emails_bounced',
        value: count,
        timestamp: new Date(),
        type: 'counter',
        tags: { tenant_id: tenantId }
      });
    },

    // Subscription metrics
    recordSubscriptionCreated: async (tenantId: string, planType: string) => {
      await metricsService.recordMetric({
        name: 'subscriptions_created',
        value: 1,
        timestamp: new Date(),
        type: 'counter',
        tags: { tenant_id: tenantId, plan_type: planType }
      });
    },

    recordSubscriptionCancelled: async (tenantId: string, planType: string) => {
      await metricsService.recordMetric({
        name: 'subscriptions_cancelled',
        value: 1,
        timestamp: new Date(),
        type: 'counter',
        tags: { tenant_id: tenantId, plan_type: planType }
      });
    },

    // Revenue metrics
    recordRevenue: async (tenantId: string, amount: number, currency: string = 'USD') => {
      await metricsService.recordMetric({
        name: 'revenue_generated',
        value: amount,
        timestamp: new Date(),
        type: 'counter',
        tags: { tenant_id: tenantId, currency }
      });
    },

    // API usage metrics
    recordApiCall: async (tenantId: string, endpoint: string, method: string) => {
      await metricsService.recordMetric({
        name: 'api_calls',
        value: 1,
        timestamp: new Date(),
        type: 'counter',
        tags: { tenant_id: tenantId, endpoint, method }
      });
    },

    // Template metrics
    recordTemplateGenerated: async (tenantId: string, templateType: string) => {
      await metricsService.recordMetric({
        name: 'templates_generated',
        value: 1,
        timestamp: new Date(),
        type: 'counter',
        tags: { tenant_id: tenantId, template_type: templateType }
      });
    },

    // Performance metrics
    recordProcessingTime: async (operation: string, duration: number, tenantId?: string) => {
      await metricsService.recordTimer(
        `${operation}_processing_time`,
        duration,
        tenantId ? { tenant_id: tenantId } : undefined
      );
    },

    // Queue metrics
    recordQueueSize: async (queueName: string, size: number) => {
      await metricsService.setGauge(`queue_size_${queueName}`, size);
    },

    recordQueueProcessingTime: async (queueName: string, duration: number) => {
      await metricsService.recordTimer(`queue_processing_time_${queueName}`, duration);
    }
  };
}

/**
 * Health check helpers for external services
 */
export function createHealthCheckHelpers(healthCheckService: HealthCheckService) {
  return {
    // Register email service health check
    registerEmailServiceCheck: (provider: string, checkFn: () => Promise<boolean>) => {
      healthCheckService.registerHealthCheck(`email_service_${provider}`, async () => {
        const startTime = Date.now();
        try {
          const isHealthy = await checkFn();
          const responseTime = Date.now() - startTime;
          
          return {
            name: `email_service_${provider}`,
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date(),
            responseTime,
            metadata: { provider }
          };
        } catch (error) {
          return {
            name: `email_service_${provider}`,
            status: 'unhealthy',
            timestamp: new Date(),
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });
    },

    // Register payment service health check
    registerPaymentServiceCheck: (provider: string, checkFn: () => Promise<boolean>) => {
      healthCheckService.registerHealthCheck(`payment_service_${provider}`, async () => {
        const startTime = Date.now();
        try {
          const isHealthy = await checkFn();
          const responseTime = Date.now() - startTime;
          
          return {
            name: `payment_service_${provider}`,
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date(),
            responseTime,
            metadata: { provider }
          };
        } catch (error) {
          return {
            name: `payment_service_${provider}`,
            status: 'unhealthy',
            timestamp: new Date(),
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });
    }
  };
}