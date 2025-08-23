import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import winston from 'winston';
import { ServiceHealth } from './health.service';

export interface ServiceHealthCheck {
  name: string;
  check: () => Promise<ServiceHealth>;
  critical: boolean; // Whether this service is critical for system operation
}

export interface ComprehensiveHealthResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    memory: ServiceHealth;
    disk: ServiceHealth;
    auth: ServiceHealth;
    email: ServiceHealth;
    sms: ServiceHealth;
    monitoring: ServiceHealth;
  };
  performance: {
    responseTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  deployment: {
    version: string;
    environment: string;
    buildTime?: string;
    commitHash?: string;
  };
  dependencies: {
    external: ServiceHealth[];
    internal: ServiceHealth[];
  };
}

export class ComprehensiveHealthService {
  private db: Pool;
  private redis: RedisClientType;
  private logger: winston.Logger;
  private customHealthChecks: Map<string, ServiceHealthCheck> = new Map();
  private startTime: number;

  constructor(db: Pool, redis: RedisClientType, logger: winston.Logger) {
    this.db = db;
    this.redis = redis;
    this.logger = logger;
    this.startTime = Date.now();
    this.registerDefaultHealthChecks();
  }

  /**
   * Register default health checks for all services
   */
  private registerDefaultHealthChecks(): void {
    // Authentication service health check
    this.registerHealthCheck('auth', async () => {
      try {
        // Check if auth tables exist and are accessible
        await this.db.query('SELECT COUNT(*) FROM users LIMIT 1');
        await this.db.query('SELECT COUNT(*) FROM otp_verifications WHERE created_at > NOW() - INTERVAL \'1 hour\' LIMIT 1');
        
        return {
          status: 'healthy',
          details: { message: 'Authentication service operational' }
        };
      } catch (error: any) {
        return {
          status: 'unhealthy',
          error: `Auth service error: ${error.message}`
        };
      }
    }, true);

    // Email service health check
    this.registerHealthCheck('email', async () => {
      try {
        // Check email configuration
        const emailProvider = process.env.EMAIL_PROVIDER;
        const sendgridKey = process.env.SENDGRID_API_KEY;
        
        if (!emailProvider || !sendgridKey) {
          return {
            status: 'degraded',
            error: 'Email service not configured'
          };
        }

        // Check email verification table
        await this.db.query('SELECT COUNT(*) FROM email_verifications LIMIT 1');
        
        return {
          status: 'healthy',
          details: { 
            provider: emailProvider,
            configured: true 
          }
        };
      } catch (error: any) {
        return {
          status: 'unhealthy',
          error: `Email service error: ${error.message}`
        };
      }
    }, false);

    // SMS service health check
    this.registerHealthCheck('sms', async () => {
      try {
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        const isDemoMode = process.env.DEMO_MODE === 'true';
        
        if (isDemoMode) {
          return {
            status: 'healthy',
            details: { mode: 'demo', message: 'SMS service in demo mode' }
          };
        }

        if (!twilioSid || !twilioToken) {
          return {
            status: 'degraded',
            error: 'SMS service not configured'
          };
        }

        return {
          status: 'healthy',
          details: { 
            provider: 'twilio',
            configured: true 
          }
        };
      } catch (error: any) {
        return {
          status: 'unhealthy',
          error: `SMS service error: ${error.message}`
        };
      }
    }, false);

    // Monitoring service health check
    this.registerHealthCheck('monitoring', async () => {
      try {
        // Check monitoring tables exist
        await this.db.query('SELECT COUNT(*) FROM performance_metrics LIMIT 1');
        await this.db.query('SELECT COUNT(*) FROM business_metrics LIMIT 1');
        
        return {
          status: 'healthy',
          details: { message: 'Monitoring service operational' }
        };
      } catch (error: any) {
        return {
          status: 'degraded',
          error: `Monitoring service error: ${error.message}`
        };
      }
    }, false);
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(name: string, check: () => Promise<ServiceHealth>, critical: boolean = false): void {
    this.customHealthChecks.set(name, { name, check, critical });
  }

  /**
   * Get comprehensive health status including all services
   */
  async getComprehensiveHealth(): Promise<ComprehensiveHealthResult> {
    const startTime = Date.now();
    
    // Run all health checks in parallel
    const [
      database,
      redis,
      memory,
      disk,
      ...customChecks
    ] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMemory(),
      this.checkDisk(),
      ...Array.from(this.customHealthChecks.values()).map(check => check.check())
    ]);

    // Map custom check results
    const customCheckNames = Array.from(this.customHealthChecks.keys());
    const services: any = {
      database: this.getResultValue(database),
      redis: this.getResultValue(redis),
      memory: this.getResultValue(memory),
      disk: this.getResultValue(disk)
    };

    // Add custom service results
    customChecks.forEach((result, index) => {
      const serviceName = customCheckNames[index];
      services[serviceName] = this.getResultValue(result);
    });

    // Determine overall status
    const overallStatus = this.determineOverallStatus(services);
    
