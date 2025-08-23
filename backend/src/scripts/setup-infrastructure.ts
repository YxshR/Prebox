#!/usr/bin/env ts-node

import { validateEnvironment } from '../config/environment-validator';
import { DatabaseService } from '../database/database.service';
import { MigrationService } from '../database/migration.service';
import { logger } from '../shared/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Complete infrastructure setup script
 * This script validates environment configuration and sets up the database
 */
async function setupInfrastructure(): Promise<void> {
  try {
    logger.info('🚀 Starting infrastructure setup...');
    
    // Step 1: Validate environment configuration
    logger.info('📋 Step 1: Validating environment configuration...');
    await validateEnvironment();
    
    // Step 2: Initialize database
    logger.info('🗄️  Step 2: Initializing database...');
    await initializeDatabase();
    
    // Step 3: Verify setup
    logger.info('✅ Step 3: Verifying setup...');
    await verifySetup();
    
    logger.info('🎉 Infrastructure setup completed successfully!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Start the development server: npm run dev');
    logger.info('2. Test authentication endpoints');
    logger.info('3. Verify SMS and email services are working');
    
  } catch (error) {
    logger.error('❌ Infrastructure setup failed:', error);
    process.exit(1);
  }
}

async function initializeDatabase(): Promise<void> {
  const databaseService = DatabaseService.getInstance();
  const migrationService = new MigrationService(databaseService);

  try {
    // Test database connection
    const isConnected = await databaseService.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }
    logger.info('✓ Database connection established');

    // Run migrations
    await migrationService.runMigrations();
    logger.info('✓ Database migrations completed');

    // Get migration status
    const status = await migrationService.getMigrationStatus();
    logger.info(`✓ Database schema ready (${status.executed.length} migrations applied)`);

  } finally {
    await databaseService.close();
  }
}

async function verifySetup(): Promise<void> {
  const databaseService = DatabaseService.getInstance();

  try {
    // Verify database tables
    const requiredTables = [
      'users', 'phone_verifications', 'email_verifications',
      'auth0_profiles', 'user_sessions', 'pricing_plans'
    ];

    for (const table of requiredTables) {
      const result = await databaseService.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      
      if (!result.rows[0].exists) {
        throw new Error(`Required table '${table}' does not exist`);
      }
    }
    logger.info('✓ All required database tables exist');

    // Check pricing plans
    const pricingResult = await databaseService.query(
      'SELECT COUNT(*) as count FROM pricing_plans WHERE active = true'
    );
    const planCount = parseInt(pricingResult.rows[0].count);
    logger.info(`✓ ${planCount} active pricing plans available`);

    // Test database performance
    const start = Date.now();
    await databaseService.query('SELECT 1');
    const responseTime = Date.now() - start;
    logger.info(`✓ Database response time: ${responseTime}ms`);

  } catch (error) {
    logger.error('Setup verification failed:', error);
    throw error;
  }
  // Note: Don't close the connection here since it's already closed in initializeDatabase
}

// Run setup if called directly
if (require.main === module) {
  setupInfrastructure();
}

export { setupInfrastructure };