import { DatabaseService } from '../database/database.service';
import { MigrationService } from '../database/migration.service';
import { logger } from '../shared/logger';

export interface DatabaseHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  connection: boolean;
  migrations: {
    executed: number;
    pending: number;
    total: number;
  };
  performance: {
    connectionTime: number;
    queryTime: number;
  };
  poolStats: {
    totalConnections: number;
    idleConnections: number;
    waitingCount: number;
  };
  lastChecked: Date;
  errors?: string[];
}

export class DatabaseHealthService {
  private databaseService: DatabaseService;
  private migrationService: MigrationService;

  constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.migrationService = new MigrationService(this.databaseService);
  }

  /**
   * Perform comprehensive database health check
   */
  async checkHealth(): Promise<DatabaseHealthStatus> {
    const startTime = Date.now();
    const errors: string[] = [];
    let connectionStatus = false;
    let connectionTime = 0;
    let queryTime = 0;

    // Test database connection
    try {
      const connectionStart = Date.now();
      connectionStatus = await this.databaseService.testConnection();
      connectionTime = Date.now() - connectionStart;

      if (!connectionStatus) {
        errors.push('Database connection failed');
      }
    } catch (error) {
      errors.push(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      connectionStatus = false;
    }

    // Test query performance
    try {
      const queryStart = Date.now();
      await this.databaseService.query('SELECT 1 as test');
      queryTime = Date.now() - queryStart;
    } catch (error) {
      errors.push(`Query error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      queryTime = -1;
    }

    // Get migration status
    let migrationStatus = { executed: 0, pending: 0, total: 0 };
    try {
      if (connectionStatus) {
        await this.migrationService.initializeMigrationsTable();
        migrationStatus = await this.migrationService.getMigrationStatus();
      }
    } catch (error) {
      errors.push(`Migration check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Get pool statistics
    let poolStats = { totalConnections: 0, idleConnections: 0, waitingCount: 0 };
    try {
      poolStats = await this.databaseService.getStats();
    } catch (error) {
      errors.push(`Pool stats error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Determine overall health status
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (!connectionStatus || errors.length > 0) {
      status = 'unhealthy';
    } else if (migrationStatus.pending > 0 || queryTime > 1000 || connectionTime > 2000) {
      status = 'degraded';
    }

    const healthStatus: DatabaseHealthStatus = {
      status,
      connection: connectionStatus,
      migrations: migrationStatus,
      performance: {
        connectionTime,
        queryTime,
      },
      poolStats,
      lastChecked: new Date(),
    };

    if (errors.length > 0) {
      healthStatus.errors = errors;
    }

    // Log health status
    if (status === 'unhealthy') {
      logger.error('Database health check failed', healthStatus);
    } else if (status === 'degraded') {
      logger.warn('Database health degraded', healthStatus);
    } else {
      logger.info('Database health check passed', {
        connectionTime,
        queryTime,
        migrations: migrationStatus,
      });
    }

    return healthStatus;
  }

  /**
   * Quick connection test
   */
  async quickCheck(): Promise<boolean> {
    try {
      return await this.databaseService.testConnection();
    } catch (error) {
      logger.error('Database quick check failed:', error);
      return false;
    }
  }

  /**
   * Check if database schema is up to date
   */
  async checkMigrations(): Promise<{
    upToDate: boolean;
    executed: number;
    pending: number;
    pendingMigrations: string[];
  }> {
    try {
      await this.migrationService.initializeMigrationsTable();
      const status = await this.migrationService.getMigrationStatus();
      
      return {
        upToDate: status.pending.length === 0,
        executed: status.executed.length,
        pending: status.pending.length,
        pendingMigrations: status.pending,
      };
    } catch (error) {
      logger.error('Migration check failed:', error);
      throw error;
    }
  }

  /**
   * Get database performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    avgConnectionTime: number;
    avgQueryTime: number;
    poolUtilization: number;
    activeConnections: number;
  }> {
    const iterations = 5;
    let totalConnectionTime = 0;
    let totalQueryTime = 0;

    // Run multiple tests to get average
    for (let i = 0; i < iterations; i++) {
      const connectionStart = Date.now();
      await this.databaseService.testConnection();
      totalConnectionTime += Date.now() - connectionStart;

      const queryStart = Date.now();
      await this.databaseService.query('SELECT NOW()');
      totalQueryTime += Date.now() - queryStart;
    }

    const poolStats = await this.databaseService.getStats();
    const poolUtilization = poolStats.totalConnections > 0 
      ? ((poolStats.totalConnections - poolStats.idleConnections) / poolStats.totalConnections) * 100 
      : 0;

    return {
      avgConnectionTime: totalConnectionTime / iterations,
      avgQueryTime: totalQueryTime / iterations,
      poolUtilization,
      activeConnections: poolStats.totalConnections - poolStats.idleConnections,
    };
  }
}