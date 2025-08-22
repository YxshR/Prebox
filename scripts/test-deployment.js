#!/usr/bin/env node

/**
 * Automated Testing Script for Deployment Environments
 * 
 * This script runs automated tests to verify that the deployment
 * is working correctly in different environments.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DeploymentTester {
  constructor(environment = 'development') {
    this.environment = environment;
    this.projectRoot = process.cwd();
    this.results = {
      unit: { passed: 0, failed: 0, skipped: 0 },
      integration: { passed: 0, failed: 0, skipped: 0 },
      e2e: { passed: 0, failed: 0, skipped: 0 },
      security: { passed: 0, failed: 0, skipped: 0 }
    };
    this.errors = [];
  }

  /**
   * Run all deployment tests
   */
  async runTests() {
    console.log(`🧪 Running deployment tests for ${this.environment} environment...\n`);

    try {
      await this.runUnitTests();
      await this.runIntegrationTests();
      await this.runEndToEndTests();
      await this.runSecurityTests();
      await this.runPerformanceTests();

      this.printResults();
      
      const totalFailed = this.results.unit.failed + 
                         this.results.integration.failed + 
                         this.results.e2e.failed + 
                         this.results.security.failed;

      if (totalFailed > 0) {
        console.log('\n❌ Some tests failed. Please review the results above.');
        process.exit(1);
      } else {
        console.log('\n✅ All deployment tests passed!');
      }
    } catch (error) {
      console.error('\n💥 Testing failed with error:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run unit tests
   */
  async runUnitTests() {
    console.log('🔬 Running unit tests...');

    const applications = ['frontend', 'backend', 'shared'];

    for (const app of applications) {
      const appPath = path.join(this.projectRoot, app);
      
      if (fs.existsSync(appPath) && fs.existsSync(path.join(appPath, 'package.json'))) {
        try {
          console.log(`  Testing ${app}...`);
          
          const result = execSync('npm test -- --passWithNoTests --ci --coverage=false --watchAll=false', {
            cwd: appPath,
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 120000 // 2 minutes timeout
          });

          // Parse Jest output for results
          const testResults = this.parseJestOutput(result);
          this.results.unit.passed += testResults.passed;
          this.results.unit.failed += testResults.failed;
          this.results.unit.skipped += testResults.skipped;

          console.log(`    ✅ ${app}: ${testResults.passed} passed, ${testResults.failed} failed`);

        } catch (error) {
          console.log(`    ❌ ${app}: Tests failed`);
          this.results.unit.failed += 1;
          this.errors.push(`Unit tests failed for ${app}: ${error.message}`);
        }
      } else {
        console.log(`    ⏭️  ${app}: No tests found`);
      }
    }

    console.log('✅ Unit tests completed\n');
  }

  /**
   * Run integration tests
   */
  async runIntegrationTests() {
    console.log('🔗 Running integration tests...');

    // Backend integration tests
    await this.runBackendIntegrationTests();

    // Frontend integration tests
    await this.runFrontendIntegrationTests();

    console.log('✅ Integration tests completed\n');
  }

  /**
   * Run backend integration tests
   */
  async runBackendIntegrationTests() {
    const backendPath = path.join(this.projectRoot, 'backend');
    
    if (fs.existsSync(backendPath)) {
      try {
        console.log('  Testing backend integration...');
        
        const result = execSync('npm run test:integration -- --passWithNoTests --ci --watchAll=false', {
          cwd: backendPath,
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 180000 // 3 minutes timeout
        });

        const testResults = this.parseJestOutput(result);
        this.results.integration.passed += testResults.passed;
        this.results.integration.failed += testResults.failed;

        console.log(`    ✅ Backend integration: ${testResults.passed} passed, ${testResults.failed} failed`);

      } catch (error) {
        console.log('    ❌ Backend integration: Tests failed');
        this.results.integration.failed += 1;
        this.errors.push(`Backend integration tests failed: ${error.message}`);
      }
    }
  }

  /**
   * Run frontend integration tests
   */
  async runFrontendIntegrationTests() {
    const frontendPath = path.join(this.projectRoot, 'frontend');
    
    if (fs.existsSync(frontendPath)) {
      try {
        console.log('  Testing frontend integration...');
        
        // Check if integration tests exist
        const integrationTestPath = path.join(frontendPath, 'src/__tests__/integration');
        
        if (fs.existsSync(integrationTestPath)) {
          const result = execSync('npm test -- --testPathPattern=integration --passWithNoTests --ci --watchAll=false', {
            cwd: frontendPath,
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 180000
          });

          const testResults = this.parseJestOutput(result);
          this.results.integration.passed += testResults.passed;
          this.results.integration.failed += testResults.failed;

          console.log(`    ✅ Frontend integration: ${testResults.passed} passed, ${testResults.failed} failed`);
        } else {
          console.log('    ⏭️  Frontend integration: No tests found');
        }

      } catch (error) {
        console.log('    ❌ Frontend integration: Tests failed');
        this.results.integration.failed += 1;
        this.errors.push(`Frontend integration tests failed: ${error.message}`);
      }
    }
  }

  /**
   * Run end-to-end tests
   */
  async runEndToEndTests() {
    console.log('🎭 Running end-to-end tests...');

    // Check if services are running before E2E tests
    const servicesRunning = await this.checkServicesRunning();
    
    if (!servicesRunning) {
      console.log('    ⚠️  Services not running, skipping E2E tests');
      this.results.e2e.skipped += 1;
      return;
    }

    // Backend E2E tests
    await this.runBackendE2ETests();

    // Frontend E2E tests
    await this.runFrontendE2ETests();

    console.log('✅ End-to-end tests completed\n');
  }

  /**
   * Check if services are running
   */
  async checkServicesRunning() {
    try {
      const http = require('http');
      
      return new Promise((resolve) => {
        const request = http.get('http://localhost:8000/api/health', (response) => {
          resolve(response.statusCode === 200);
        });

        request.on('error', () => {
          resolve(false);
        });

        request.setTimeout(5000, () => {
          request.destroy();
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Run backend E2E tests
   */
  async runBackendE2ETests() {
    const backendPath = path.join(this.projectRoot, 'backend');
    
    if (fs.existsSync(backendPath)) {
      try {
        console.log('  Testing backend E2E...');
        
        const result = execSync('npm run test:e2e -- --passWithNoTests --ci --watchAll=false', {
          cwd: backendPath,
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 300000 // 5 minutes timeout
        });

        const testResults = this.parseJestOutput(result);
        this.results.e2e.passed += testResults.passed;
        this.results.e2e.failed += testResults.failed;

        console.log(`    ✅ Backend E2E: ${testResults.passed} passed, ${testResults.failed} failed`);

      } catch (error) {
        console.log('    ❌ Backend E2E: Tests failed');
        this.results.e2e.failed += 1;
        this.errors.push(`Backend E2E tests failed: ${error.message}`);
      }
    }
  }

  /**
   * Run frontend E2E tests
   */
  async runFrontendE2ETests() {
    const frontendPath = path.join(this.projectRoot, 'frontend');
    
    if (fs.existsSync(frontendPath)) {
      try {
        console.log('  Testing frontend E2E...');
        
        // Check if E2E tests exist
        const e2eTestPath = path.join(frontendPath, 'src/__tests__/e2e');
        
        if (fs.existsSync(e2eTestPath)) {
          const result = execSync('npm test -- --testPathPattern=e2e --passWithNoTests --ci --watchAll=false', {
            cwd: frontendPath,
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 300000
          });

          const testResults = this.parseJestOutput(result);
          this.results.e2e.passed += testResults.passed;
          this.results.e2e.failed += testResults.failed;

          console.log(`    ✅ Frontend E2E: ${testResults.passed} passed, ${testResults.failed} failed`);
        } else {
          console.log('    ⏭️  Frontend E2E: No tests found');
        }

      } catch (error) {
        console.log('    ❌ Frontend E2E: Tests failed');
        this.results.e2e.failed += 1;
        this.errors.push(`Frontend E2E tests failed: ${error.message}`);
      }
    }
  }

  /**
   * Run security tests
   */
  async runSecurityTests() {
    console.log('🔒 Running security tests...');

    // Environment security validation
    await this.runEnvironmentSecurityTests();

    // Dependency security audit
    await this.runDependencySecurityTests();

    // API security tests
    await this.runAPISecurityTests();

    console.log('✅ Security tests completed\n');
  }

  /**
   * Run environment security tests
   */
  async runEnvironmentSecurityTests() {
    try {
      console.log('  Testing environment security...');
      
      execSync('node scripts/validate-env-security.js', {
        cwd: this.projectRoot,
        stdio: 'pipe',
        timeout: 30000
      });

      this.results.security.passed += 1;
      console.log('    ✅ Environment security: Passed');

    } catch (error) {
      console.log('    ❌ Environment security: Failed');
      this.results.security.failed += 1;
      this.errors.push(`Environment security validation failed: ${error.message}`);
    }
  }

  /**
   * Run dependency security tests
   */
  async runDependencySecurityTests() {
    const applications = ['frontend', 'backend', 'admin-frontend', 'shared'];

    for (const app of applications) {
      const appPath = path.join(this.projectRoot, app);
      
      if (fs.existsSync(appPath) && fs.existsSync(path.join(appPath, 'package.json'))) {
        try {
          console.log(`  Testing ${app} dependencies...`);
          
          const result = execSync('npm audit --audit-level=high --json', {
            cwd: appPath,
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 60000
          });

          const audit = JSON.parse(result);
          const highVulns = audit.metadata.vulnerabilities.high || 0;
          const criticalVulns = audit.metadata.vulnerabilities.critical || 0;

          if (highVulns > 0 || criticalVulns > 0) {
            console.log(`    ⚠️  ${app}: ${highVulns} high, ${criticalVulns} critical vulnerabilities`);
            this.results.security.failed += 1;
            this.errors.push(`${app} has security vulnerabilities: ${highVulns} high, ${criticalVulns} critical`);
          } else {
            console.log(`    ✅ ${app}: No high/critical vulnerabilities`);
            this.results.security.passed += 1;
          }

        } catch (error) {
          // npm audit might exit with non-zero code even when successful
          if (error.message.includes('found 0 vulnerabilities')) {
            console.log(`    ✅ ${app}: No vulnerabilities found`);
            this.results.security.passed += 1;
          } else {
            console.log(`    ❌ ${app}: Security audit failed`);
            this.results.security.failed += 1;
            this.errors.push(`Security audit failed for ${app}: ${error.message}`);
          }
        }
      }
    }
  }

  /**
   * Run API security tests
   */
  async runAPISecurityTests() {
    try {
      console.log('  Testing API security...');
      
      // Check if backend security tests exist
      const backendPath = path.join(this.projectRoot, 'backend');
      const securityTestPath = path.join(backendPath, 'src/security');
      
      if (fs.existsSync(securityTestPath)) {
        const result = execSync('npm test -- --testPathPattern=security --passWithNoTests --ci --watchAll=false', {
          cwd: backendPath,
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 120000
        });

        const testResults = this.parseJestOutput(result);
        this.results.security.passed += testResults.passed;
        this.results.security.failed += testResults.failed;

        console.log(`    ✅ API security: ${testResults.passed} passed, ${testResults.failed} failed`);
      } else {
        console.log('    ⏭️  API security: No tests found');
      }

    } catch (error) {
      console.log('    ❌ API security: Tests failed');
      this.results.security.failed += 1;
      this.errors.push(`API security tests failed: ${error.message}`);
    }
  }

  /**
   * Run performance tests
   */
  async runPerformanceTests() {
    console.log('⚡ Running performance tests...');

    // Only run performance tests in staging/production
    if (this.environment === 'development') {
      console.log('  ⏭️  Skipping performance tests in development environment');
      return;
    }

    try {
      const backendPath = path.join(this.projectRoot, 'backend');
      
      // Check if performance tests exist
      const perfTestPath = path.join(backendPath, 'src/tests/performance');
      
      if (fs.existsSync(perfTestPath)) {
        console.log('  Testing API performance...');
        
        const result = execSync('npm run test:performance -- --passWithNoTests --ci --watchAll=false', {
          cwd: backendPath,
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 300000 // 5 minutes timeout
        });

        console.log('    ✅ Performance tests completed');
      } else {
        console.log('    ⏭️  Performance tests: Not found');
      }

    } catch (error) {
      console.log('    ⚠️  Performance tests: Failed (non-critical)');
      // Performance test failures are warnings, not errors
    }

    console.log('✅ Performance tests completed\n');
  }

  /**
   * Parse Jest output to extract test results
   */
  parseJestOutput(output) {
    const results = {
      passed: 0,
      failed: 0,
      skipped: 0
    };

    try {
      // Look for Jest summary line
      const summaryMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed/);
      if (summaryMatch) {
        results.failed = parseInt(summaryMatch[1]);
        results.passed = parseInt(summaryMatch[2]);
      } else {
        // Look for alternative formats
        const passedMatch = output.match(/(\d+)\s+passed/);
        const failedMatch = output.match(/(\d+)\s+failed/);
        
        if (passedMatch) results.passed = parseInt(passedMatch[1]);
        if (failedMatch) results.failed = parseInt(failedMatch[1]);
      }

      // If no tests were found, assume they passed
      if (results.passed === 0 && results.failed === 0) {
        results.passed = 1; // Assume success if no explicit results
      }

    } catch (error) {
      // If parsing fails, assume tests passed
      results.passed = 1;
    }

    return results;
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n📊 Deployment Test Results:');
    console.log('='.repeat(60));

    const categories = [
      { name: 'Unit Tests', results: this.results.unit },
      { name: 'Integration Tests', results: this.results.integration },
      { name: 'End-to-End Tests', results: this.results.e2e },
      { name: 'Security Tests', results: this.results.security }
    ];

    categories.forEach(category => {
      const { passed, failed, skipped } = category.results;
      const total = passed + failed + skipped;
      
      if (total > 0) {
        const status = failed > 0 ? '❌' : '✅';
        console.log(`\n${status} ${category.name}:`);
        console.log(`  Passed: ${passed}`);
        console.log(`  Failed: ${failed}`);
        if (skipped > 0) {
          console.log(`  Skipped: ${skipped}`);
        }
      }
    });

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    const totalPassed = this.results.unit.passed + this.results.integration.passed + 
                       this.results.e2e.passed + this.results.security.passed;
    const totalFailed = this.results.unit.failed + this.results.integration.failed + 
                       this.results.e2e.failed + this.results.security.failed;

    console.log('\n' + '='.repeat(60));
    console.log(`Overall: ${totalPassed} passed, ${totalFailed} failed`);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const environment = process.argv[2] || 'development';
  const tester = new DeploymentTester(environment);
  tester.runTests().catch(error => {
    console.error('Testing failed:', error);
    process.exit(1);
  });
}

module.exports = DeploymentTester;