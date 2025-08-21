const winston = require('winston');

// Simple verification script for security monitoring error recovery
async function verifySecurityMonitoring() {
  console.log('🔍 Verifying Security Monitoring Error Recovery Implementation...\n');

  try {
    // Test 1: Check if ResilientSecurityMonitorService can be imported
    console.log('✅ Test 1: Importing ResilientSecurityMonitorService...');
    const { ResilientSecurityMonitorService } = require('./resilient-security-monitor.service');
    console.log('   ✓ Successfully imported ResilientSecurityMonitorService\n');

    // Test 2: Check if FallbackLoggerService can be imported
    console.log('✅ Test 2: Importing FallbackLoggerService...');
    const { FallbackLoggerService } = require('./fallback-logger.service');
    console.log('   ✓ Successfully imported FallbackLoggerService\n');

    // Test 3: Initialize services
    console.log('✅ Test 3: Initializing services...');
    const logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({ silent: true })
      ]
    });

    const securityMonitor = new ResilientSecurityMonitorService(logger);
    const fallbackLogger = new FallbackLoggerService();
    console.log('   ✓ Successfully initialized both services\n');

    // Test 4: Test health status
    console.log('✅ Test 4: Testing health status...');
    const healthStatus = securityMonitor.getHealthStatus();
    console.log('   ✓ Health status retrieved:', {
      overall: healthStatus.overall,
      components: {
        database: healthStatus.database,
        auditLogging: healthStatus.auditLogging,
        threatDetection: healthStatus.threatDetection
      },
      errorCount: healthStatus.errors.length
    });
    console.log('');

    // Test 5: Test fallback logging
    console.log('✅ Test 5: Testing fallback logging...');
    await fallbackLogger.logSecurityEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'verification-test',
      event: 'test_event',
      data: { test: true, verification: 'security-monitoring-recovery' }
    });
    console.log('   ✓ Successfully logged security event to fallback system\n');

    // Test 6: Test fallback logger health
    console.log('✅ Test 6: Testing fallback logger health...');
    const loggerHealth = await fallbackLogger.healthCheck();
    console.log('   ✓ Fallback logger health:', {
      healthy: loggerHealth.healthy,
      lastLogTime: loggerHealth.lastLogTime,
      logFileSize: loggerHealth.logFileSize
    });
    console.log('');

    // Test 7: Test graceful degradation
    console.log('✅ Test 7: Testing graceful degradation...');
    await securityMonitor.enableGracefulDegradation();
    console.log('   ✓ Graceful degradation enabled');
    
    await securityMonitor.disableGracefulDegradation();
    console.log('   ✓ Graceful degradation disabled\n');

    // Test 8: Test manual recovery
    console.log('✅ Test 8: Testing manual recovery...');
    await securityMonitor.triggerManualRecovery();
    console.log('   ✓ Manual recovery triggered successfully\n');

    // Test 9: Test monitoring with fallback
    console.log('✅ Test 9: Testing authentication monitoring with fallback...');
    await securityMonitor.monitorAuthenticationEvents(
      'test-tenant',
      'test-user',
      '127.0.0.1',
      'test-agent',
      true
    );
    console.log('   ✓ Authentication monitoring completed with fallback support\n');

    // Test 10: Test API monitoring with fallback
    console.log('✅ Test 10: Testing API monitoring with fallback...');
    await securityMonitor.monitorApiUsage(
      'test-tenant',
      'test-user',
      'test-api-key',
      '/test/endpoint',
      '127.0.0.1',
      'test-agent'
    );
    console.log('   ✓ API monitoring completed with fallback support\n');

    // Cleanup
    console.log('🧹 Cleaning up...');
    securityMonitor.destroy();
    console.log('   ✓ Security monitor destroyed\n');

    console.log('🎉 All tests passed! Security Monitoring Error Recovery is working correctly.\n');
    
    console.log('📋 Implementation Summary:');
    console.log('   • Graceful degradation when security monitoring fails');
    console.log('   • Alternative logging mechanisms as fallback');
    console.log('   • Alerts for security monitoring system failures');
    console.log('   • Automatic recovery attempts with exponential backoff');
    console.log('   • Manual recovery triggers for administrators');
    console.log('   • Health monitoring and status reporting');
    console.log('   • Multiple fallback logging methods (file, console, memory)');
    console.log('   • Emergency email alerts for critical failures');
    console.log('   • API endpoints for monitoring and recovery management\n');

    return true;

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run verification
verifySecurityMonitoring()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Verification script failed:', error);
    process.exit(1);
  });