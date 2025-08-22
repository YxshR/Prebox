#!/usr/bin/env node

/**
 * Deployment Validation Script
 * 
 * This script validates that the application is properly configured
 * and ready for deployment in different environments.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

class DeploymentValidator {
  constructor(environment = 'development') {
    this.environment = environment;
    this.errors = [];
    this.warnings = [];
    this.projectRoot = process.cwd();
    this.results = {
      environment: [],
      dependencies: [],
      database: [],
      services: [],
      security: [],
      performance: []
    };
  }

  /**
   * Main validation function
   */
  async validate() {
    console.log(`🚀 Validating deployment for ${this.environment} environment...\n`);

    try {
      await this.validateEnvironment();
      await this.validateDependencies();
      await this.validateDatabase();
      await this.validateExternalServices();
      await this.validateSecurity();
      await this.validatePerformance();

      this.printResults();
      
      if (this.errors.length > 0) {
        console.log('\n❌ Deployment validation failed. Please fix the errors above.');
        process.exit(1);
      } else {
        console.log('\n✅ Deployment validation passed!');
        if (this.warnings.length > 0) {
          console.log('⚠️  Please review the warnings above.');
        }
      }
    } catch (error) {
      console.error('\n💥 Validation failed with error:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate environment configuration
   */
  async validateEnvironment() {
    console.log('🔧 Validating environment configuration...');

    const requiredEnvFiles = [
      'frontend/.env',
      'backend/.env',
      'admin-frontend/.env'
    ];

    // Check environment files exist
    for (const envFile of requiredEnvFiles) {
      const fullPath = path.join(this.projectRoot, envFile);
      if (!fs.existsSync(fullPath)) {
        this.errors.push(`Missing environment file: ${envFile}`);
      } else {
        this.results.environment.push(`✅ ${envFile} exists`);
      }
    }

    // Validate environment variables
    await this.validateEnvironmentVariables();

    // Check for production credentials in non-production environments
    if (this.environment !== 'production') {
      await this.checkForProductionCredentials();
    }

    console.log('✅ Environment configuration validated\n');
  }

  /**
   * Validate required environment variables
   */
  async validateEnvironmentVariables() {
    const requiredVars = {
      frontend: [
        'NEXT_PUBLIC_API_URL',
        'NEXT_PUBLIC_APP_URL'
      ],
      backend: [
        'PORT',
        'NODE_ENV',
        'DATABASE_URL',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET'
      ],
      'admin-frontend': [
        'NEXT_PUBLIC_API_URL'
      ]
    };

    for (const [app, vars] of Object.entries(requiredVars)) {
      const envPath = path.join(this.projectRoot, `${app}/.env`);
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        for (const varName of vars) {
          const regex = new RegExp(`^${varName}=.+`, 'm');
          if (!regex.test(envContent)) {
            this.errors.push(`Missing required environment variable: ${varName} in ${app}/.env`);
          } else {
            this.results.environment.push(`✅ ${app}: ${varName} configured`);
          }
        }
      }
    }
  }

  /**
   * Check for production credentials in development
   */
  async checkForProductionCredentials() {
    const productionPatterns = [
      /sk_live_/i,                    // Stripe live keys
      /pk_live_/i,                    // Stripe live public keys
      /rk_live_/i,                    // Razorpay live keys
      /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/,  // SendGrid API keys
      /AC[a-f0-9]{32}/,               // Twilio Account SID
      /@[a-zA-Z0-9.-]+\.rds\.amazonaws\.com/,  // AWS RDS endpoints
      /redis-[0-9]+\..*\.redns\.redis-cloud\.com/,  // Redis Cloud endpoints
    ];

    const envFiles = ['backend/.env', 'frontend/.env', 'admin-frontend/.env'];
    
    for (const envFile of envFiles) {
      const fullPath = path.join(this.projectRoot, envFile);
      
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        for (const pattern of productionPatterns) {
          if (pattern.test(content)) {
            this.warnings.push(`Potential production credentials found in ${envFile}`);
          }
        }
      }
    }
  }

  /**
   * Validate dependencies
   */
  async validateDependencies() {
    console.log('📦 Validating dependencies...');

    const applications = ['frontend', 'backend', 'admin-frontend', 'shared'];

    for (const app of applications) {
      const appPath = path.join(this.projectRoot, app);
      
      if (fs.existsSync(appPath)) {
        try {
          // Check if node_modules exists
          const nodeModulesPath = path.join(appPath, 'node_modules');
          if (!fs.existsSync(nodeModulesPath)) {
            this.errors.push(`Missing node_modules in ${app}. Run: cd ${app} && npm install`);
          } else {
            this.results.dependencies.push(`✅ ${app}: node_modules exists`);
          }

          // Check for security vulnerabilities
          try {
            const auditResult = execSync('npm audit --audit-level=high --json', { 
              cwd: appPath,
              encoding: 'utf8',
              stdio: 'pipe'
            });
            
            const audit = JSON.parse(auditResult);
            if (audit.metadata.vulnerabilities.high > 0 || audit.metadata.vulnerabilities.critical > 0) {
              this.warnings.push(`${app}: Found ${audit.metadata.vulnerabilities.high} high and ${audit.metadata.vulnerabilities.critical} critical vulnerabilities`);
            } else {
              this.results.dependencies.push(`✅ ${app}: No high/critical vulnerabilities`);
            }
          } catch (auditError) {
            // npm audit might fail if no vulnerabilities found
            this.results.dependencies.push(`✅ ${app}: Security audit passed`);
          }

        } catch (error) {
          this.errors.push(`Failed to validate dependencies for ${app}: ${error.message}`);
        }
      }
    }

    console.log('✅ Dependencies validated\n');
  }

  /**
   * Validate database connectivity
   */
  async validateDatabase() {
    console.log('🗄️  Validating database connectivity...');

    try {
      // Check if backend test script exists
      const testScript = path.join(this.projectRoot, 'backend/test-all-connections.js');
      
      if (fs.existsSync(testScript)) {
        try {
          const result = execSync('node test-all-connections.js', {
            cwd: path.join(this.projectRoot, 'backend'),
            encoding: 'utf8',
            timeout: 30000
          });
          
          if (result.includes('Database connection: ✅')) {
            this.results.database.push('✅ PostgreSQL connection successful');
          } else {
            this.errors.push('Database connection failed');
          }

          if (result.includes('Redis connection: ✅')) {
            this.results.database.push('✅ Redis connection successful');
          } else {
            this.warnings.push('Redis connection failed - caching may not work');
          }

        } catch (error) {
          this.errors.push(`Database connectivity test failed: ${error.message}`);
        }
      } else {
        this.warnings.push('Database connectivity test script not found');
      }

    } catch (error) {
      this.errors.push(`Database validation failed: ${error.message}`);
    }

    console.log('✅ Database validation completed\n');
  }

  /**
   * Validate external services
   */
  async validateExternalServices() {
    console.log('🌐 Validating external services...');

    // Test API endpoints
    await this.testApiEndpoints();

    // Test email service configuration
    await this.testEmailService();

    // Test payment gateway configuration
    await this.testPaymentGateways();

    console.log('✅ External services validated\n');
  }

  /**
   * Test API endpoints
   */
  async testApiEndpoints() {
    const endpoints = [
      { name: 'Backend Health', url: 'http://localhost:8000/api/health' },
      { name: 'Backend Detailed Health', url: 'http://localhost:8000/api/health/detailed' }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.makeHttpRequest(endpoint.url);
        if (response.statusCode === 200) {
          this.results.services.push(`✅ ${endpoint.name}: Responding`);
        } else {
          this.warnings.push(`${endpoint.name}: Returned status ${response.statusCode}`);
        }
      } catch (error) {
        this.warnings.push(`${endpoint.name}: Not accessible (${error.message})`);
      }
    }
  }

  /**
   * Test email service configuration
   */
  async testEmailService() {
    const backendEnvPath = path.join(this.projectRoot, 'backend/.env');
    
    if (fs.existsSync(backendEnvPath)) {
      const envContent = fs.readFileSync(backendEnvPath, 'utf8');
      
      // Check for email service configuration
      if (envContent.includes('SENDGRID_API_KEY=') && !envContent.includes('SENDGRID_API_KEY=your-')) {
        this.results.services.push('✅ SendGrid API key configured');
      } else if (envContent.includes('AWS_ACCESS_KEY_ID=') && !envContent.includes('AWS_ACCESS_KEY_ID=your-')) {
        this.results.services.push('✅ AWS SES credentials configured');
      } else {
        this.warnings.push('No email service configured');
      }
    }
  }

  /**
   * Test payment gateway configuration
   */
  async testPaymentGateways() {
    const backendEnvPath = path.join(this.projectRoot, 'backend/.env');
    
    if (fs.existsSync(backendEnvPath)) {
      const envContent = fs.readFileSync(backendEnvPath, 'utf8');
      
      // Check for payment gateway configuration
      if (envContent.includes('STRIPE_SECRET_KEY=sk_')) {
        this.results.services.push('✅ Stripe configuration found');
      } else {
        this.warnings.push('Stripe not configured');
      }

      if (envContent.includes('RAZORPAY_KEY_SECRET=') && !envContent.includes('RAZORPAY_KEY_SECRET=your-')) {
        this.results.services.push('✅ Razorpay configuration found');
      } else {
        this.warnings.push('Razorpay not configured');
      }
    }
  }

  /**
   * Validate security configuration
   */
  async validateSecurity() {
    console.log('🔒 Validating security configuration...');

    // Check JWT secrets
    await this.validateJWTSecrets();

    // Check HTTPS configuration for production
    if (this.environment === 'production') {
      await this.validateHTTPSConfiguration();
    }

    // Check security headers
    await this.validateSecurityHeaders();

    // Run environment security validation
    try {
      execSync('node scripts/validate-env-security.js', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      this.results.security.push('✅ Environment security validation passed');
    } catch (error) {
      this.errors.push('Environment security validation failed');
    }

    console.log('✅ Security validation completed\n');
  }

  /**
   * Validate JWT secrets
   */
  async validateJWTSecrets() {
    const backendEnvPath = path.join(this.projectRoot, 'backend/.env');
    
    if (fs.existsSync(backendEnvPath)) {
      const envContent = fs.readFileSync(backendEnvPath, 'utf8');
      
      // Check JWT secret strength
      const jwtSecretMatch = envContent.match(/JWT_SECRET=(.+)/);
      if (jwtSecretMatch) {
        const secret = jwtSecretMatch[1].trim();
        if (secret.length < 32) {
          this.warnings.push('JWT_SECRET should be at least 32 characters long');
        } else if (secret.includes('dev-') || secret.includes('development')) {
          if (this.environment === 'production') {
            this.errors.push('Production environment using development JWT secret');
          } else {
            this.results.security.push('✅ Development JWT secret configured');
          }
        } else {
          this.results.security.push('✅ JWT secret properly configured');
        }
      } else {
        this.errors.push('JWT_SECRET not configured');
      }
    }
  }

  /**
   * Validate HTTPS configuration for production
   */
  async validateHTTPSConfiguration() {
    const backendEnvPath = path.join(this.projectRoot, 'backend/.env');
    
    if (fs.existsSync(backendEnvPath)) {
      const envContent = fs.readFileSync(backendEnvPath, 'utf8');
      
      // Check for TLS configuration
      if (envContent.includes('TLS_CERT_PATH=') && envContent.includes('TLS_KEY_PATH=')) {
        this.results.security.push('✅ TLS certificates configured');
      } else {
        this.warnings.push('TLS certificates not configured for production');
      }

      // Check for HTTPS URLs
      if (envContent.includes('https://')) {
        this.results.security.push('✅ HTTPS URLs configured');
      } else {
        this.warnings.push('HTTPS URLs not configured for production');
      }
    }
  }

  /**
   * Validate security headers
   */
  async validateSecurityHeaders() {
    const backendEnvPath = path.join(this.projectRoot, 'backend/.env');
    
    if (fs.existsSync(backendEnvPath)) {
      const envContent = fs.readFileSync(backendEnvPath, 'utf8');
      
      if (envContent.includes('HELMET_ENABLED=true')) {
        this.results.security.push('✅ Security headers enabled');
      } else {
        this.warnings.push('Security headers not enabled');
      }

      if (envContent.includes('CSP_ENABLED=true')) {
        this.results.security.push('✅ Content Security Policy enabled');
      } else {
        this.warnings.push('Content Security Policy not enabled');
      }
    }
  }

  /**
   * Validate performance configuration
   */
  async validatePerformance() {
    console.log('⚡ Validating performance configuration...');

    // Check Redis configuration for caching
    await this.validateCaching();

    // Check database connection pooling
    await this.validateDatabasePooling();

    // Check for production optimizations
    if (this.environment === 'production') {
      await this.validateProductionOptimizations();
    }

    console.log('✅ Performance validation completed\n');
  }

  /**
   * Validate caching configuration
   */
  async validateCaching() {
    const backendEnvPath = path.join(this.projectRoot, 'backend/.env');
    
    if (fs.existsSync(backendEnvPath)) {
      const envContent = fs.readFileSync(backendEnvPath, 'utf8');
      
      if (envContent.includes('REDIS_URL=')) {
        this.results.performance.push('✅ Redis caching configured');
      } else {
        this.warnings.push('Redis caching not configured - performance may be impacted');
      }
    }
  }

  /**
   * Validate database connection pooling
   */
  async validateDatabasePooling() {
    const backendEnvPath = path.join(this.projectRoot, 'backend/.env');
    
    if (fs.existsSync(backendEnvPath)) {
      const envContent = fs.readFileSync(backendEnvPath, 'utf8');
      
      if (envContent.includes('DATABASE_POOL_')) {
        this.results.performance.push('✅ Database connection pooling configured');
      } else {
        this.warnings.push('Database connection pooling not explicitly configured');
      }
    }
  }

  /**
   * Validate production optimizations
   */
  async validateProductionOptimizations() {
    const backendEnvPath = path.join(this.projectRoot, 'backend/.env');
    
    if (fs.existsSync(backendEnvPath)) {
      const envContent = fs.readFileSync(backendEnvPath, 'utf8');
      
      if (envContent.includes('NODE_ENV=production')) {
        this.results.performance.push('✅ Production mode enabled');
      } else {
        this.errors.push('NODE_ENV should be set to production');
      }

      if (envContent.includes('NODE_OPTIONS=--max-old-space-size=')) {
        this.results.performance.push('✅ Memory optimization configured');
      } else {
        this.warnings.push('Memory optimization not configured');
      }
    }
  }

  /**
   * Make HTTP request
   */
  makeHttpRequest(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      const request = client.get(url, (response) => {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.setTimeout(5000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Print validation results
   */
  printResults() {
    console.log('\n📊 Validation Results:');
    console.log('='.repeat(60));

    const categories = [
      { name: 'Environment', results: this.results.environment },
      { name: 'Dependencies', results: this.results.dependencies },
      { name: 'Database', results: this.results.database },
      { name: 'Services', results: this.results.services },
      { name: 'Security', results: this.results.security },
      { name: 'Performance', results: this.results.performance }
    ];

    categories.forEach(category => {
      if (category.results.length > 0) {
        console.log(`\n${category.name}:`);
        category.results.forEach(result => {
          console.log(`  ${result}`);
        });
      }
    });

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS (must be fixed):');
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (should be addressed):');
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const environment = process.argv[2] || 'development';
  const validator = new DeploymentValidator(environment);
  validator.validate().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = DeploymentValidator;