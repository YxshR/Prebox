#!/usr/bin/env ts-node

import { DatabaseService } from './database.service';
import { logger } from '../shared/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Comprehensive database health check
 */
async function performHealthCheck(): Promise<void> {
  const databaseService = DatabaseService.getInstance();

  try {
    logger.info('Starting database health check...');

    // Test basic connection
    const isConnected = await databaseService.testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }

    // Check if all required tables exist
    const requiredTables = [
      'users',
      'phone_verifications', 
      'email_verifications',
      'auth0_profiles',
      'user_sessions',
      'pricing_plans',
      'migrations'
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
      logger.info(`✓ Table '${table}' exists`);
    }

    // Check if pricing plans are populated
    const pricingPlansResult = await databaseService.query(
      'SELECT COUNT(*) as count FROM pricing_plans WHERE active = true'
    );
    const activePlansCount = parseInt(pricingPlansResult.rows[0].count);
    
    if (activePlansCount === 0) {
      logger.warn('No active pricing plans found');
    } else {
      logger.info(`✓ Found ${activePlansCount} active pricing plans`);
    }

    // Test database performance with a simple query
    const start = Date.now();
    await databaseService.query('SELECT 1 as test');
    const queryTime = Date.now() - start;
    
    if (queryTime > 1000) {
      logger.warn(`Slow database response: ${queryTime}ms`);
    } else {
      logger.info(`✓ Database response time: ${queryTime}ms`);
    }

    // Check connection pool stats
    const stats = await databaseService.getStats();
    logger.info('✓ Connection pool stats:', stats);

    logger.info('Database health check completed successfully');
    
  } catch (error) {
    logger.error('Database health check failed:', error);
    process.exit(1);
  } finally {
    await databaseService.close();
  }
}

// Run health check
performHealthCheck();