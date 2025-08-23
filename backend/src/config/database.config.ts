import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | { rejectUnauthorized: boolean };
  maxConnections: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
}

export interface Auth0Config {
  clientId: string;
  clientSecret: string;
  domain: string;
  apiIdentifier: string;
  callbackUrl: string;
  successRedirect: string;
  errorRedirect: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  apiKey?: string;
  apiSecret?: string;
  serviceSid?: string;
  phoneNumber: string;
  verifyServiceSid?: string;
}

export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  webhookSecret?: string;
}

export interface OTPConfig {
  expiryMinutes: number;
  maxAttempts: number;
  rateLimitWindowMs: number;
  rateLimitMaxAttempts: number;
}

export interface EmailVerificationConfig {
  expiryHours: number;
  codeLength: number;
}

export interface JWTConfig {
  secret: string;
  refreshSecret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

/**
 * Database configuration
 */
export const databaseConfig: DatabaseConfig = {
  host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432'),
  database: process.env.DATABASE_NAME || process.env.DB_NAME || 'bulk_email_platform',
  user: process.env.DATABASE_USER || process.env.DB_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000'),
  connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000'),
};

/**
 * Auth0 configuration
 */
export const auth0Config: Auth0Config = {
  clientId: process.env.AUTH0_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  domain: process.env.AUTH0_DOMAIN || '',
  apiIdentifier: process.env.AUTH0_API_IDENTIFIER || '',
  callbackUrl: process.env.AUTH0_CALLBACK_URL || 'http://localhost:8000/api/auth/auth0/callback',
  successRedirect: process.env.AUTH0_SUCCESS_REDIRECT || 'http://localhost:3000/auth/success',
  errorRedirect: process.env.AUTH0_ERROR_REDIRECT || 'http://localhost:3000/auth/error',
};

/**
 * Twilio configuration
 */
export const twilioConfig: TwilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID || '',
  authToken: process.env.TWILIO_AUTH_TOKEN || '',
  apiKey: process.env.TWILIO_API_KEY,
  apiSecret: process.env.TWILIO_API_SECRET,
  serviceSid: process.env.TWILIO_SERVICE_SID,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
};

/**
 * SendGrid configuration
 */
export const sendGridConfig: SendGridConfig = {
  apiKey: process.env.SENDGRID_API_KEY || '',
  fromEmail: process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || 'noreply@yourdomain.com',
  webhookSecret: process.env.SENDGRID_WEBHOOK_SECRET,
};

/**
 * OTP configuration
 */
export const otpConfig: OTPConfig = {
  expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10'),
  maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5'),
  rateLimitWindowMs: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS || '300000'), // 5 minutes
  rateLimitMaxAttempts: parseInt(process.env.OTP_RATE_LIMIT_MAX_ATTEMPTS || '3'),
};

/**
 * Email verification configuration
 */
export const emailVerificationConfig: EmailVerificationConfig = {
  expiryHours: parseInt(process.env.EMAIL_VERIFICATION_EXPIRY_HOURS || '24'),
  codeLength: parseInt(process.env.EMAIL_VERIFICATION_CODE_LENGTH || '6'),
};

/**
 * JWT configuration
 */
export const jwtConfig: JWTConfig = {
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const requiredEnvVars = [
    'DATABASE_HOST',
    'DATABASE_NAME',
    'DATABASE_USER',
    'DATABASE_PASSWORD',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate Auth0 config if Auth0 is enabled
  if (process.env.ENABLE_AUTH0 === 'true') {
    const requiredAuth0Vars = ['AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_DOMAIN'];
    const missingAuth0Vars = requiredAuth0Vars.filter(varName => !process.env[varName]);
    
    if (missingAuth0Vars.length > 0) {
      throw new Error(`Missing required Auth0 environment variables: ${missingAuth0Vars.join(', ')}`);
    }
  }

  // Validate Twilio config if phone verification is enabled
  if (process.env.ENABLE_PHONE_VERIFICATION === 'true') {
    const requiredTwilioVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'];
    const missingTwilioVars = requiredTwilioVars.filter(varName => !process.env[varName]);
    
    if (missingTwilioVars.length > 0) {
      throw new Error(`Missing required Twilio environment variables: ${missingTwilioVars.join(', ')}`);
    }
  }

  // Validate SendGrid config if email verification is enabled
  if (process.env.ENABLE_EMAIL_VERIFICATION === 'true') {
    if (!process.env.SENDGRID_API_KEY && !process.env.AWS_ACCESS_KEY_ID) {
      throw new Error('Either SENDGRID_API_KEY or AWS credentials must be provided for email verification');
    }
  }
}