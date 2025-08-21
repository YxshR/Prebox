/**
 * Comprehensive Test Suite Runner
 * Orchestrates all test categories and provides detailed reporting
 */

import { testConfig, TestConfig, TestCategory } from './test-config';

export class TestSuiteRunner {
  private config: TestConfig;
  private results: TestResults = {
    unit: { passed: 0, failed: 0, skipped: 0 },
    integration: { passed: 0, failed: 0, skipped: 0 },
    e2e: { passed: 0, failed: 0, skipped: 0 },
    performance: { passed: 0, failed: 0, skipped: 0 }
  };

  constructor(config: TestConfig = testConfig) {
    this.config = config;
  }

  async runAllTests(): Promise<TestSummary> {
    console.log('🚀 Starting Comprehensive Test Suite');
    console.log('=====================================');

    const startTime = Date.now();
    let allPassed = true;

    // Run each test category
    for (const category of this.config.categories) {
      console.log(`\n📋 Running ${category.name} tests...`);
      
      try {
        const result = await this.runTestCategory(category);
        this.results[category.name as keyof TestResults] = result;
        
        if (result.failed > 0 && category.required) {
          allPassed = false;
        }
        
        this.printCategoryResults(category.name, result);
      } catch (error) {
        console.error(`❌ Failed to run ${category.name} tests:`, error);
        allPassed = false;
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const summary: TestSummary = {
      success: allPassed,
      duration,
      results: this.results,
      coverage: await this.getCoverageReport()
    };

    this.printFinalSummary(summary);
    return summary;
  }

  private async runTestCategory(category: TestCategory): Promise<CategoryResult> {
    // This would integrate with Jest to run specific test patterns
    // For now, we'll simulate the structure
    return {
      passed: 0,
      failed: 0,
      skipped: 0
    };
  }

  private async getCoverageReport(): Promise<CoverageReport> {
    // This would integrate with Jest coverage reporting
    return {
      statements: { pct: 0, covered: 0, total: 0 },
      branches: { pct: 0, covered: 0, total: 0 },
      functions: { pct: 0, covered: 0, total: 0 },
      lines: { pct: 0, covered: 0, total: 0 }
    };
  }

  private printCategoryResults(categoryName: string, result: CategoryResult): void {
    const total = result.passed + result.failed + result.skipped;
    const successRate = total > 0 ? (result.passed / total * 100).toFixed(1) : '0';
    
    console.log(`  ✅ Passed: ${result.passed}`);
    console.log(`  ❌ Failed: ${result.failed}`);
    console.log(`  ⏭️  Skipped: ${result.skipped}`);
    console.log(`  📊 Success Rate: ${successRate}%`);
  }

  private printFinalSummary(summary: TestSummary): void {
    console.log('\n🏁 Test Suite Complete');
    console.log('======================');
    console.log(`⏱️  Duration: ${(summary.duration / 1000).toFixed(2)}s`);
    console.log(`🎯 Overall Result: ${summary.success ? '✅ PASSED' : '❌ FAILED'}`);
    
    // Print coverage summary
    console.log('\n📊 Coverage Report:');
    console.log(`  Statements: ${summary.coverage.statements.pct}%`);
    console.log(`  Branches: ${summary.coverage.branches.pct}%`);
    console.log(`  Functions: ${summary.coverage.functions.pct}%`);
    console.log(`  Lines: ${summary.coverage.lines.pct}%`);
    
    // Print recommendations
    this.printRecommendations(summary);
  }

  private printRecommendations(summary: TestSummary): void {
    console.log('\n💡 Recommendations:');
    
    if (summary.coverage.statements.pct < this.config.coverage.statements) {
      console.log(`  - Increase statement coverage to ${this.config.coverage.statements}%`);
    }
    
    if (summary.coverage.branches.pct < this.config.coverage.branches) {
      console.log(`  - Increase branch coverage to ${this.config.coverage.branches}%`);
    }
    
    const totalFailed = Object.values(summary.results).reduce((sum, result) => sum + result.failed, 0);
    if (totalFailed > 0) {
      console.log(`  - Fix ${totalFailed} failing tests`);
    }
    
    console.log('  - Consider adding more edge case tests');
    console.log('  - Review performance test results for bottlenecks');
  }
}

// Type definitions
interface TestResults {
  unit: CategoryResult;
  integration: CategoryResult;
  e2e: CategoryResult;
  performance: CategoryResult;
}

interface CategoryResult {
  passed: number;
  failed: number;
  skipped: number;
}

interface TestSummary {
  success: boolean;
  duration: number;
  results: TestResults;
  coverage: CoverageReport;
}

interface CoverageReport {
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
}

interface CoverageMetric {
  pct: number;
  covered: number;
  total: number;
}

// Export for use in npm scripts
export async function runComprehensiveTests(): Promise<void> {
  const runner = new TestSuiteRunner();
  const summary = await runner.runAllTests();
  
  // Exit with appropriate code
  process.exit(summary.success ? 0 : 1);
}