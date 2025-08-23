#!/usr/bin/env ts-node

import { DatabaseService } from './database.service';
import { MigrationService } from './migration.service';
import { logger } from '../shared/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Initialize database with schema and seed data
 */
async function initializeDatabase(): Promise<void> {
  const databaseService = DatabaseService.getInstance();
  const migrationService = new MigrationService(databaseService);

  try {
    logger.info('Starting database initialization...');

    // Test database connection
    const isConnected = await databaseService.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }

    // Run migrations
    await migrationService.runMigrations();

    // Get migration status
    const status = await migrationService.getMigrationStatus();
    logger.info('Migration status:', {
      executed: status.executed.length,
      pending: status.pending.length,
      total: status.total
    });

    logger.info('Database initialization completed successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    await databaseService.close();
  }
}

/**
 * Check database status without running migrations
 */
async function checkDatabaseStatus(): Promise<void> {
  const databaseService = DatabaseService.getInstance();
  const migrationService = new MigrationService(databaseService);

  try {
    logger.info('Checking database status...');

    // Test connection
    const isConnected = await databaseService.testConnection();
    logger.info('Database connection:', isConnected ? 'OK' : 'FAILED');

    if (isConnected) {
      // Get database stats
      const stats = await databaseService.getStats();
      logger.info('Connection pool stats:', stats);

      // Get migration status
      await migrationService.initializeMigrationsTable();
      const status = await migrationService.getMigrationStatus();
      logger.info('Migration status:', {
        executed: status.executed.length,
        pending: status.pending.length,
        total: status.total
      });

      if (status.pending.length > 0) {
        logger.warn('Pending migrations found:', status.pending);
      }
    }
  } catch (error) {
    logger.error('Database status check failed:', error);
  } finally {
    await databaseService.close();
  }
}

// CLI interface
const command = process.argv[2];

switch (command) {
  case 'init':
    initializeDatabase();
    break;
  case 'status':
    checkDatabaseStatus();
    break;
  case 'migrate':
    initializeDatabase();
    break;
  default:
    console.log('Usage: ts-node init-database.ts [init|status|migrate]');
    console.log('  init     - Initialize database with migrations');
    console.log('  status   - Check database connection and migration status');
    console.log('  migrate  - Run pending migrations');
    process.exit(1);
}