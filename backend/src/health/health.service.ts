import { Request, Response } from 'express';
import db from '../config/database';
import redisClient from '../config/redis';

export interface HealthCheckResult {
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
  };
  performance: {
    responseTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: any;
}

export class HealthService {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Comprehensive health check
   */
  async getHealthStatus(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    const [database, redis, memory, disk] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMemory(),
      this.checkDisk()
    ]);

    const services = {
      database: this.getResultValue(database),
      redis: this.getResultValue(redis),
      memory: this.getResultValue(memory),
      disk: this.getResultValue(disk)
    };

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
      }
    };
  }

  /**
   * Simple health check for load balancers
   */
  async getSimpleHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      // In demo mode, skip database check
      if (process.env.DEMO_MODE === 'true') {
        return {
          status: 'OK',
          timestamp: new Date().toISOString()
        };
      }
      
      // Quick database ping with timeout for production
      const dbPromise = db.query('SELECT 1');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 3000)
      );
      
      await Promise.race([dbPromise, timeoutPromise]);
      
      return {
        status: 'OK',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // In demo mode, still return OK even if database fails
      if (process.env.DEMO_MODE === 'true') {
        return {
          status: 'OK',
          timestamp: new Date().toISOString()
        };
      }
      throw new Error('Service unhealthy');
    }
  }

  /**
   * Readiness check - determines if service is ready to accept traffic
   */
  async getReadinessStatus(): Promise<{ ready: boolean; services: any }> {
    const [database, redis] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis()
    ]);

    const services = {
      database: this.getResultValue(database),
      redis: this.getResultValue(redis)
    };

    const ready = services.database.status === 'healthy' && 
                  services.redis.status !== 'unhealthy';

    return { ready, services };
  }

  /**
   * Liveness check - determines if service is alive
   */
  async getLivenessStatus(): Promise<{ alive: boolean; uptime: number }> {
    return {
      alive: true,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Check database connection specifically for connection diagnostics
   */
  async checkDatabaseConnection(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await db.query('SELECT 1 as connection_test, NOW() as server_time');
      
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
      if (!redisClient.isOpen) {
        return {
          healthy: false,
          responseTime: Date.now() - startTime,
          error: 'Redis client not connected'
        };
      }

      await redisClient.ping();
      
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
   * Check database connectivity
   */
  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      await db.query('SELECT 1 as health_check');
      
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
      if (!redisClient.isOpen) {
        return {
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: 'Redis client not connected'
        };
      }

      await redisClient.ping();
      
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
}

export const healthService = new HealthService();