    const responseTime = Date.now() - startTime;

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      performance: {
        responseTime,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      deployment: {
        version: process.env.APP_VERSION || process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        buildTime: process.env.BUILD_TIME,
        commitHash: process.env.GIT_COMMIT_HASH
      },
      dependencies: {
        external: await this.checkExternalDependencies(),
        internal: await this.checkInternalDependencies()
      }
    };
  }

  /**
   * Check external service dependencies
   */
  private async checkExternalDependencies(): Promise<ServiceHealth[]> {
    const checks: Promise<ServiceHealth>[] = [];

    // Check Auth0 if configured
    if (process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID) {
      checks.push(this.checkAuth0Health());
    }

    // Check SendGrid if configured
    if (process.env.SENDGRID_API_KEY) {
      checks.push(this.checkSendGridHealth());
    }

    // Check Twilio if configured
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      checks.push(this.checkTwilioHealth());
    }

    const results = await Promise.allSettled(checks);
    return results.map(result => this.getResultValue(result));
  }

  /**
   * Check internal service dependencies
   */
  private async checkInternalDependencies(): Promise<ServiceHealth[]> {
    const checks = [
      this.checkDatabaseConnections(),
      this.checkRedisConnections(),
      this.checkFileSystemAccess()
    ];

    const results = await Promise.allSettled(checks);
    return results.map(result => this.getResultValue(result));
  }

  /**
   * Check Auth0 service health
   */
  private async checkAuth0Health(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Simple check - just verify configuration exists
      const domain = process.env.AUTH0_DOMAIN;
      const clientId = process.env.AUTH0_CLIENT_ID;
      
      if (!domain || !clientId) {
        return {
          status: 'unhealthy',
          error: 'Auth0 configuration missing'
        };
      }

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: { service: 'auth0', configured: true }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check SendGrid service health
   */
  private async checkSendGridHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const apiKey = process.env.SENDGRID_API_KEY;
      
      if (!apiKey) {
        return {
          status: 'unhealthy',
          error: 'SendGrid API key missing'
        };
      }

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: { service: 'sendgrid', configured: true }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check Twilio service health
   */
  private async checkTwilioHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        return {
          status: 'unhealthy',
          error: 'Twilio configuration missing'
        };
      }

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: { service: 'twilio', configured: true }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check database connection pool health
   */
  private async checkDatabaseConnections(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Check connection pool status
      const poolInfo = {
        totalCount: this.db.totalCount,
        idleCount: this.db.idleCount,
        waitingCount: this.db.waitingCount
      };

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: { 
          service: 'database_pool',
          ...poolInfo
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check Redis connection health
   */
  private async checkRedisConnections(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const isConnected = this.redis.isOpen;
      
      if (!isConnected) {
        return {
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: 'Redis not connected'
        };
      }

      await this.redis.ping();
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: { service: 'redis_connection', connected: true }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check file system access
   */
  private async checkFileSystemAccess(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Check if logs directory is writable
      const logsDir = path.join(process.cwd(), 'logs');
      await fs.access(logsDir, fs.constants.W_OK);
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: { service: 'filesystem', writable: true }
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
   * Get health check for deployment readiness
   */
  async getDeploymentReadiness(): Promise<{ ready: boolean; issues: string[]; services: Record<string, ServiceHealth> }> {
    const health = await this.getComprehensiveHealth();
    const issues: string[] = [];
    const criticalServices = ['database', 'auth'];
    
    // Check critical services
    for (const serviceName of criticalServices) {
      const service = health.services[serviceName as keyof typeof health.services];
      if (service.status === 'unhealthy') {
        issues.push(`Critical service ${serviceName} is unhealthy: ${service.error}`);
      }
    }

    // Check environment configuration
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'REDIS_URL'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push(`Required environment variable ${envVar} is not set`);
      }
    }

    return {
      ready: issues.length === 0,
      issues,
      services: health.services
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      await this.db.query('SELECT 1 as health_check');
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      if (!this.redis.isOpen) {
        return {
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: 'Redis client not connected'
        };
      }

      await this.redis.ping();
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        status: 'degraded', // Redis is not critical for basic functionality
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<ServiceHealth> {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (memoryUsagePercent > 90) {
      status = 'unhealthy';
    } else if (memoryUsagePercent > 75) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        usagePercent: Math.round(memoryUsagePercent * 100) / 100,
        external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
      }
    };
  }

  /**
   * Check disk usage (basic implementation)
   */
  private async checkDisk(): Promise<ServiceHealth> {
    // Basic disk check - in production you might want to use a proper disk usage library
    try {
      const fs = require('fs');
      const stats = fs.statSync('./');
      
      return {
        status: 'healthy',
        details: {
          available: 'N/A - Basic check only'
        }
      };
    } catch (error: any) {
      return {
        status: 'degraded',
        error: error.message
      };
    }
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(services: any): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(services).map((service: any) => service.status);
    
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    }
    
    if (statuses.includes('degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Extract value from Promise.allSettled result
   */
  private getResultValue(result: PromiseSettledResult<ServiceHealth>): ServiceHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'unhealthy',
        error: result.reason?.message || 'Unknown error'
      };
    }
  }

  /**
   * Check database connection specifically for connection diagnostics
   */
  async checkDatabaseConnection(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.db.query('SELECT 1 as connection_test, NOW() as server_time');
      
      return {
        healthy: true,
        responseTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check Redis connection specifically for connection diagnostics
   */
  async checkRedisConnection(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      if (!this.redis.isOpen) {
        return {
          healthy: false,
          responseTime: Date.now() - startTime,
          error: 'Redis client not connected'
        };
      }

      await this.redis.ping();
      
      return {
        healthy: true,
        responseTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }
}