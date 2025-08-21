import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment configuration with validation
export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || 'v1',

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || process.env.DEV_DATABASE_URL,
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    name: process.env.DATABASE_NAME || 'bulk_email_platform',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || process.env.DEV_REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Email Service Provider Configuration
  email: {
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      fromEmail: process.env.SES_FROM_EMAIL,
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL,
    },
  },

  // Payment Gateway Configuration
  payment: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
    },
  },

  // AI Service Configuration
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY,
    },
  },

  // Application Configuration
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3002'],
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },

  // Security
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  },

  // Feature Flags
  features: {
    emailVerification: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
    phoneVerification: process.env.ENABLE_PHONE_VERIFICATION === 'true',
    aiTemplates: process.env.ENABLE_AI_TEMPLATES === 'true',
    customDomains: process.env.ENABLE_CUSTOM_DOMAINS === 'true',
  },

  // Application URLs
  urls: {
    frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
    adminFrontend: process.env.ADMIN_FRONTEND_URL || 'http://localhost:3002',
  },
};

// Validate required environment variables
export const validateEnvironment = (): void => {
  const requiredVars = [
    'JWT_SECRET',
    'DATABASE_URL',
    'REDIS_URL',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    
    if (config.nodeEnv === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Running in development mode with default values');
    }
  }
};

// Development environment check
export const isDevelopment = (): boolean => config.nodeEnv === 'development';
export const isProduction = (): boolean => config.nodeEnv === 'production';
export const isTest = (): boolean => config.nodeEnv === 'test';