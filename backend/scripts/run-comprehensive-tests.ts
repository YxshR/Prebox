#!/usr/bin/env ts-node

/**
 * Comprehensive Test Suite Runner
 * Executes all test categories and generates detailed reports
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TestResult {
  category: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: CoverageData;
}

interface CoverageData {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

class ComprehensiveTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive Test Suite');
    console.log('=====================================\n');

    this.startTime = Date.now();

    const testCategories = [
      { name: 'unit', command: 'npm run test:unit', required: true },
      { name: 'integration', command: 'npm run test:integration', required: true },
      { name: 'e2e', command: 'npm run test:e2e', required: true },
      { name: 'comprehensive', command: 'npm run test:comprehensive', required: true },
      { name: 'performance', command: 'npm run test:performance', required: false }
    ];

    for (const category of testCategories) {
      await this.runTestCategory(category);
    }

    await this.generateCoverageReport();
    this.printFinalSummary();
    this.generateJSONReport();
  }

  private async runTestCategory(category: { name: string; command: string; required: boolean }): Promise<void> {
    console.log(`📋 Running ${category.name} tests...`);
    
    const categoryStartTime = Date.now();
    let result: TestResult;

    try {
      const output = execSync(category.command, { 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000 // 5 minutes timeout
      });

      result = this.parseTestOutput(category.name, output, Date.now() - categoryStartTime);
      this.results.push(result);
      
      console.log(`✅ ${category.name} tests completed`);
      this.printCategoryResult(result);

    } catch (error: any) {
      const duration = Date.now() - categoryStartTime;
      
      if (error.stdout) {
        result = this.parseTestOutput(category.name, error.stdout, duration);
      } else {
        result = {
          category: category.name,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration
        };
      }

      this.results.push(result);
      
      if (category.required) {
        console.log(`❌ ${category.name} tests failed (REQUIRED)`);
        this.printCategoryResult(result);
        console.error(`Error: ${error.message}`);
      } else {
        console.log(`⚠️  ${category.name} tests failed (OPTIONAL)`);
        this.printCategoryResult(result);
      }
    }

    console.log(''); // Empty line for readability
  }

  private parseTestOutput(category: string, output: string, duration: number): TestResult {
    // Parse Jest output to extract test results
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    const skippedMatch = output.match(/(\d+) skipped/);

    return {
      category,
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
      duration
    };
  }

  private async generateCoverageReport(): Promise<void> {
    console.log('📊 Generating coverage report...');
    
    try {
      execSync('npm run test:coverage', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });

      // Read coverage summary
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        const totalCoverage = coverageData.total;

        // Add coverage to the last result or create a summary result
        if (this.results.length > 0) {
          this.results[this.results.length - 1].coverage = {
            statements: totalCoverage.statements.pct,
            branches: totalCoverage.branches.pct,
            functions: totalCoverage.functions.pct,
            lines: totalCoverage.lines.pct
          };
        }
      }

      console.log('✅ Coverage report generated');
    } catch (error) {
      console.log('⚠️  Coverage report generation failed');
    }
  }

  private printCategoryResult(result: TestResult): void {
    const total = result.passed + result.failed + result.skipped;
    const successRate = total > 0 ? ((result.passed / total) * 100).toFixed(1) : '0';
    
    console.log(`  ✅ Passed: ${result.passed}`);
    console.log(`  ❌ Failed: ${result.failed}`);
    console.log(`  ⏭️  Skipped: ${result.skipped}`);
    console.log(`  ⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`  📊 Success Rate: ${successRate}%`);

    if (result.coverage) {
      console.log(`  📈 Coverage:`);
      console.log(`    Statements: ${result.coverage.statements}%`);
      console.log(`    Branches: ${result.coverage.branches}%`);
      console.log(`    Functions: ${result.coverage.functions}%`);
      console.log(`    Lines: ${result.coverage.lines}%`);
    }
  }

  private printFinalSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);
    const totalTests = totalPassed + totalFailed + totalSkipped;
    
    const overallSuccess = totalFailed === 0;
    const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0';

    console.log('\n🏁 Test Suite Complete');
    console.log('======================');
    console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`🎯 Overall Result: ${overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`📊 Success Rate: ${successRate}%`);
    console.log(`📈 Total Tests: ${totalTests} (${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped)`);

    // Print category breakdown
    console.log('\n📋 Category Breakdown:');
    this.results.forEach(result => {
      const categoryTotal = result.passed + result.failed + result.skipped;
      const categorySuccess = categoryTotal > 0 ? ((result.passed / categoryTotal) * 100).toFixed(1) : '0';
      const status = result.failed === 0 ? '✅' : '❌';
      
      console.log(`  ${status} ${result.category}: ${categorySuccess}% (${result.passed}/${categoryTotal})`);
    });

    // Print recommendations
    this.printRecommendations();

    // Exit with appropriate code
    process.exit(overallSuccess ? 0 : 1);
  }

  private printRecommendations(): void {
    console.log('\n💡 Recommendations:');
    
    const failedCategories = this.results.filter(r => r.failed > 0);
    if (failedCategories.length > 0) {
      console.log(`  - Fix failing tests in: ${failedCategories.map(r => r.category).join(', ')}`);
    }

    const lastResult = this.results[this.results.length - 1];
    if (lastResult?.coverage) {
      if (lastResult.coverage.statements < 90) {
        console.log(`  - Increase statement coverage to 90% (currently ${lastResult.coverage.statements}%)`);
      }
      if (lastResult.coverage.branches < 85) {
        console.log(`  - Increase branch coverage to 85% (currently ${lastResult.coverage.branches}%)`);
      }
    }

    const slowCategories = this.results.filter(r => r.duration > 60000); // > 1 minute
    if (slowCategories.length > 0) {
      console.log(`  - Optimize slow test categories: ${slowCategories.map(r => r.category).join(', ')}`);
    }

    console.log('  - Consider adding more edge case tests');
    console.log('  - Review performance test results for bottlenecks');
    console.log('  - Ensure all critical user workflows are covered in E2E tests');
  }

  private generateJSONReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - this.startTime,
      summary: {
        totalPassed: this.results.reduce((sum, r) => sum + r.passed, 0),
        totalFailed: this.results.reduce((sum, r) => sum + r.failed, 0),
        totalSkipped: this.results.reduce((sum, r) => sum + r.skipped, 0),
        overallSuccess: this.results.every(r => r.failed === 0)
      },
      categories: this.results,
      coverage: this.results[this.results.length - 1]?.coverage || null
    };

    const reportPath = path.join(process.cwd(), 'test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run the comprehensive test suite
if (require.main === module) {
  const runner = new ComprehensiveTestRunner();
  runner.runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}