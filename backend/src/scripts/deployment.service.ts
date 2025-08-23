import { Pool } from 'pg';
import winston from 'winston';
import { MigrationRunner } from '../database/migration-runner';
import { ComprehensiveHealthService } from '../health/comprehensive-health.service';
import { RedisClientType } from 'redis';

export interface DeploymentConfig {
  version: string;
  environment: string;
  commitHash?: string;
  buildTime?: Date;
  deployedBy?: string;
  notes?: string;
  healthCheckTimeout?: number;
  rollbackOnFailure?: boolean;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  version: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  steps: DeploymentStep[];
  healthCheckPassed: boolean;
  rollbackPerformed?: boolean;
  error?: string;
}

export interface DeploymentStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
  details?: any;
}

export class DeploymentService {
  private db: Pool;
  private redis: RedisClientType;
  private logger: winston.Logger;
  private migrationRunner: MigrationRunner;
  private healthService: ComprehensiveHealthService;

  constructor(db: Pool, redis: RedisClientType, logger: winston.Logger) {
    this.db = db;
    this.redis = redis;
    this.logger = logger;
    this.migrationRunner = new MigrationRunner(db, logger);
    this.healthService = new ComprehensiveHealthService(db, redis, logger);
  }

  /**
   * Execute a complete deployment process
   */
  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    const deploymentId = require('uuid').v4();
    const startTime = new Date();
    
    const steps: DeploymentStep[] = [
      { name: 'Pre-deployment Health Check', status: 'pending' },
      { name: 'Database Migrations', status: 'pending' },
      { name: 'Application Startup', status: 'pending' },
      { name: 'Post-deployment Health Check', status: 'pending' },
      { name: 'Deployment Verification', status: 'pending' }
    ];

    let currentStepIndex = 0;
    let healthCheckPassed = false;
    let rollbackPerformed = false;

    try {
      // Log deployment start
      await this.logDeploymentStart(deploymentId, config);
      
      this.logger.info('Starting deployment process', {
        deploymentId,
        version: config.version,
        environment: config.environment
      });

      // Step 1: Pre-deployment health check
      currentStepIndex = 0;
      steps[currentStepIndex] = await this.executeStep(
        steps[currentStepIndex],
        () => this.preDeploymentHealthCheck()
      );

      if (steps[currentStepIndex].status === 'failed') {
        throw new Error(`Pre-deployment health check failed: ${steps[currentStepIndex].error}`);
      }

      // Step 2: Run database migrations
      currentStepIndex = 1;
      steps[currentStepIndex] = await this.executeStep(
        steps[currentStepIndex],
        () => this.runDatabaseMigrations()
      );

      if (steps[currentStepIndex].status === 'failed') {
        throw new Error(`Database migrations failed: ${steps[currentStepIndex].error}`);
      }

      // Step 3: Application startup (this is handled externally, just mark as completed)
      currentStepIndex = 2;
      steps[currentStepIndex] = {
        ...steps[currentStepIndex],
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        details: { message: 'Application startup handled externally' }
      };

      // Step 4: Post-deployment health check
      currentStepIndex = 3;
      steps[currentStepIndex] = await this.executeStep(
        steps[currentStepIndex],
        () => this.postDeploymentHealthCheck(config.healthCheckTimeout || 60000)
      );

      healthCheckPassed = steps[currentStepIndex].status === 'completed';

      if (!healthCheckPassed && config.rollbackOnFailure) {
        // Attempt rollback
        this.logger.warn('Health check failed, attempting rollback', { deploymentId });
        rollbackPerformed = await this.performRollback(deploymentId);
      }

      // Step 5: Deployment verification
      currentStepIndex = 4;
      if (healthCheckPassed) {
        steps[currentStepIndex] = await this.executeStep(
          steps[currentStepIndex],
          () => this.verifyDeployment(config)
        );
      } else {
        steps[currentStepIndex] = {
          ...steps[currentStepIndex],
          status: 'skipped',
          details: { reason: 'Health check failed' }
        };
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Log deployment completion
      await this.logDeploymentCompletion(deploymentId, healthCheckPassed, rollbackPerformed);

      const result: DeploymentResult = {
        success: healthCheckPassed && !rollbackPerformed,
        deploymentId,
        version: config.version,
        startTime,
        endTime,
        duration,
        steps,
        healthCheckPassed,
        rollbackPerformed
      };

      this.logger.info('Deployment process completed', {
        deploymentId,
        success: result.success,
        duration,
        healthCheckPassed,
        rollbackPerformed
      });

      return result;

    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Mark current step as failed
      if (currentStepIndex < steps.length) {
        steps[currentStepIndex] = {
          ...steps[currentStepIndex],
          status: 'failed',
          error: error.message,
          endTime: new Date()
        };
      }

      // Attempt rollback if configured
      if (config.rollbackOnFailure) {
        this.logger.warn('Deployment failed, attempting rollback', { deploymentId, error: error.message });
        rollbackPerformed = await this.performRollback(deploymentId);
      }

      // Log deployment failure
      await this.logDeploymentFailure(deploymentId, error.message, rollbackPerformed);

      this.logger.error('Deployment process failed', {
        deploymentId,
        error: error.message,
        duration,
        rollbackPerformed
      });

      return {
        success: false,
        deploymentId,
        version: config.version,
        startTime,
        endTime,
        duration,
        steps,
        healthCheckPassed,
        rollbackPerformed,
        error: error.message
      };
    }
  }

