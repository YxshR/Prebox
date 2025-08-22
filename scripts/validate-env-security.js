#!/usr/bin/env node

/**
 * Environment Security Validation Script
 * 
 * This script validates that:
 * 1. No production credentials are committed to Git
 * 2. All .env files are properly ignored
 * 3. .env.example files exist and are up to date
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Patterns that indicate production credentials
const PRODUCTION_PATTERNS = [
  /sk_live_/i,                    // Stripe live keys
  /pk_live_/i,                    // Stripe live public keys
  /rk_live_/i,                    // Razorpay live keys
  /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/,  // SendGrid API keys
  /AC[a-f0-9]{32}/,               // Twilio Account SID
  /SK[a-f0-9]{32}/,               // Twilio API Key SID
  /[A-Za-z0-9]{32,}/,             // Long API keys (generic)
  /@[a-zA-Z0-9.-]+\.amazonaws\.com/,  // AWS RDS endpoints
  /@[a-zA-Z0-9.-]+\.rds\.amazonaws\.com/,  // AWS RDS endpoints
  /redis-[0-9]+\..*\.redns\.redis-cloud\.com/,  // Redis Cloud endpoints
  /ep-.*\..*\.aws\.neon\.tech/,   // Neon database endpoints
];

// Sensitive environment variable names
const SENSITIVE_ENV_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SENDGRID_API_KEY',
  'STRIPE_SECRET_KEY',
  'TWILIO_AUTH_TOKEN',
  'GOOGLE_CLIENT_SECRET',
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'RAZORPAY_KEY_SECRET',
  'ENCRYPTION_KEY',
  'SESSION_SECRET'
];

class EnvSecurityValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.projectRoot = process.cwd();
  }

  /**
   * Main validation function
   */
  validate() {
    console.log('🔍 Validating environment security...\n');

    this.checkGitIgnoreFiles();
    this.checkEnvFiles();
    this.checkCommittedFiles();
    this.checkEnvExampleFiles();

    this.printResults();
    
    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  /**
   * Check that .gitignore files properly exclude .env files
   */
  checkGitIgnoreFiles() {
    console.log('📋 Checking .gitignore files...');

    const gitignoreFiles = [
      '.gitignore',
      'frontend/.gitignore',
      'backend/.gitignore',
      'admin-frontend/.gitignore'
    ];

    gitignoreFiles.forEach(gitignoreFile => {
      const fullPath = path.join(this.projectRoot, gitignoreFile);
      
      if (!fs.existsSync(fullPath)) {
        this.warnings.push(`Missing .gitignore file: ${gitignoreFile}`);
        return;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Check if .env files are ignored
      if (!content.includes('.env') && !content.includes('.env*')) {
        this.errors.push(`${gitignoreFile} does not ignore .env files`);
      }

      // Check if .env.example files are explicitly included
      if (gitignoreFile !== '.gitignore' && !content.includes('!.env.example')) {
        this.warnings.push(`${gitignoreFile} should explicitly include .env.example files`);
      }
    });

    console.log('✅ .gitignore files checked\n');
  }

  /**
   * Check .env files for production credentials
   */
  checkEnvFiles() {
    console.log('🔐 Checking .env files for production credentials...');

    const envFiles = [
      'frontend/.env',
      'backend/.env',
      'admin-frontend/.env'
    ];

    envFiles.forEach(envFile => {
      const fullPath = path.join(this.projectRoot, envFile);
      
      if (!fs.existsSync(fullPath)) {
        this.warnings.push(`Missing .env file: ${envFile}`);
        return;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Check for production patterns
      PRODUCTION_PATTERNS.forEach(pattern => {
        if (pattern.test(content)) {
          this.errors.push(`${envFile} contains production credentials matching pattern: ${pattern}`);
        }
      });

      // Check for suspicious values in sensitive variables
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('#') || !trimmedLine.includes('=')) {
          return;
        }

        const [key, value] = trimmedLine.split('=', 2);
        const cleanKey = key.trim();
        const cleanValue = value ? value.trim().replace(/['"]/g, '') : '';

        if (SENSITIVE_ENV_VARS.includes(cleanKey)) {
          // Check if value looks like a placeholder
          if (cleanValue && 
              !cleanValue.startsWith('your-') && 
              !cleanValue.startsWith('dev-') &&
              !cleanValue.includes('localhost') &&
              !cleanValue.includes('development') &&
              !cleanValue.includes('placeholder') &&
              cleanValue !== 'postgres' &&
              cleanValue.length > 10) {
            
            this.warnings.push(`${envFile}:${index + 1} - ${cleanKey} may contain real credentials`);
          }
        }
      });
    });

    console.log('✅ .env files checked\n');
  }

  /**
   * Check if any .env files are committed to Git
   */
  checkCommittedFiles() {
    console.log('📝 Checking for committed .env files...');

    try {
      const committedFiles = execSync('git ls-files', { encoding: 'utf8' });
      const fileList = committedFiles.split('\n').filter(file => file.trim());

      const committedEnvFiles = fileList.filter(file => 
        file.endsWith('.env') && !file.endsWith('.env.example')
      );

      if (committedEnvFiles.length > 0) {
        committedEnvFiles.forEach(file => {
          this.errors.push(`Environment file is committed to Git: ${file}`);
        });
      }

      // Check for files with potential credentials in Git history
      try {
        const gitLog = execSync('git log --all --full-history --grep="password\\|secret\\|key\\|token" --oneline', { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        if (gitLog.trim()) {
          this.warnings.push('Found commits with potential credential-related keywords in Git history');
        }
      } catch (error) {
        // Git log command failed, but this is not critical
      }

    } catch (error) {
      this.warnings.push('Could not check Git status (not a Git repository?)');
    }

    console.log('✅ Git commit status checked\n');
  }

  /**
   * Check that .env.example files exist and are up to date
   */
  checkEnvExampleFiles() {
    console.log('📄 Checking .env.example files...');

    const envPairs = [
      { env: 'frontend/.env', example: 'frontend/.env.example' },
      { env: 'backend/.env', example: 'backend/.env.example' },
      { env: 'admin-frontend/.env', example: 'admin-frontend/.env.example' }
    ];

    envPairs.forEach(({ env, example }) => {
      const envPath = path.join(this.projectRoot, env);
      const examplePath = path.join(this.projectRoot, example);

      if (!fs.existsSync(examplePath)) {
        this.errors.push(`Missing .env.example file: ${example}`);
        return;
      }

      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const exampleContent = fs.readFileSync(examplePath, 'utf8');

        // Extract environment variable names
        const envVars = this.extractEnvVars(envContent);
        const exampleVars = this.extractEnvVars(exampleContent);

        // Check for missing variables in example
        const missingInExample = envVars.filter(varName => !exampleVars.includes(varName));
        const missingInEnv = exampleVars.filter(varName => !envVars.includes(varName));

        if (missingInExample.length > 0) {
          this.warnings.push(`${example} is missing variables: ${missingInExample.join(', ')}`);
        }

        if (missingInEnv.length > 0) {
          this.warnings.push(`${env} is missing variables from example: ${missingInEnv.join(', ')}`);
        }
      }
    });

    console.log('✅ .env.example files checked\n');
  }

  /**
   * Extract environment variable names from file content
   */
  extractEnvVars(content) {
    const lines = content.split('\n');
    const vars = [];

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('#') || !trimmedLine.includes('=')) {
        return;
      }

      const [key] = trimmedLine.split('=', 2);
      const cleanKey = key.trim();
      if (cleanKey) {
        vars.push(cleanKey);
      }
    });

    return vars;
  }

  /**
   * Print validation results
   */
  printResults() {
    console.log('📊 Validation Results:');
    console.log('='.repeat(50));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All environment security checks passed!');
      return;
    }

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

    console.log('\n' + '='.repeat(50));
    
    if (this.errors.length > 0) {
      console.log('❌ Validation failed. Please fix the errors above.');
    } else {
      console.log('✅ Validation passed with warnings.');
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new EnvSecurityValidator();
  validator.validate();
}

module.exports = EnvSecurityValidator;