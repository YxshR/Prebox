#!/usr/bin/env ts-node

import { Pool } from 'pg';
import winston from 'winston';
import { MigrationRunner } from '../src/database/migration-runner';
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
      filename: 'logs/migrations.log'
    })
  ]
});

// Initialize database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    const command = process.argv[2] || 'run';
    
    logger.info('Starting migration process', { command });
    
    const migrationRunner = new MigrationRunner(db, logger);
    
    switch (command) {
      case 'run':
        await runMigrations(migrationRunner);
        break;
      case 'status':
        await showMigrationStatus(migrationRunner);
        break;
      case 'rollback':
        await rollbackMigration(migrationRunner);
        break;
      default:
        console.error('Unknown command. Use: run, status, or rollback');
        process.exit(1);
    }
    
  } catch (error: any) {
    logger.error('Migration process failed', { error: error.message });
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

async function runMigrations(migrationRunner: MigrationRunner) {
  console.log('🚀 Running database migrations...');
  
  const result = await migrationRunner.runMigrations();
  
  if (result.success) {
    console.log('✅ Migrations completed successfully!');
    console.log(`📊 Migrations run: ${result.migrationsRun.length}`);
    console.log(`⏱️  Total time: ${result.totalTime}ms`);
    
    if (result.migrationsRun.length > 0) {
      console.log('📝 Executed migrations:');
      result.migrationsRun.forEach(migration => {
        console.log(`   - ${migration}`);
      });
    } else {
      console.log('📝 No pending migrations found');
    }
  } else {
    console.error('❌ Migrations failed!');
    console.error(`📊 Migrations run: ${result.migrationsRun.length}`);
    console.error(`❗ Errors: ${result.errors.length}`);
    
    result.errors.forEach(error => {
      console.error(`   - ${error}`);
    });
    
    process.exit(1);
  }
}

async function showMigrationStatus(migrationRunner: MigrationRunner) {
  console.log('📊 Migration Status:');
  
  const status = await migrationRunner.getMigrationStatus();
  
  console.log(`   Total migrations: ${status.totalMigrations}`);
  console.log(`   Executed: ${status.executedMigrations}`);
  console.log(`   Pending: ${status.pendingMigrations}`);
  
  if (status.lastMigration) {
    console.log(`   Last migration: ${status.lastMigration.filename}`);
    console.log(`   Executed at: ${status.lastMigration.executedAt}`);
  }
  
  if (status.pendingMigrations > 0) {
    console.log('⚠️  There are pending migrations. Run "npm run db:migrate" to execute them.');
  } else {
    console.log('✅ All migrations are up to date.');
  }
}

async function rollbackMigration(migrationRunner: MigrationRunner) {
  console.log('🔄 Rolling back last migration...');
  
  const result = await migrationRunner.rollbackLastMigration();
  
  if (result.success) {
    console.log('✅ Rollback completed successfully!');
    console.log(`📝 Rolled back: ${result.rolledBack}`);
  } else {
    console.error('❌ Rollback failed!');
    console.error(`❗ Error: ${result.error}`);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  logger.info('Migration process interrupted by user');
  await db.end();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('Migration process terminated');
  await db.end();
  process.exit(1);
});

// Run migrations
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});