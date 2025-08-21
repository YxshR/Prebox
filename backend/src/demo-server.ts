import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Router } from 'express';
import { DemoAuthService } from './demo/demo-auth.service';
import { LoginCredentials } from './shared/types';
import Joi from 'joi';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(helmet());

// Enhanced CORS configuration for demo mode
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.ADMIN_FRONTEND_URL || 'http://localhost:3002',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002'
    ];
    
    // In development, be more permissive
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Demo Auth Service
const demoAuthService = new DemoAuthService();

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Auth Routes
const authRouter = Router();

// Login endpoint
authRouter.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const credentials: LoginCredentials = value;
    console.log('🎭 Demo login attempt:', credentials.email);
    
    const authToken = await demoAuthService.login(credentials);

    res.json({
      success: true,
      data: authToken
    });
  } catch (error: any) {
    console.error('Login error:', error.message);
    res.status(401).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: error.message
      }
    });
  }
});

// Get current user endpoint
authRouter.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token required'
        }
      });
    }

    const token = authHeader.substring(7);
    const user = await demoAuthService.validateToken(token);
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
});

// Refresh token endpoint
authRouter.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REFRESH_TOKEN_REQUIRED',
          message: 'Refresh token is required'
        }
      });
    }

    const authToken = await demoAuthService.refreshToken(refreshToken);

    res.json({
      success: true,
      data: authToken
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: error.message
      }
    });
  }
});

// Demo users endpoint
authRouter.get('/demo-users', (req, res) => {
  const users = demoAuthService.getDemoUsers();
  res.json({
    success: true,
    data: { users }
  });
});

// Mount auth routes
app.use('/api/auth', authRouter);

// Mock endpoints for other services
app.use('/api/subscriptions', (req, res) => {
  res.json({
    success: true,
    message: 'Subscriptions API is disabled in demo mode',
    data: null
  });
});

app.use('/api/emails', (req, res) => {
  res.json({
    success: true,
    message: 'Email API is disabled in demo mode',
    data: null
  });
});

app.use('/api/campaigns', (req, res) => {
  res.json({
    success: true,
    message: 'Campaigns API is disabled in demo mode',
    data: null
  });
});

app.use('/api/templates', (req, res) => {
  res.json({
    success: true,
    message: 'Templates API is disabled in demo mode',
    data: null
  });
});

app.use('/api/ai-templates', (req, res) => {
  res.json({
    success: true,
    message: 'AI Templates API is disabled in demo mode',
    data: null
  });
});

app.use('/api/branding', (req, res) => {
  res.json({
    success: true,
    message: 'Branding API is disabled in demo mode',
    data: null
  });
});

app.use('/api/contacts', (req, res) => {
  res.json({
    success: true,
    message: 'Contacts API is disabled in demo mode',
    data: null
  });
});

app.use('/api/domains', (req, res) => {
  res.json({
    success: true,
    message: 'Domains API is disabled in demo mode',
    data: null
  });
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Bulk Email Platform Demo API is running',
    timestamp: new Date().toISOString(),
    mode: 'DEMO'
  });
});

app.get('/health/detailed', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime() * 1000,
      version: '1.0.0-demo',
      environment: 'demo',
      mode: 'DEMO',
      services: {
        auth: { status: 'healthy' },
        api: { status: 'healthy' }
      },
      performance: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    }
  });
});

app.get('/health/ready', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      ready: true,
      message: 'Demo service is ready',
      mode: 'DEMO'
    }
  });
});

app.get('/health/live', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      alive: true,
      uptime: process.uptime() * 1000,
      mode: 'DEMO'
    }
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎭 Demo Backend server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Demo users: http://localhost:${PORT}/api/auth/demo-users`);
  console.log(`📱 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  
  // Log demo users
  const users = demoAuthService.getDemoUsers();
  console.log('\n📋 Available Demo Users:');
  users.forEach(user => {
    console.log(`   ${user.email} (${user.subscriptionTier})`);
  });
});

export default app;