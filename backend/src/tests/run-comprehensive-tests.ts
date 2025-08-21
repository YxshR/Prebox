/**
 * Test runner for comprehensive security and feature tests
 * Requirements: 6.1, 6.2, 7.1, 8.3
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

interface TestSuite {
  name: string;
  pattern: string;
  timeout: number;
  description: string;
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  coverage?: number;
  errors?: string[];
}

class ComprehensiveTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Security Services',
      pattern: 'src/tests/comprehensive/security-services.test.ts',
      timeout: 60000,
      description: 'Tests for UserSecurityManager, SecureOTPService, and PricingProtectionService'
    },
    {
      name: 'Phone Authentication Flow',
      pattern: 'src/tests/integration/phone-auth-flow.integration.test.ts',
      timeout: 45000,
      description: 'End-to-end tests for phone-only authentication workflow'
    },
    {
      name: 'Pricing JWT Validation',
      pattern: 'src/tests/comprehensive/pricing-jwt-validation.test.ts',
      timeout: 30000,
      description: 'Security tests for pricing protection and JWT validation'
    },
    {
      name: 'Animations & Media Performance',
      pattern: 'src/tests/performance/animations-media.performance.test.ts',
      timeout: 120000,
      description: 'Performance tests for animations and media loading'
    }
  ];

  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive Test Suite');
    console.log('=====================================\n');

    const startTime = Date.now();

    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }

    const totalTime = Date.now() - startTime;
    this.generateReport(totalTime);
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`📋 Running: ${suite.name}`);
    console.log(`   Description: ${suite.description}`);
    console.log(`   Pattern: ${suite.pattern}`);
    console.log(`   Timeout: ${suite.timeout}ms\n`);

    const startTime = Date.now();
    let result: TestResult;

    try {
      const command = `npx jest ${suite.pattern} --testTimeout=${suite.timeout} --coverage --coverageReporters=json-summary --verbose`;
      
      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const duration = Date.now() - startTime;
      const coverage = this.extractCoverage();

      result = {
        suite: suite.name,
        passed: true,
        duration,
        coverage
      };

      console.log(`✅ ${suite.name} - PASSED (${duration}ms)`);
      if (coverage) {
        console.log(`   Coverage: ${coverage}%`);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errors = this.parseErrors(error.stdout || error.message);

      result = {
        suite: suite.name,
        passed: false,
        duration,
        errors
      };

      console.log(`❌ ${suite.name} - FAILED (${duration}ms)`);
      console.log(`   Errors: ${errors.length}`);
      errors.slice(0, 3).forEach(err => {
        console.log(`   - ${err}`);
      });
    }

    this.results.push(result);
    console.log('');
  }

  private extractCoverage(): number | undefined {
    try {
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        return Math.round(coverage.total.statements.pct);
      }
    } catch (error) {
      // Coverage extraction failed, continue without it
    }
    return undefined;
  }

  private parseErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('FAIL') || line.includes('Error:') || line.includes('Expected:')) {
        errors.push(line.trim());
      }
    }

    return errors.slice(0, 10); // Limit to first 10 errors
  }

  private generateReport(totalTime: number): void {
    console.log('📊 Test Results Summary');
    console.log('=======================\n');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => r.passed === false).length;
    const totalTests = this.results.length;

    console.log(`Total Test Suites: ${totalTests}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${Math.round((passed / totalTests) * 100)}%`);
    console.log(`Total Time: ${Math.round(totalTime / 1000)}s\n`);

    // Detailed results
    console.log('Detailed Results:');
    console.log('-----------------');
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = Math.round(result.duration / 1000);
      const coverage = result.coverage ? ` (${result.coverage}% coverage)` : '';
      
      console.log(`${status} ${result.suite} - ${duration}s${coverage}`);
      
      if (!result.passed && result.errors) {
        result.errors.slice(0, 2).forEach(error => {
          console.log(`    └─ ${error}`);
        });
      }
    });

    // Performance metrics
    console.log('\n⚡ Performance Metrics:');
    console.log('----------------------');
    
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    const slowestSuite = this.results.reduce((prev, current) => 
      prev.duration > current.duration ? prev : current
    );
    const fastestSuite = this.results.reduce((prev, current) => 
      prev.duration < current.duration ? prev : current
    );

    console.log(`Average Duration: ${Math.round(avgDuration / 1000)}s`);
    console.log(`Slowest Suite: ${slowestSuite.suite} (${Math.round(slowestSuite.duration / 1000)}s)`);
    console.log(`Fastest Suite: ${fastestSuite.suite} (${Math.round(fastestSuite.duration / 1000)}s)`);

    // Coverage summary
    const coverageResults = this.results.filter(r => r.coverage !== undefined);
    if (coverageResults.length > 0) {
      const avgCoverage = coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0) / coverageResults.length;
      console.log(`\n📈 Coverage Summary:`);
      console.log(`Average Coverage: ${Math.round(avgCoverage)}%`);
      
      coverageResults.forEach(result => {
        console.log(`  ${result.suite}: ${result.coverage}%`);
      });
    }

    // Security test specific metrics
    console.log('\n🔒 Security Test Metrics:');
    console.log('-------------------------');
    
    const securitySuites = this.results.filter(r => 
      r.suite.includes('Security') || r.suite.includes('JWT') || r.suite.includes('Authentication')
    );
    
    const securityPassed = securitySuites.filter(r => r.passed).length;
    const securityTotal = securitySuites.length;
    
    console.log(`Security Suites: ${securityPassed}/${securityTotal} passed`);
    console.log(`Security Success Rate: ${Math.round((securityPassed / securityTotal) * 100)}%`);

    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('-------------------');
    
    if (failed > 0) {
      console.log('• Fix failing tests before deployment');
      console.log('• Review error messages for security vulnerabilities');
    }
    
    if (avgDuration > 30000) {
      console.log('• Consider optimizing slow tests');
      console.log('• Review test setup and teardown procedures');
    }
    
    const lowCoverage = coverageResults.filter(r => (r.coverage || 0) < 80);
    if (lowCoverage.length > 0) {
      console.log('• Improve test coverage for:');
      lowCoverage.forEach(result => {
        console.log(`  - ${result.suite} (${result.coverage}%)`);
      });
    }

    // Exit with appropriate code
    if (failed > 0) {
      console.log('\n❌ Some tests failed. Please review and fix before proceeding.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed! Ready for deployment.');
      process.exit(0);
    }
  }

  async runSpecificSuite(suiteName: string): Promise<void> {
    const suite = this.testSuites.find(s => 
      s.name.toLowerCase().includes(suiteName.toLowerCase())
    );

    if (!suite) {
      console.log(`❌ Test suite "${suiteName}" not found.`);
      console.log('Available suites:');
      this.testSuites.forEach(s => console.log(`  - ${s.name}`));
      process.exit(1);
    }

    console.log(`🎯 Running specific suite: ${suite.name}\n`);
    await this.runTestSuite(suite);
    
    const result = this.results[0];
    if (result.passed) {
      console.log('✅ Suite completed successfully!');
      process.exit(0);
    } else {
      console.log('❌ Suite failed!');
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new ComprehensiveTestRunner();

  if (args.length > 0) {
    const command = args[0];
    
    if (command === '--suite' && args[1]) {
      await runner.runSpecificSuite(args[1]);
    } else if (command === '--help') {
      console.log('Comprehensive Test Runner');
      console.log('========================\n');
      console.log('Usage:');
      console.log('  npm run test:comprehensive              # Run all test suites');
      console.log('  npm run test:comprehensive -- --suite security  # Run specific suite');
      console.log('  npm run test:comprehensive -- --help    # Show this help\n');
      console.log('Available test suites:');
      console.log('  - security     # Security services tests');
      console.log('  - auth         # Authentication flow tests');
      console.log('  - pricing      # Pricing protection tests');
      console.log('  - performance  # Animation and media performance tests');
      process.exit(0);
    } else {
      console.log('❌ Invalid command. Use --help for usage information.');
      process.exit(1);
    }
  } else {
    await runner.runAllTests();
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  });
}

export { ComprehensiveTestRunner };