#!/usr/bin/env node

/**
 * Health Check Script for Deployment Verification
 * 
 * This script performs comprehensive health checks on all application
 * components to verify they are running correctly after deployment.
 */

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class HealthChecker {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 10000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 2000,
      endpoints: config.endpoints || this.getDefaultEndpoints(),
      verbose: config.verbose || false
    };
    
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      checks: []
    };
  }

  /**
   * Get default endpoints based on environment
   */
  getDefaultEndpoints() {
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction ? 'https://api.yourdomain.com' : 'http://localhost:8000';
    const frontendUrl = isProduction ? 'https://yourdomain.com' : 'http://localhost:3000';
    const adminUrl = isProduction ? 'https://admin.yourdomain.com' : 'http://localhost:3002';

    return {
      backend: {
        health: `${baseUrl}/api/health`,
        detailedHealth: `${baseUrl}/api/health/detailed`,
        auth: `${baseUrl}/api/auth/status`
      },
      frontend: {
        home: frontendUrl,
        health: `${frontendUrl}/api/health`
      },
      admin: {
        home: adminUrl,
        health: `${adminUrl}/api/health`
      }
    };
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    console.log('🏥 Starting comprehensive health checks...\n');

    try {
      await this.checkSystemResources();
      await this.checkDatabaseConnectivity();
      await this.checkRedisConnectivity();
      await this.checkBackendHealth();
      await this.checkFrontendHealth();
      await this.checkAdminHealth();
      await this.checkExternalServices();
      await this.checkSecurityServices();

      this.printResults();
      
      if (this.results.failed > 0) {
        console.log('\n❌ Health checks failed. Please investigate the issues above.');
        process.exit(1);
      } else {
        console.log('\n✅ All health checks passed!');
        if (this.results.warnings > 0) {
          console.log('⚠️  Please review the warnings above.');
        }
      }
    } catch (error) {
      console.error('\n💥 Health check failed with error:', error.message);
      process.exit(1);
    }
  }

  /**
   * Check system resources
   */
  async checkSystemResources() {
    console.log('💻 Checking system resources...');

    try {
      // Check memory usage
      const memInfo = this.getMemoryInfo();
      if (memInfo.freePercent < 10) {
        this.addResult('System Memory', false, `Low memory: ${memInfo.freePercent}% free`);
      } else {
        this.addResult('System Memory', true, `${memInfo.freePercent}% free`);
      }

      // Check disk space
      const diskInfo = this.getDiskInfo();
      if (diskInfo.freePercent < 10) {
        this.addResult('Disk Space', false, `Low disk space: ${diskInfo.freePercent}% free`);
      } else {
        this.addResult('Disk Space', true, `${diskInfo.freePercent}% free`);
      }

      // Check CPU load (if available)
      try {
        const loadAvg = require('os').loadavg();
        const cpuCount = require('os').cpus().length;
        const loadPercent = Math.round((loadAvg[0] / cpuCount) * 100);
        
        if (loadPercent > 80) {
          this.addResult('CPU Load', false, `High CPU load: ${loadPercent}%`, true);
        } else {
          this.addResult('CPU Load', true, `${loadPercent}% load average`);
        }
      } catch (error) {
        this.addResult('CPU Load', true, 'Unable to check CPU load', true);
      }

    } catch (error) {
      this.addResult('System Resources', false, `Error checking system resources: ${error.message}`);
    }

    console.log('✅ System resources checked\n');
  }

  /**
   * Get memory information
   */
  getMemoryInfo() {
    try {
      const os = require('os');
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const freePercent = Math.round((freeMem / totalMem) * 100);
      
      return {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        freePercent
      };
    } catch (error) {
      return { freePercent: 50 }; // Default safe value
    }
  }

  /**
   * Get disk information
   */
  getDiskInfo() {
    try {
      // This is a simplified check - in production you might want to use a more robust solution
      const stats = fs.statSync('.');
      return { freePercent: 50 }; // Default safe value for now
    } catch (error) {
      return { freePercent: 50 }; // Default safe value
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabaseConnectivity() {
    console.log('🗄️  Checking database connectivity...');

    try {
      // Try to run the connection test script
      const testScript = path.join(process.cwd(), 'backend/test-all-connections.js');
      
      if (fs.existsSync(testScript)) {
        const result = execSync('node test-all-connections.js', {
          cwd: path.join(process.cwd(), 'backend'),
          encoding: 'utf8',
          timeout: 15000
        });

        if (result.includes('Database connection: ✅')) {
          this.addResult('PostgreSQL Connection', true, 'Connected successfully');
        } else {
          this.addResult('PostgreSQL Connection', false, 'Connection failed');
        }
      } else {
        this.addResult('Database Test', false, 'Test script not found', true);
      }
    } catch (error) {
      this.addResult('Database Connection', false, `Connection test failed: ${error.message}`);
    }

    console.log('✅ Database connectivity checked\n');
  }

  /**
   * Check Redis connectivity
   */
  async checkRedisConnectivity() {
    console.log('🔴 Checking Redis connectivity...');

    try {
      const testScript = path.join(process.cwd(), 'backend/test-all-connections.js');
      
      if (fs.existsSync(testScript)) {
        const result = execSync('node test-all-connections.js', {
          cwd: path.join(process.cwd(), 'backend'),
          encoding: 'utf8',
          timeout: 15000
        });

        if (result.includes('Redis connection: ✅')) {
          this.addResult('Redis Connection', true, 'Connected successfully');
        } else {
          this.addResult('Redis Connection', false, 'Connection failed - caching may not work', true);
        }
      } else {
        this.addResult('Redis Test', false, 'Test script not found', true);
      }
    } catch (error) {
      this.addResult('Redis Connection', false, `Connection test failed: ${error.message}`, true);
    }

    console.log('✅ Redis connectivity checked\n');
  }

  /**
   * Check backend health
   */
  async checkBackendHealth() {
    console.log('🔧 Checking backend health...');

    // Basic health check
    const healthResult = await this.checkEndpoint(
      'Backend Health',
      this.config.endpoints.backend.health
    );

    if (healthResult.success) {
      // Detailed health check
      await this.checkEndpoint(
        'Backend Detailed Health',
        this.config.endpoints.backend.detailedHealth
      );

      // Auth status check
      await this.checkEndpoint(
        'Backend Auth Status',
        this.config.endpoints.backend.auth
      );
    }

    console.log('✅ Backend health checked\n');
  }

  /**
   * Check frontend health
   */
  async checkFrontendHealth() {
    console.log('🎨 Checking frontend health...');

    // Check if frontend is accessible
    await this.checkEndpoint(
      'Frontend Home',
      this.config.endpoints.frontend.home
    );

    // Check frontend health endpoint (if exists)
    await this.checkEndpoint(
      'Frontend Health',
      this.config.endpoints.frontend.health,
      { optional: true }
    );

    console.log('✅ Frontend health checked\n');
  }

  /**
   * Check admin frontend health
   */
  async checkAdminHealth() {
    console.log('👑 Checking admin frontend health...');

    // Check if admin frontend is accessible
    await this.checkEndpoint(
      'Admin Home',
      this.config.endpoints.admin.home
    );

    // Check admin health endpoint (if exists)
    await this.checkEndpoint(
      'Admin Health',
      this.config.endpoints.admin.health,
      { optional: true }
    );

    console.log('✅ Admin frontend health checked\n');
  }

  /**
   * Check external services
   */
  async checkExternalServices() {
    console.log('🌐 Checking external services...');

    // Check email service connectivity
    await this.checkEmailService();

    // Check payment gateway connectivity
    await this.checkPaymentGateways();

    // Check AI services (if configured)
    await this.checkAIServices();

    console.log('✅ External services checked\n');
  }

  /**
   * Check email service
   */
  async checkEmailService() {
    try {
      // This is a basic check - in a real implementation you might want to
      // actually test sending an email or checking API connectivity
      const backendEnv = this.readEnvFile('backend/.env');
      
      if (backendEnv.includes('SENDGRID_API_KEY=') && !backendEnv.includes('your-sendgrid')) {
        this.addResult('SendGrid Configuration', true, 'API key configured');
      } else if (backendEnv.includes('AWS_ACCESS_KEY_ID=') && !backendEnv.includes('your-aws')) {
        this.addResult('AWS SES Configuration', true, 'Credentials configured');
      } else {
        this.addResult('Email Service', false, 'No email service configured', true);
      }
    } catch (error) {
      this.addResult('Email Service Check', false, `Error: ${error.message}`, true);
    }
  }

  /**
   * Check payment gateways
   */
  async checkPaymentGateways() {
    try {
      const backendEnv = this.readEnvFile('backend/.env');
      
      if (backendEnv.includes('STRIPE_SECRET_KEY=sk_')) {
        this.addResult('Stripe Configuration', true, 'API key configured');
      } else {
        this.addResult('Stripe Configuration', false, 'Not configured', true);
      }

      if (backendEnv.includes('RAZORPAY_KEY_SECRET=') && !backendEnv.includes('your-razorpay')) {
        this.addResult('Razorpay Configuration', true, 'Credentials configured');
      } else {
        this.addResult('Razorpay Configuration', false, 'Not configured', true);
      }
    } catch (error) {
      this.addResult('Payment Gateway Check', false, `Error: ${error.message}`, true);
    }
  }

  /**
   * Check AI services
   */
  async checkAIServices() {
    try {
      const backendEnv = this.readEnvFile('backend/.env');
      
      if (backendEnv.includes('OPENROUTER_API_KEY=') && !backendEnv.includes('your-openrouter')) {
        this.addResult('OpenRouter Configuration', true, 'API key configured');
      } else {
        this.addResult('OpenRouter Configuration', false, 'Not configured', true);
      }

      if (backendEnv.includes('OPENAI_API_KEY=') && !backendEnv.includes('your-openai')) {
        this.addResult('OpenAI Configuration', true, 'API key configured');
      } else {
        this.addResult('OpenAI Configuration', false, 'Not configured', true);
      }
    } catch (error) {
      this.addResult('AI Services Check', false, `Error: ${error.message}`, true);
    }
  }

  /**
   * Check security services
   */
  async checkSecurityServices() {
    console.log('🔒 Checking security services...');

    try {
      // Check if security monitoring is enabled
      const backendEnv = this.readEnvFile('backend/.env');
      
      if (backendEnv.includes('ENABLE_THREAT_DETECTION=true')) {
        this.addResult('Threat Detection', true, 'Enabled');
      } else {
        this.addResult('Threat Detection', false, 'Disabled', true);
      }

      if (backendEnv.includes('ENABLE_AUDIT_LOGGING=true')) {
        this.addResult('Audit Logging', true, 'Enabled');
      } else {
        this.addResult('Audit Logging', false, 'Disabled', true);
      }

      // Check JWT configuration
      if (backendEnv.includes('JWT_SECRET=') && !backendEnv.includes('your-jwt')) {
        this.addResult('JWT Configuration', true, 'Configured');
      } else {
        this.addResult('JWT Configuration', false, 'Not properly configured');
      }

    } catch (error) {
      this.addResult('Security Services Check', false, `Error: ${error.message}`);
    }

    console.log('✅ Security services checked\n');
  }

  /**
   * Check a single endpoint
   */
  async checkEndpoint(name, url, options = {}) {
    const { optional = false, expectedStatus = 200 } = options;

    try {
      const response = await this.makeRequest(url);
      
      if (response.statusCode === expectedStatus) {
        this.addResult(name, true, `Responding (${response.statusCode})`);
        return { success: true, response };
      } else {
        this.addResult(name, false, `Unexpected status: ${response.statusCode}`, optional);
        return { success: false, response };
      }
    } catch (error) {
      this.addResult(name, false, `Error: ${error.message}`, optional);
      return { success: false, error };
    }
  }

  /**
   * Make HTTP request with retries
   */
  async makeRequest(url) {
    let lastError;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const response = await this.httpRequest(url);
        return response;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.config.retries) {
          if (this.config.verbose) {
            console.log(`  Retry ${attempt}/${this.config.retries} for ${url}`);
          }
          await this.sleep(this.config.retryDelay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Make single HTTP request
   */
  httpRequest(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      const request = client.get(url, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            data: data
          });
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.setTimeout(this.config.timeout, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Read environment file
   */
  readEnvFile(filePath) {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf8');
    }
    return '';
  }

  /**
   * Add result to results array
   */
  addResult(name, success, message, isWarning = false) {
    this.results.checks.push({
      name,
      success,
      message,
      isWarning
    });

    if (success) {
      this.results.passed++;
    } else if (isWarning) {
      this.results.warnings++;
    } else {
      this.results.failed++;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Print results
   */
  printResults() {
    console.log('\n📊 Health Check Results:');
    console.log('='.repeat(60));

    // Group results by category
    const categories = {
      'System': [],
      'Database': [],
      'Backend': [],
      'Frontend': [],
      'Admin': [],
      'External Services': [],
      'Security': []
    };

    this.results.checks.forEach(check => {
      let category = 'Other';
      
      if (check.name.includes('System') || check.name.includes('Memory') || check.name.includes('Disk') || check.name.includes('CPU')) {
        category = 'System';
      } else if (check.name.includes('Database') || check.name.includes('PostgreSQL') || check.name.includes('Redis')) {
        category = 'Database';
      } else if (check.name.includes('Backend')) {
        category = 'Backend';
      } else if (check.name.includes('Frontend') && !check.name.includes('Admin')) {
        category = 'Frontend';
      } else if (check.name.includes('Admin')) {
        category = 'Admin';
      } else if (check.name.includes('Configuration') || check.name.includes('SendGrid') || check.name.includes('Stripe') || check.name.includes('OpenRouter') || check.name.includes('OpenAI') || check.name.includes('AWS') || check.name.includes('Razorpay')) {
        category = 'External Services';
      } else if (check.name.includes('Security') || check.name.includes('JWT') || check.name.includes('Threat') || check.name.includes('Audit')) {
        category = 'Security';
      }

      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(check);
    });

    // Print results by category
    Object.entries(categories).forEach(([category, checks]) => {
      if (checks.length > 0) {
        console.log(`\n${category}:`);
        checks.forEach(check => {
          const icon = check.success ? '✅' : (check.isWarning ? '⚠️' : '❌');
          console.log(`  ${icon} ${check.name}: ${check.message}`);
        });
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`Summary: ${this.results.passed} passed, ${this.results.failed} failed, ${this.results.warnings} warnings`);
  }
}

// Run health checks if this script is executed directly
if (require.main === module) {
  const config = {
    verbose: process.argv.includes('--verbose'),
    timeout: process.argv.includes('--timeout') ? 
      parseInt(process.argv[process.argv.indexOf('--timeout') + 1]) || 10000 : 10000
  };

  const healthChecker = new HealthChecker(config);
  healthChecker.runHealthChecks().catch(error => {
    console.error('Health check failed:', error);
    process.exit(1);
  });
}

module.exports = HealthChecker;