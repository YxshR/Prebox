#!/usr/bin/env ts-node

import { Pool } from 'pg';
import { createClient } from 'redis';
import winston from 'winston';
import { DeploymentService, DeploymentConfig } from '../src/scripts/deployment.service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
      filename: 'logs/deployment.log'
    })
  ]
});

// Initialize database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

// Initialize Redis connection
const redis = createClient({
  url: process.env.REDIS_URL
});

async function main() {
  try {
    // Connect to Redis
    await redis.connect();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const version = args[0] || process.env.APP_VERSION || 'unknown';
    const environment = args[1] || process.env.NODE_ENV || 'development';
    const commitHash = args[2] || process.env.GIT_COMMIT_HASH;
    const deployedBy = args[3] || process.env.DEPLOYED_BY || 'automated';
    const notes = args[4] || 'Automated deployment';

    logger.info('Starting deployment process', {
      version,
      environment,
      commitHash,
      deployedBy
    });

    // Create deployment configuration
    const config: DeploymentConfig = {
      version,
      environment,
      commitHash,
      buildTime: new Date(),
      deployedBy,
      notes,
      healthCheckTimeout: 120000, // 2 minutes
      rollbackOnFailure: environment === 'production'
    };

    // Initialize deployment service
    const deploymentService = new DeploymentService(db, redis, logger);

    // Execute deployment
    const result = await deploymentService.deploy(config);

    if (result.success) {
      logger.info('Deployment completed successfully', {
        deploymentId: result.deploymentId,
        version: result.version,
        duration: result.duration,
        healthCheckPassed: result.healthCheckPassed
      });
      
      console.log('✅ Deployment successful!');
      console.log(`📦 Version: ${result.version}`);
      console.log(`⏱️  Duration: ${result.duration}ms`);
      console.log(`🏥 Health Check: ${result.healthCheckPassed ? 'PASSED' : 'FAILED'}`);
      
      process.exit(0);
    } else {
      logger.error('Deployment failed', {
        deploymentId: result.deploymentId,
        error: result.error,
        rollbackPerformed: result.rollbackPerformed
      });
      
      console.error('❌ Deployment failed!');
      console.error(`📦 Version: ${result.version}`);
      console.error(`❗ Error: ${result.error}`);
      console.error(`🔄 Rollback: ${result.rollbackPerformed ? 'PERFORMED' : 'NOT PERFORMED'}`);
      
      process.exit(1);
    }

  } catch (error: any) {
    logger.error('Deployment script failed', { error: error.message });
    console.error('💥 Deployment script failed:', error.message);
    process.exit(1);
  } finally {
    await redis.quit();
    await db.end();
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  logger.info('Deployment interrupted by user');
  await redis.quit();
  await db.end();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('Deployment terminated');
  await redis.quit();
  await db.end();
  process.exit(1);
});

// Run deployment
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});