  /**
   * Execute a deployment step with timing and error handling
   */
  private async executeStep(
    step: DeploymentStep,
    action: () => Promise<any>
  ): Promise<DeploymentStep> {
    const startTime = new Date();
    
    try {
      step.status = 'running';
      step.startTime = startTime;
      
      this.logger.info(`Executing deployment step: ${step.name}`);
      
      const result = await action();
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        ...step,
        status: 'completed',
        endTime,
        duration,
        details: result
      };
      
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      this.logger.error(`Deployment step failed: ${step.name}`, { error: error.message });
      
      return {
        ...step,
        status: 'failed',
        endTime,
        duration,
        error: error.message
      };
    }
  }

  /**
   * Pre-deployment health check
   */
  private async preDeploymentHealthCheck(): Promise<any> {
    const health = await this.healthService.getComprehensiveHealth();
    
    // Check critical services
    const criticalServices = ['database', 'redis'];
    const failedServices = criticalServices.filter(
      service => health.services[service as keyof typeof health.services]?.status === 'unhealthy'
    );
    
    if (failedServices.length > 0) {
      throw new Error(`Critical services unhealthy: ${failedServices.join(', ')}`);
    }
    
    return {
      overallStatus: health.status,
      criticalServices: criticalServices.map(service => ({
        name: service,
        status: health.services[service as keyof typeof health.services]?.status
      }))
    };
  }

  /**
   * Run database migrations
   */
  private async runDatabaseMigrations(): Promise<any> {
    const migrationResult = await this.migrationRunner.runMigrations();
    
    if (!migrationResult.success) {
      throw new Error(`Migrations failed: ${migrationResult.errors.join(', ')}`);
    }
    
    return {
      migrationsRun: migrationResult.migrationsRun.length,
      totalTime: migrationResult.totalTime,
      migrations: migrationResult.migrationsRun
    };
  }

  /**
   * Post-deployment health check with timeout
   */
  private async postDeploymentHealthCheck(timeout: number): Promise<any> {
    const startTime = Date.now();
    const maxRetries = Math.floor(timeout / 5000); // Check every 5 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const readiness = await this.healthService.getDeploymentReadiness();
        
        if (readiness.ready) {
          return {
            ready: true,
            attempt,
            totalTime: Date.now() - startTime,
            services: readiness.services
          };
        }
        
        if (attempt < maxRetries) {
          this.logger.info(`Health check attempt ${attempt}/${maxRetries} failed, retrying...`, {
            issues: readiness.issues
          });
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
      } catch (error: any) {
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    throw new Error(`Health check failed after ${maxRetries} attempts (${timeout}ms timeout)`);
  }

  /**
   * Verify deployment success
   */
  private async verifyDeployment(config: DeploymentConfig): Promise<any> {
    // Verify version is correctly deployed
    const currentVersion = process.env.APP_VERSION || process.env.npm_package_version;
    
    if (currentVersion !== config.version) {
      throw new Error(`Version mismatch: expected ${config.version}, got ${currentVersion}`);
    }
    
    // Run additional verification checks
    const health = await this.healthService.getComprehensiveHealth();
    
    return {
      versionVerified: true,
      currentVersion,
      healthStatus: health.status,
      uptime: health.uptime,
      environment: health.deployment.environment
    };
  }

  /**
   * Perform rollback to previous version
   */
  private async performRollback(deploymentId: string): Promise<boolean> {
    try {
      this.logger.info('Starting rollback process', { deploymentId });
      
      // Get previous successful deployment
      const result = await this.db.query(`
        SELECT version, commit_hash 
        FROM deployment_logs 
        WHERE status = 'completed' AND health_check_passed = true 
        AND id != $1
        ORDER BY created_at DESC 
        LIMIT 1
      `, [deploymentId]);
      
      if (result.rows.length === 0) {
        this.logger.warn('No previous successful deployment found for rollback');
        return false;
      }
      
      const previousDeployment = result.rows[0];
      
      // Attempt database rollback
      const rollbackResult = await this.migrationRunner.rollbackLastMigration();
      
      if (!rollbackResult.success) {
        this.logger.error('Database rollback failed', { error: rollbackResult.error });
      }
      
      // Log rollback
      await this.db.query(`
        UPDATE deployment_logs 
        SET status = 'rolled_back', rollback_version = $1, completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [previousDeployment.version, deploymentId]);
      
      this.logger.info('Rollback completed', {
        deploymentId,
        rolledBackTo: previousDeployment.version
      });
      
      return true;
      
    } catch (error: any) {
      this.logger.error('Rollback failed', { deploymentId, error: error.message });
      return false;
    }
  }

  /**
   * Log deployment start
   */
  private async logDeploymentStart(deploymentId: string, config: DeploymentConfig): Promise<void> {
    await this.db.query(`
      INSERT INTO deployment_logs 
      (id, version, environment, status, commit_hash, build_time, deployed_by, deployment_notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      deploymentId,
      config.version,
      config.environment,
      'started',
      config.commitHash,
      config.buildTime,
      config.deployedBy,
      config.notes
    ]);
  }

  /**
   * Log deployment completion
   */
  private async logDeploymentCompletion(
    deploymentId: string, 
    healthCheckPassed: boolean, 
    rollbackPerformed: boolean
  ): Promise<void> {
    const status = rollbackPerformed ? 'rolled_back' : 'completed';
    
    await this.db.query(`
      UPDATE deployment_logs 
      SET status = $1, health_check_passed = $2, completed_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [status, healthCheckPassed, deploymentId]);
  }

  /**
   * Log deployment failure
   */
  private async logDeploymentFailure(
    deploymentId: string, 
    error: string, 
    rollbackPerformed: boolean
  ): Promise<void> {
    const status = rollbackPerformed ? 'rolled_back' : 'failed';
    
    await this.db.query(`
      UPDATE deployment_logs 
      SET status = $1, deployment_notes = $2, completed_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [status, `Deployment failed: ${error}`, deploymentId]);
  }

  /**
   * Get deployment history
   */
  async getDeploymentHistory(limit: number = 10): Promise<any[]> {
    const result = await this.db.query(`
      SELECT * FROM deployment_logs 
      ORDER BY created_at DESC 
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  }

  /**
   * Get current deployment status
   */
  async getCurrentDeploymentStatus(): Promise<any> {
    const result = await this.db.query(`
      SELECT * FROM deployment_logs 
      WHERE status IN ('started', 'completed') 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const deployment = result.rows[0];
    const health = await this.healthService.getComprehensiveHealth();
    
    return {
      ...deployment,
      currentHealth: health.status,
      uptime: health.uptime,
      version: health.deployment.version
    };
  }
}