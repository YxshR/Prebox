import { healthService, ServiceHealth } from './health.service';
import db from '../config/database';
import redisClient from '../config/redis';
import winston from 'winston';

export interface ServiceDependency {
  name: string;
  required: boolean;
  healthCheck: () => Promise<ServiceHealth>;
  dependencies?: string[];
}

export interface StartupDiagnostic {
  service: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
  duration?: number;
  error?: any;
}

export interface EnhancedHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceHealth>;
  dependencies: Record<string, boolean>;
  startup: StartupDiagnostic[];
  timestamp: string;
  uptime: number;
}

export class EnhancedHealthMonitorService {
  private logger: winston.Logger;
  private startupDiagnostics: StartupDiagnostic[] = [];
  private serviceDependencies: Map<string, ServiceDependency> = new Map();
  private startTime: number;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.startTime = Date.now();
    this.initializeServiceDependencies();
  }

  /**
   * Initialize service dependencies mapping
   */
  private initializeServiceDependencies(): void {
    // Database dependency
    this.serviceDependencies.set('database', {
      name: 'PostgreSQL Database',
      required: true,
      healthCheck: this.checkDatabaseHealth.bind(this)
    });

    // Redis dependency
    this.serviceDependencies.set('redis', {
      name: 'Redis Cache',
      required: false, // Redis is not critical for basic functionality
      healthCheck: this.checkRedisHealth.bind(this),
      dependencies: []
    });

    // Email service dependency
    this.serviceDependencies.set('email', {
      name: 'Email Service',
      required: false,
      healthCheck: this.checkEmailServiceHealth.bind(this),
      dependencies: []
    });

    // External API dependencies
    this.serviceDependencies.set('external_apis', {
      name: 'External APIs',
      required: false,
      healthCheck: this.checkExternalAPIsHealth.bind(this),
      dependencies: []
    });
  }

  /**
   * Perform comprehensive health check with dependency validation
   */
  async getEnhancedHealthStatus(): Promise<EnhancedHealthStatus> {
    const services: Record<string, ServiceHealth> = {};
    const dependencies: Record<string, boolean> = {};

    // Check all service dependencies
    for (const [key, dependency] of this.serviceDependencies) {
      try {
        const health = await dependency.healthCheck();
        services[key] = health;
        dependencies[key] = health.status === 'healthy';
        
        this.logger.info(`Health check completed for ${dependency.name}`, {
          service: key,
          status: health.status,
          responseTime: health.responseTime
        });
      } catch (error) {
        services[key] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        dependencies[key] = false;
        
        this.logger.error(`Health check failed for ${dependency.name}`, {
          service: key,
          error: error instanceof Error ? error.message : error
        });
      }
    }

    // Validate service dependencies
    const dependencyValidation = this.validateServiceDependencies(services);
    
    // Determine overall status
    const overall = this.determineOverallHealth(services, dependencyValidation);

    return {
      overall,
      services,
      dependencies: dependencyValidation,
      startup: this.startupDiagnostics,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Validate service dependencies
   */
  private validateServiceDependencies(services: Record<string, ServiceHealth>): Record<string, boolean> {
    const validation: Record<string, boolean> = {};

    for (const [key, dependency] of this.serviceDependencies) {
      const serviceHealth = services[key];
      
      if (dependency.required) {
        // Required services must be healthy
        validation[key] = serviceHealth?.status === 'healthy';
      } else {
        // Optional services can be degraded
        validation[key] = serviceHealth?.status !== 'unhealthy';
      }

      // Check dependency chain
      if (dependency.dependencies && dependency.dependencies.length > 0) {
        const dependenciesMet = dependency.dependencies.every(dep => 
          services[dep]?.status === 'healthy'
        );
        validation[key] = validation[key] && dependenciesMet;
      }
    }

    return validation;
  }

  /**
   * Determine overall system health
   */
  private determineOverallHealth(
    services: Record<string, ServiceHealth>, 
    dependencies: Record<string, boolean>
  ): 'healthy' | 'degraded' | 'unhealthy' {
    // Check if any required services are down
    for (const [key, dependency] of this.serviceDependencies) {
      if (dependency.required && !dependencies[key]) {
        return 'unhealthy';
      }
    }

    // Check if any services are unhealthy
    const hasUnhealthyServices = Object.values(services).some(
      service => service.status === 'unhealthy'
    );
    if (hasUnhealthyServices) {
      return 'unhealthy';
    }

    // Check if any services are degraded
    const hasDegradedServices = Object.values(services).some(
      service => service.status === 'degraded'
    );
    if (hasDegradedServices) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Add startup diagnostic
   */
  addStartupDiagnostic(diagnostic: Omit<StartupDiagnostic, 'timestamp'>): void {
    const fullDiagnostic: StartupDiagnostic = {
      ...diagnostic,
      timestamp: new Date().toISOString()
    };
    
    this.startupDiagnostics.push(fullDiagnostic);
    
    this.logger.info('Startup diagnostic added', {
      service: diagnostic.service,
      status: diagnostic.status,
      message: diagnostic.message
    });
  }

  /**
   * Get startup diagnostics
   */
  getStartupDiagnostics(): StartupDiagnostic[] {
    return [...this.startupDiagnostics];
  }

  /**
   * Clear startup diagnostics (useful for testing)
   */
  clearStartupDiagnostics(): void {
    this.startupDiagnostics = [];
  }

  /**
   * Database health check
   */
  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      await db.query('SELECT 1 as health_check');
      
      // Test table access (basic schema validation)
      await db.query('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema()');
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          connection: 'active',
          schema: 'accessible'
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          connection: 'failed'
        }
      };
    }
  }

  /**
   * Redis health check
   */
  private async checkRedisHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      if (!redisClient.isOpen) {
        return {
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: 'Redis client not connected',
          details: {
            connection: 'closed'
          }
        };
      }

      // Test basic connectivity
      await redisClient.ping();
      
      // Test read/write operations
      const testKey = 'health_check_' + Date.now();
      await redisClient.setEx(testKey, 10, 'test');
      const value = await redisClient.get(testKey);
      await redisClient.del(testKey);
      
      if (value !== 'test') {
        throw new Error('Redis read/write test failed');
      }
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          connection: 'active',
          operations: 'working'
        }
      };
    } catch (error: any) {
      return {
        status: 'degraded', // Redis is not critical
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          connection: 'failed'
        }
      };
    }
  }

  /**
   * Email service health check
   */
  private async checkEmailServiceHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Check if email configuration is present
      const hasEmailConfig = !!(
        process.env.SENDGRID_API_KEY || 
        process.env.AWS_ACCESS_KEY_ID ||
        process.env.SMTP_HOST
      );
      
      if (!hasEmailConfig) {
        return {
          status: 'degraded',
          responseTime: Date.now() - startTime,
          error: 'No email service configuration found',
          details: {
            configuration: 'missing'
          }
        };
      }
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          configuration: 'present',
          provider: process.env.PRIMARY_EMAIL_PROVIDER || 'unknown'
        }
      };
    } catch (error: any) {
      return {
        status: 'degraded',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * External APIs health check
   */
  private async checkExternalAPIsHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // This is a placeholder for external API health checks
      // In a real implementation, you would test connectivity to external services
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          apis: 'not_tested' // Placeholder
        }
      };
    } catch (error: any) {
      return {
        status: 'degraded',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Perform startup validation
   */
  async performStartupValidation(): Promise<void> {
    this.logger.info('Starting startup validation...');
    
    // Validate environment variables
    await this.validateEnvironmentVariables();
    
    // Validate database connection and schema
    await this.validateDatabaseSetup();
    
    // Validate Redis connection
    await this.validateRedisSetup();
    
    // Validate email configuration
    await this.validateEmailConfiguration();
    
    this.logger.info('Startup validation completed', {
      diagnostics: this.startupDiagnostics.length,
      errors: this.startupDiagnostics.filter(d => d.status === 'error').length,
      warnings: this.startupDiagnostics.filter(d => d.status === 'warning').length
    });
  }

  /**
   * Validate environment variables
   */
  private async validateEnvironmentVariables(): Promise<void> {
    const startTime = Date.now();
    const requiredVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'NODE_ENV'
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      this.addStartupDiagnostic({
        service: 'environment',
        status: 'error',
        message: `Missing required environment variables: ${missingVars.join(', ')}`,
        duration: Date.now() - startTime
      });
    } else {
      this.addStartupDiagnostic({
        service: 'environment',
        status: 'success',
        message: 'All required environment variables are present',
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Validate database setup
   */
  private async validateDatabaseSetup(): Promise<void> {
    const startTime = Date.now();
    
    try {
      await db.query('SELECT 1');
      
      this.addStartupDiagnostic({
        service: 'database',
        status: 'success',
        message: 'Database connection established successfully',
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.addStartupDiagnostic({
        service: 'database',
        status: 'error',
        message: 'Failed to connect to database',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Validate Redis setup
   */
  private async validateRedisSetup(): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!redisClient.isOpen) {
        this.addStartupDiagnostic({
          service: 'redis',
          status: 'warning',
          message: 'Redis client not connected - some features may be limited',
          duration: Date.now() - startTime
        });
        return;
      }
      
      await redisClient.ping();
      
      this.addStartupDiagnostic({
        service: 'redis',
        status: 'success',
        message: 'Redis connection established successfully',
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.addStartupDiagnostic({
        service: 'redis',
        status: 'warning',
        message: 'Redis connection failed - some features may be limited',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Validate email configuration
   */
  private async validateEmailConfiguration(): Promise<void> {
    const startTime = Date.now();
    
    const hasEmailConfig = !!(
      process.env.SENDGRID_API_KEY || 
      process.env.AWS_ACCESS_KEY_ID ||
      process.env.SMTP_HOST
    );
    
    if (!hasEmailConfig) {
      this.addStartupDiagnostic({
        service: 'email',
        status: 'warning',
        message: 'No email service configuration found - email features will be disabled',
        duration: Date.now() - startTime
      });
    } else {
      this.addStartupDiagnostic({
        service: 'email',
        status: 'success',
        message: `Email service configured with ${process.env.PRIMARY_EMAIL_PROVIDER || 'unknown'} provider`,
        duration: Date.now() - startTime
      });
    }
  }
}