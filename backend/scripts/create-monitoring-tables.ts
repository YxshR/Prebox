#!/usr/bin/env ts-node

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import winston from 'winston';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Initialize database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function createMonitoringTables() {
  try {
    logger.info('🚀 Creating monitoring tables...');
    
    // Read the monitoring migration file
    const migrationPath = join(__dirname, '../src/database/migrations/008_create_auth_monitoring_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await db.query(migrationSQL);
    
    logger.info('✅ Monitoring tables created successfully!');
    
    // Verify tables were created
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('auth_events', 'performance_metrics', 'business_metrics', 'error_events', 'deployment_logs')
      ORDER BY table_name
    `);
    
    logger.info('📊 Created tables:', result.rows.map(row => row.table_name));
    
  } catch (error: any) {
    logger.error('❌ Failed to create monitoring tables:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await createMonitoringTables();
    console.log('✅ Monitoring tables setup completed successfully!');
  } catch (error: any) {
    console.error('💥 Setup failed:', error.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  logger.info('Process interrupted by user');
  await db.end();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('Process terminated');
  await db.end();
  process.exit(1);
});

// Run setup
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});