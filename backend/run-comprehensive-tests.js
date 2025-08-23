#!/usr/bin/env node

/**
 * Comprehensive Test Runner Script
 * Runs all authentication system tests and generates reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Comprehensive Authentication System Tests');
console.log('===================================================\n');

// Test configuration
const testSuites = [
  {
    name: 'Unit Tests',
    command: 'npm run test:unit',
    description: 'Testing individual service components'
  },
  {
    name: 'Integration Tests', 
    command: 'npm run test:integration',
    description: 'Testing database and external service integrations'
  },
  {
    name: 'End-to-End Tests',
    command: 'npm run test:e2e', 
    description: 'Testing complete authentication flows'
  },
  {
    name: 'Performance Tests',
    command: 'npm run test:performance',
    description: 'Testing system performance under load'
  }
];

let totalPassed = 0;
let totalFailed = 0;
const results = [];

async function runTestSuite(suite) {
  console.log(`\n📋 Running ${suite.name}`);
  console.log(`Description: ${suite.description}`);
  console.log('─'.repeat(50));

  const startTime = Date.now();
  
  try {
    const output = execSync(suite.command, {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${suite.name} - PASSED (${Math.round(duration / 1000)}s)`);
    
    results.push({
      name: suite.name,
      passed: true,
      duration,
      output: output.substring(0, 500) // Truncate output
    });
    
    totalPassed++;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.log(`❌ ${suite.name} - FAILED (${Math.round(duration / 1000)}s)`);
    console.log(`Error: ${error.message.substring(0, 200)}...`);
    
    results.push({
      name: suite.name,
      passed: false,
      duration,
      error: error.message.substring(0, 500)
    });
    
    totalFailed++;
  }
}

async function generateReport() {
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`Total Test Suites: ${totalPassed + totalFailed}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Success Rate: ${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%\n`);

  // Detailed results
  console.log('Detailed Results:');
  console.log('-----------------');
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    const duration = Math.round(result.duration / 1000);
    console.log(`${status} ${result.name} - ${duration}s`);
    
    if (!result.passed && result.error) {
      console.log(`    └─ ${result.error.split('\n')[0]}`);
    }
  });

  // Save report to file
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalPassed + totalFailed,
      passed: totalPassed,
      failed: totalFailed,
      successRate: Math.round((totalPassed / (totalPassed + totalFailed)) * 100)
    },
    results
  };

  const reportPath = path.join(__dirname, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);

  // Recommendations
  console.log('\n💡 Recommendations:');
  if (totalFailed > 0) {
    console.log('• Fix failing tests before deployment');
    console.log('• Review error messages for security issues');
  } else {
    console.log('• All tests passed! System is ready for deployment');
  }

  // Exit with appropriate code
  process.exit(totalFailed > 0 ? 1 : 0);
}

async function main() {
  try {
    // Check if we're in the right directory
    if (!fs.existsSync('package.json')) {
      console.error('❌ Please run this script from the backend directory');
      process.exit(1);
    }

    // Check if dependencies are installed
    if (!fs.existsSync('node_modules')) {
      console.log('📦 Installing dependencies...');
      execSync('npm install', { stdio: 'inherit' });
    }

    // Run all test suites
    for (const suite of testSuites) {
      await runTestSuite(suite);
    }

    // Generate final report
    await generateReport();

  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️  Test run interrupted');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error.message);
  process.exit(1);
});

// Run the tests
main();