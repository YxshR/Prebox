#!/usr/bin/env ts-node

import { Pool } from 'pg';
import winston from 'winston';
import { AuthMonitoringService } from '../src/monitoring/auth-monitoring.service';
import { MonitoringService } from '../src/monitoring/monitoring.service';
import { ComprehensiveHealthService } from '../src/health/comprehensive-health.service';
import db from '../src/config/database';
import redisClient from '../src/config/redis';
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

async function testMonitoring() {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    
    logger.info('🧪 Testing monitoring services...');
    
    // Initialize services
    const monitoringService = new MonitoringService(db, redisClient, logger);
    const authMonitoringService = new AuthMonitoringService(db, redisClient, logger, monitoringService);
    const healthService = new ComprehensiveHealthService(db, redisClient, logger);
    
    // Test 1: Record auth event
    logger.info('📝 Test 1: Recording authentication event...');
    await authMonitoringService.recordAuthEvent({
      eventType: 'login_attempt',
      email: 'test@example.com',
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      method: 'email_password',
      success: true,
      responseTime: 150
    });
    logger.info('✅ Auth event recorded successfully');
    
    // Test 2: Record performance metric
    logger.info('📝 Test 2: Recording performance metric...');
    await monitoringService.recordPerformanceMetric({
      endpoint: '/api/auth/login',
      method: 'POST',
      statusCode: 200,
      responseTime: 150,
      timestamp: new Date()
    });
    logger.info('✅ Performance metric recorded successfully');
    
    // Test 3: Record business metric
    logger.info('📝 Test 3: Recording business metric...');
    await monitoringService.recordBusinessMetric({
      name: 'test_metric',
      value: 1,
      timestamp: new Date(),
      metadata: { test: true }
    });
    logger.info('✅ Business metric recorded successfully');
    
    // Test 4: Get real-time stats
    logger.info('📝 Test 4: Getting real-time stats...');
    const stats = await authMonitoringService.getRealTimeStats();
    logger.info('📊 Real-time stats:', stats);
    
    // Test 5: Health check
    logger.info('📝 Test 5: Running comprehensive health check...');
    const health = await healthService.getComprehensiveHealth();
    logger.info('🏥 Health status:', health.status);
    logger.info('🏥 Services:', Object.keys(health.services).map(key => `${key}: ${health.services[key as keyof typeof health.services].status}`));
    
    // Test 6: Get auth metrics
    logger.info('📝 Test 6: Getting auth metrics...');
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (24 * 60 * 60 * 1000)); // Last 24 hours
    const metrics = await authMonitoringService.getAuthMetrics(startTime, endTime);
    logger.info('📊 Auth metrics:', {
      totalLogins: metrics.totalLogins,
      successfulLogins: metrics.successfulLogins,
      errorRate: metrics.errorRate,
      averageResponseTime: metrics.averageResponseTime
    });
    
    logger.info('✅ All monitoring tests passed!');
    
  } catch (error: any) {
    logger.error('❌ Monitoring test failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await testMonitoring();
    console.log('✅ Monitoring system test completed successfully!');
  } catch (error: any) {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  } finally {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  logger.info('Test interrupted by user');
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('Test terminated');
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(1);
});

// Run test
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});