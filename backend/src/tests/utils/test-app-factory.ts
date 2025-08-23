/**
 * Test Application Factory
 * Creates configured Express app for testing
 */

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { json, urlencoded } from 'express';

// Import all route modules
import authRoutes from '../../auth/auth.routes';
import multiStepSignupRoutes from '../../auth/multi-step-signup.routes';
import loginRoutes from '../../auth/login.routes';
import auth0Routes from '../../auth/auth0.routes';
import pricingRoutes from '../../pricing/pricing.routes';
import healthRoutes from '../../health/health.routes';

// Import middleware
import { apiErrorHandler } from '../../middleware/api-error-handler.middleware';
import { validationMiddleware } from '../../shared/validation.middleware';

export async function createTestApp(): Promise<Express> {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for testing
    crossOriginEmbedderPolicy: false
  }));

  // CORS configuration for testing
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Rate limiting (more lenient for testing)
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Higher limit for testing
    message: {
      success: false,
      error: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api/', limiter);

  // Body parsing middleware
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Request logging for tests
  app.use((req, res, next) => {
    console.log(`[TEST] ${req.method} ${req.path}`, {
      body: req.body,
      query: req.query,
      headers: req.headers.authorization ? 'Bearer ***' : 'none'
    });
    next();
  });

  // Health check endpoint
  app.use('/api/health', healthRoutes);

  // Authentication routes
  app.use('/api/auth', authRoutes);
  app.use('/api/auth/signup', multiStepSignupRoutes);
  app.use('/api/auth/login', loginRoutes);
  app.use('/api/auth', auth0Routes);

  // Pricing routes
  app.use('/api/pricing', pricingRoutes);

  // Test-specific routes
  app.get('/api/test/ping', (req, res) => {
    res.json({ success: true, message: 'Test server is running' });
  });

  // Error handling middleware (must be last)
  app.use(apiErrorHandler);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      code: 'NOT_FOUND',
      path: req.originalUrl
    });
  });

  return app;
}

export async function createMinimalTestApp(): Promise<Express> {
  const app = express();
  
  app.use(json());
  app.use(cors());
  
  // Minimal routes for basic testing
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  return app;
}