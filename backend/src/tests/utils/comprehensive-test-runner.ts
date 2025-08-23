/**
 * Comprehensive Test Runner
 * Orchestrates all test suites and generates detailed reports
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TestSuite {
  name: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance';
  pattern: string;
  timeout: number;
  description: string;
  requirements: string[];
}

interface TestResult {
  suite: string;
  type: string;
  passed: boolean;
  duration: number;
  coverage?: number;
  errors?: string[];
  requirements: string[];
}

interface TestReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    coverage: number;
    duration: number;
  };
  results: TestResult[];
  requirementsCoverage: Record<string, number>;
  recommendations: string[];
}

export class ComprehensiveTestRunner {
  private testSuites: TestSuite[] = [
    // Unit Tests
    {
      name: 'Authentication Services Unit Tests',
      type: 'unit',
      pattern: 'src/auth/**/*.service.test.ts',
      timeout: 30000,
      description: 'Unit tests for authentication service layer',
      requirements: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8']
    },
    {
      name: 'Database Services Unit Tests',
      type: 'unit',
      pattern: 'src/database/**/*.test.ts',
      timeout: 20000,
      description: 'Unit tests for database operations',
      requirements: ['2.1', '2.2', '3.1', '3.2', '4.1', '4.2']
    },
    {
      name: 'Pricing Services Unit Tests',
      type: 'unit',
      pattern: 'src/pricing/**/*.service.test.ts',
      timeout: 15000,
      description: 'Unit tests for pricing system',
      requirements: ['4.1', '4.2', '4.3', '5.1', '5.2', '5.3']
    },
    {
      name: 'Security Services Unit Tests',
      type: 'unit',
      pattern: 'src/security/**/*.test.ts',
      timeout: 25000,
      description: 'Unit tests for security components',
      requirements: ['6.1', '6.2', '6.3', '6.4', '6.5', '6.6']
    },

    // Integration Tests
    {
      name: 'Database Operations Integration Tests',
      type: 'integration',
      pattern: 'src/tests/integration/database-operations.integration.test.ts',
      timeout: 60000,
      description: 'Integration tests for database operations with real connections',
      requirements: ['2.1', '2.2', '2.3', '3.1', '3.2', '4.1', '4.2']
    },
    {
      name: 'External Services Integration Tests',
      type: 'integration',
      pattern: 'src/tests/integration/external-services.integration.test.ts',
      timeout: 45000,
      description: 'Integration tests for Auth0, Twilio, and SendGrid',
      requirements: ['1.2', '1.3', '1.6', '2.1', '2.2', '2.3']
    },
    {
      name: 'Authentication Flow Integration Tests',
      type: 'integration',
      pattern: 'src/auth/__tests__/*.integration.test.ts',
      timeout: 40000,
      description: 'Integration tests for complete authentication flows',
      requirements: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '2.1', '2.2', '2.3', '2.4']
    },
    {
      name: 'Pricing System Integration Tests',
      type: 'integration',
      pattern: 'src/pricing/**/*.integration.test.ts',
      timeout: 30000,
      description: 'Integration tests for pricing system with database',
      requirements: ['4.1', '4.2', '4.3', '5.1', '5.2', '5.3', '5.4', '5.5']
    },

    // End-to-End Tests
    {
      name: 'Authentication Flows E2E Tests',
      type: 'e2e',
      pattern: 'src/tests/e2e/authentication-flows.e2e.test.ts',
      timeout: 120000,
      description: 'End-to-end tests for all authentication flows',
      requirements: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '2.1', '2.2', '2.3', '2.4', '3.1', '3.2', '3.3', '3.4', '3.5']
    },
    {
      name: 'User Workflows E2E Tests',
      type: 'e2e',
      pattern: 'src/tests/e2e/user-workflows.e2e.test.ts',
      timeout: 90000,
      description: 'End-to-end tests for complete user workflows',
      requirements: ['1.8', '2.4', '3.5', '4.3', '5.5', '6.8']
    },

    // Performance Tests
    {
      name: 'Authentication Performance Tests',
      type: 'performance',
      pattern: 'src/tests/performance/auth-performance.test.ts',
      timeout: 180000,
      description: 'Performance tests for authentication endpoints',
      requirements: ['1.4', '1.5', '2.4', '3.5', '6.4', '6.5']
    },
    {
      name: 'Database Performance Tests',
      type: 'performance',
      pattern: 'src/tests/performance/database-performance.test.ts',
      timeout: 120000,
      description: 'Performance tests for database operations',
      requirements: ['2.1', '2.2', '4.1', '4.2', '5.1', '5.2']
    }
  ];

  private results: TestResult[] = [];

  async runAllTests(): Promise<TestReport> {
    console.log('🚀 Starting Comprehensive Test Suite');
    console.log('=====================================\n');

    const startTime = Date.now();

    // Run tests by type in order
    await this.runTestsByType('unit');
    await this.runTestsByType('integration');
    await this.runTestsByType('e2e');
    await this.runTestsByType('performance');

    const totalTime = Date.now() - startTime;
    return this.generateReport(totalTime);
  }

  private async runTestsByType(type: TestSuite['type']): Promise<void> {
    const suites = this.testSuites.filter(suite => suite.type === type);
    
    console.log(`\n📋 Running ${type.toUpperCase()} Tests`);
    console.log('='.repeat(30));

    for (const suite of suites) {
      await this.runTestSuite(suite);
    }
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`\n🔍 ${suite.name}`);
    console.log(`   Type: ${suite.type}`);
    console.log(`   Description: ${suite.description}`);
    console.log(`   Requirements: ${suite.requirements.join(', ')}`);
    console.log(`   Pattern: ${suite.pattern}`);

    const startTime = Date.now();
    let result: TestResult;

    try {
      const command = this.buildTestCommand(suite);
      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const duration = Date.now() - startTime;
      const coverage = this.extractCoverage(output);

      result = {
        suite: suite.name,
        type: suite.type,
        passed: true,
        duration,
        coverage,
        requirements: suite.requirements
      };

      console.log(`   ✅ PASSED (${Math.round(duration / 1000)}s)`);
      if (coverage) {
        console.log(`   📊 Coverage: ${coverage}%`);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errors = this.parseErrors(error.stdout || error.message);

      result = {
        suite: suite.name,
        type: suite.type,
        passed: false,
        duration,
        errors,
        requirements: suite.requirements
      };

      console.log(`   ❌ FAILED (${Math.round(duration / 1000)}s)`);
      console.log(`   🐛 Errors: ${errors.length}`);
      errors.slice(0, 2).forEach(err => {
        console.log(`      - ${err}`);
      });
    }

    this.results.push(result);
  }

  private buildTestCommand(suite: TestSuite): string {
    const baseCommand = 'npx jest';
    const options = [
      `--testPathPattern="${suite.pattern}"`,
      `--testTimeout=${suite.timeout}`,
      '--coverage',
      '--coverageReporters=json-summary',
      '--verbose',
      '--runInBand' // Run tests serially for consistency
    ];

    if (suite.type === 'performance') {
      options.push('--maxWorkers=1');
    }

    return `${baseCommand} ${options.join(' ')}`;
  }

  private extractCoverage(output: string): number | undefined {
    try {
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        return Math.round(coverage.total.statements.pct);
      }
    } catch (error) {
      // Coverage extraction failed
    }
    return undefined;
  }

  private parseErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('FAIL') || 
          line.includes('Error:') || 
          line.includes('Expected:') ||
          line.includes('AssertionError') ||
          line.includes('TypeError')) {
        errors.push(line.trim());
      }
    }

    return errors.slice(0, 10);
  }

  private generateReport(totalTime: number): TestReport {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    // Calculate overall coverage
    const coverageResults = this.results.filter(r => r.coverage !== undefined);
    const avgCoverage = coverageResults.length > 0 
      ? Math.round(coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0) / coverageResults.length)
      : 0;

    // Calculate requirements coverage
    const requirementsCoverage = this.calculateRequirementsCoverage();

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    const report: TestReport = {
      summary: {
        total,
        passed,
        failed,
        coverage: avgCoverage,
        duration: totalTime
      },
      results: this.results,
      requirementsCoverage,
      recommendations
    };

    this.printReport(report);
    this.saveReport(report);

    return report;
  }

  private calculateRequirementsCoverage(): Record<string, number> {
    const coverage: Record<string, number> = {};
    
    // Get all unique requirements
    const allRequirements = new Set<string>();
    this.testSuites.forEach(suite => {
      suite.requirements.forEach(req => allRequirements.add(req));
    });

    // Calculate coverage for each requirement
    allRequirements.forEach(req => {
      const testsForReq = this.results.filter(result => 
        result.requirements.includes(req)
      );
      const passedTests = testsForReq.filter(result => result.passed);
      
      coverage[req] = testsForReq.length > 0 
        ? Math.round((passedTests.length / testsForReq.length) * 100)
        : 0;
    });

    return coverage;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Failed tests
    const failedTests = this.results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      recommendations.push(`Fix ${failedTests.length} failing test suite(s) before deployment`);
      
      const criticalFailures = failedTests.filter(r => 
        r.type === 'e2e' || r.requirements.some(req => req.startsWith('1.') || req.startsWith('2.'))
      );
      if (criticalFailures.length > 0) {
        recommendations.push('Critical authentication flows are failing - immediate attention required');
      }
    }

    // Coverage recommendations
    const lowCoverageTests = this.results.filter(r => r.coverage && r.coverage < 80);
    if (lowCoverageTests.length > 0) {
      recommendations.push('Improve test coverage for low-coverage test suites');
    }

    // Performance recommendations
    const slowTests = this.results.filter(r => r.duration > 60000); // > 1 minute
    if (slowTests.length > 0) {
      recommendations.push('Optimize slow-running test suites for better CI/CD performance');
    }

    // Requirements coverage
    const lowRequirementsCoverage = Object.entries(this.calculateRequirementsCoverage())
      .filter(([, coverage]) => coverage < 100);
    if (lowRequirementsCoverage.length > 0) {
      recommendations.push(`Improve test coverage for requirements: ${lowRequirementsCoverage.map(([req]) => req).join(', ')}`);
    }

    // Type-specific recommendations
    const failedE2E = this.results.filter(r => r.type === 'e2e' && !r.passed);
    if (failedE2E.length > 0) {
      recommendations.push('End-to-end test failures indicate integration issues');
    }

    const failedPerformance = this.results.filter(r => r.type === 'performance' && !r.passed);
    if (failedPerformance.length > 0) {
      recommendations.push('Performance test failures may impact user experience');
    }

    return recommendations;
  }

  private printReport(report: TestReport): void {
    console.log('\n📊 Comprehensive Test Report');
    console.log('============================\n');

    // Summary
    console.log('📈 Summary:');
    console.log(`   Total Test Suites: ${report.summary.total}`);
    console.log(`   Passed: ${report.summary.passed}`);
    console.log(`   Failed: ${report.summary.failed}`);
    console.log(`   Success Rate: ${Math.round((report.summary.passed / report.summary.total) * 100)}%`);
    console.log(`   Average Coverage: ${report.summary.coverage}%`);
    console.log(`   Total Duration: ${Math.round(report.summary.duration / 1000)}s\n`);

    // Results by type
    const types = ['unit', 'integration', 'e2e', 'performance'] as const;
    types.forEach(type => {
      const typeResults = report.results.filter(r => r.type === type);
      if (typeResults.length > 0) {
        const typePassed = typeResults.filter(r => r.passed).length;
        console.log(`${type.toUpperCase()} Tests: ${typePassed}/${typeResults.length} passed`);
        
        typeResults.forEach(result => {
          const status = result.passed ? '✅' : '❌';
          const duration = Math.round(result.duration / 1000);
          const coverage = result.coverage ? ` (${result.coverage}%)` : '';
          console.log(`  ${status} ${result.suite} - ${duration}s${coverage}`);
        });
        console.log('');
      }
    });

    // Requirements coverage
    console.log('📋 Requirements Coverage:');
    Object.entries(report.requirementsCoverage)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([req, coverage]) => {
        const status = coverage === 100 ? '✅' : coverage >= 80 ? '⚠️' : '❌';
        console.log(`  ${status} Requirement ${req}: ${coverage}%`);
      });
    console.log('');

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
      console.log('');
    }

    // Final status
    if (report.summary.failed === 0) {
      console.log('🎉 All tests passed! System is ready for deployment.');
    } else {
      console.log('⚠️  Some tests failed. Please review and fix before deployment.');
    }
  }

  private saveReport(report: TestReport): void {
    const reportPath = path.join(process.cwd(), 'test-reports');
    
    // Ensure reports directory exists
    if (!fs.existsSync(reportPath)) {
      fs.mkdirSync(reportPath, { recursive: true });
    }

    // Save JSON report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(reportPath, `comprehensive-test-report-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Save HTML report
    const htmlPath = path.join(reportPath, `comprehensive-test-report-${timestamp}.html`);
    const htmlContent = this.generateHtmlReport(report);
    fs.writeFileSync(htmlPath, htmlContent);

    console.log(`\n📄 Reports saved:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   HTML: ${htmlPath}`);
  }

  private generateHtmlReport(report: TestReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprehensive Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .test-suite { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .passed { border-left-color: #4CAF50; }
        .failed { border-left-color: #f44336; }
        .requirements { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
        .requirement { padding: 10px; border-radius: 4px; text-align: center; }
        .req-100 { background: #4CAF50; color: white; }
        .req-80 { background: #FF9800; color: white; }
        .req-low { background: #f44336; color: white; }
        .recommendations { background: #e3f2fd; padding: 15px; border-radius: 8px; }
    </style>
</head>
<body>
    <h1>Comprehensive Test Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Test Suites:</strong> ${report.summary.total}</p>
        <p><strong>Passed:</strong> ${report.summary.passed}</p>
        <p><strong>Failed:</strong> ${report.summary.failed}</p>
        <p><strong>Success Rate:</strong> ${Math.round((report.summary.passed / report.summary.total) * 100)}%</p>
        <p><strong>Average Coverage:</strong> ${report.summary.coverage}%</p>
        <p><strong>Total Duration:</strong> ${Math.round(report.summary.duration / 1000)}s</p>
    </div>

    <h2>Test Results</h2>
    ${report.results.map(result => `
        <div class="test-suite ${result.passed ? 'passed' : 'failed'}">
            <h3>${result.passed ? '✅' : '❌'} ${result.suite}</h3>
            <p><strong>Type:</strong> ${result.type}</p>
            <p><strong>Duration:</strong> ${Math.round(result.duration / 1000)}s</p>
            ${result.coverage ? `<p><strong>Coverage:</strong> ${result.coverage}%</p>` : ''}
            <p><strong>Requirements:</strong> ${result.requirements.join(', ')}</p>
            ${result.errors ? `<div><strong>Errors:</strong><ul>${result.errors.map(err => `<li>${err}</li>`).join('')}</ul></div>` : ''}
        </div>
    `).join('')}

    <h2>Requirements Coverage</h2>
    <div class="requirements">
        ${Object.entries(report.requirementsCoverage).map(([req, coverage]) => `
            <div class="requirement ${coverage === 100 ? 'req-100' : coverage >= 80 ? 'req-80' : 'req-low'}">
                <strong>Requirement ${req}</strong><br>
                ${coverage}%
            </div>
        `).join('')}
    </div>

    ${report.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>Recommendations</h2>
            <ul>
                ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    ` : ''}
</body>
</html>`;
  }

  async runSpecificType(type: TestSuite['type']): Promise<TestReport> {
    console.log(`🎯 Running ${type.toUpperCase()} tests only\n`);
    
    const startTime = Date.now();
    await this.runTestsByType(type);
    const totalTime = Date.now() - startTime;
    
    return this.generateReport(totalTime);
  }

  async runSpecificSuite(suiteName: string): Promise<TestReport> {
    const suite = this.testSuites.find(s => 
      s.name.toLowerCase().includes(suiteName.toLowerCase())
    );

    if (!suite) {
      throw new Error(`Test suite "${suiteName}" not found`);
    }

    console.log(`🎯 Running specific suite: ${suite.name}\n`);
    
    const startTime = Date.now();
    await this.runTestSuite(suite);
    const totalTime = Date.now() - startTime;
    
    return this.generateReport(totalTime);
  }
}

// CLI interface
export async function runComprehensiveTests(args: string[] = []): Promise<void> {
  const runner = new ComprehensiveTestRunner();

  try {
    if (args.includes('--type')) {
      const typeIndex = args.indexOf('--type');
      const type = args[typeIndex + 1] as TestSuite['type'];
      await runner.runSpecificType(type);
    } else if (args.includes('--suite')) {
      const suiteIndex = args.indexOf('--suite');
      const suiteName = args[suiteIndex + 1];
      await runner.runSpecificSuite(suiteName);
    } else {
      await runner.runAllTests();
    }
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runComprehensiveTests(process.argv.slice(2));
}