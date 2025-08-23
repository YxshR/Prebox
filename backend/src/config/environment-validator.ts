#!/usr/bin/env ts-node

import { logger } from '../shared/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface ValidationResult {
  service: string;
  status: 'valid' | 'invalid' | 'warning';
  message: string;
  required: boolean;
}

/**
 * Validate environment configuration for all services
 */
async function validateEnvironment(): Promise<void> {
  logger.info('Starting environment configuration validation...');
  
  const results: ValidationResult[] = [];

  // Database Configuration
  results.push(validateDatabase());
  
  // Auth0 Configuration
  results.push(...validateAuth0());
  
  // Twilio Configuration
  results.push(...validateTwilio());
  
  // SendGrid Configuration
  results.push(...validateSendGrid());
  
  // JWT Configuration
  results.push(...validateJWT());
  
  // Redis Configuration
  results.push(validateRedis());

  // Display results
  displayResults(results);
  
  // Check if any critical services are invalid
  const criticalFailures = results.filter(r => r.required && r.status === 'invalid');
  if (criticalFailures.length > 0) {
    logger.error('Critical configuration errors found. Application may not function properly.');
    process.exit(1);
  } else {
    logger.info('Environment configuration validation completed successfully');
  }
}

function validateDatabase(): ValidationResult {
  const required = ['DATABASE_URL', 'DATABASE_HOST', 'DATABASE_NAME', 'DATABASE_USER', 'DATABASE_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    return {
      service: 'Database',
      status: 'invalid',
      message: `Missing required variables: ${missing.join(', ')}`,
      required: true
    };
  }
  
  return {
    service: 'Database',
    status: 'valid',
    message: 'All database configuration variables present',
    required: true
  };
}

function validateAuth0(): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  const required = ['AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_DOMAIN'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    results.push({
      service: 'Auth0',
      status: 'invalid',
      message: `Missing required variables: ${missing.join(', ')}`,
      required: true
    });
  } else {
    results.push({
      service: 'Auth0',
      status: 'valid',
      message: 'Auth0 configuration complete',
      required: true
    });
  }
  
  // Check callback URLs
  const callbackUrls = ['AUTH0_CALLBACK_URL', 'AUTH0_SUCCESS_REDIRECT', 'AUTH0_ERROR_REDIRECT'];
  const missingCallbacks = callbackUrls.filter(key => !process.env[key]);
  
  if (missingCallbacks.length > 0) {
    results.push({
      service: 'Auth0 Callbacks',
      status: 'warning',
      message: `Missing callback URLs: ${missingCallbacks.join(', ')}`,
      required: false
    });
  } else {
    results.push({
      service: 'Auth0 Callbacks',
      status: 'valid',
      message: 'All Auth0 callback URLs configured',
      required: false
    });
  }
  
  return results;
}

function validateTwilio(): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  const required = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    results.push({
      service: 'Twilio',
      status: 'invalid',
      message: `Missing required variables: ${missing.join(', ')}`,
      required: true
    });
  } else {
    results.push({
      service: 'Twilio',
      status: 'valid',
      message: 'Twilio SMS verification configuration complete',
      required: true
    });
  }
  
  // Check OTP configuration
  const otpConfig = ['OTP_EXPIRY_MINUTES', 'OTP_MAX_ATTEMPTS'];
  const missingOtp = otpConfig.filter(key => !process.env[key]);
  
  if (missingOtp.length > 0) {
    results.push({
      service: 'OTP Configuration',
      status: 'warning',
      message: `Missing OTP settings: ${missingOtp.join(', ')} - using defaults`,
      required: false
    });
  } else {
    results.push({
      service: 'OTP Configuration',
      status: 'valid',
      message: 'OTP configuration complete',
      required: false
    });
  }
  
  return results;
}

function validateSendGrid(): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  const required = ['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    results.push({
      service: 'SendGrid',
      status: 'invalid',
      message: `Missing required variables: ${missing.join(', ')}`,
      required: true
    });
  } else {
    results.push({
      service: 'SendGrid',
      status: 'valid',
      message: 'SendGrid email service configuration complete',
      required: true
    });
  }
  
  // Check email verification settings
  const emailConfig = ['EMAIL_VERIFICATION_EXPIRY_HOURS', 'EMAIL_VERIFICATION_CODE_LENGTH'];
  const missingEmail = emailConfig.filter(key => !process.env[key]);
  
  if (missingEmail.length > 0) {
    results.push({
      service: 'Email Verification',
      status: 'warning',
      message: `Missing email verification settings: ${missingEmail.join(', ')} - using defaults`,
      required: false
    });
  } else {
    results.push({
      service: 'Email Verification',
      status: 'valid',
      message: 'Email verification configuration complete',
      required: false
    });
  }
  
  return results;
}

function validateJWT(): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    results.push({
      service: 'JWT',
      status: 'invalid',
      message: `Missing required variables: ${missing.join(', ')}`,
      required: true
    });
  } else {
    // Check if using development secrets in production
    const isDev = process.env.NODE_ENV !== 'production';
    const hasDevSecrets = process.env.JWT_SECRET?.includes('dev-') || 
                         process.env.JWT_REFRESH_SECRET?.includes('dev-');
    
    if (!isDev && hasDevSecrets) {
      results.push({
        service: 'JWT',
        status: 'warning',
        message: 'Using development JWT secrets in production environment',
        required: true
      });
    } else {
      results.push({
        service: 'JWT',
        status: 'valid',
        message: 'JWT configuration complete',
        required: true
      });
    }
  }
  
  return results;
}

function validateRedis(): ValidationResult {
  const required = ['REDIS_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    return {
      service: 'Redis',
      status: 'warning',
      message: `Missing Redis configuration: ${missing.join(', ')} - caching disabled`,
      required: false
    };
  }
  
  return {
    service: 'Redis',
    status: 'valid',
    message: 'Redis caching configuration complete',
    required: false
  };
}

function displayResults(results: ValidationResult[]): void {
  logger.info('\n=== Environment Configuration Validation Results ===');
  
  const valid = results.filter(r => r.status === 'valid');
  const warnings = results.filter(r => r.status === 'warning');
  const invalid = results.filter(r => r.status === 'invalid');
  
  if (valid.length > 0) {
    logger.info('\n✅ Valid Configurations:');
    valid.forEach(r => logger.info(`  ✓ ${r.service}: ${r.message}`));
  }
  
  if (warnings.length > 0) {
    logger.warn('\n⚠️  Warnings:');
    warnings.forEach(r => logger.warn(`  ⚠ ${r.service}: ${r.message}`));
  }
  
  if (invalid.length > 0) {
    logger.error('\n❌ Invalid Configurations:');
    invalid.forEach(r => logger.error(`  ✗ ${r.service}: ${r.message}`));
  }
  
  logger.info(`\nSummary: ${valid.length} valid, ${warnings.length} warnings, ${invalid.length} errors`);
}

// Run validation if called directly
if (require.main === module) {
  validateEnvironment();
}

export { validateEnvironment };