const express = require('express');
const cors = require('cors');

console.log('Starting server setup...');

const app = express();
const PORT = 8000;

console.log('Setting up middleware...');

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  credentials: true
}));
app.use(express.json());

console.log('Setting up routes...');

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mode: 'SIMPLE_DEMO'
    }
  });
});

app.get('/api/health', (req, res) => {
  console.log('API Health check requested');
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mode: 'SIMPLE_DEMO'
    }
  });
});

// Mock auth endpoints
app.post('/api/auth/login', (req, res) => {
  console.log('Login requested:', req.body);
  res.json({
    success: true,
    data: {
      user: {
        id: 1,
        email: req.body.email || 'demo@example.com',
        name: 'Demo User'
      },
      token: 'demo-token-123'
    }
  });
});

app.get('/api/auth/me', (req, res) => {
  console.log('Get current user requested');
  res.json({
    success: true,
    data: {
      user: {
        id: 1,
        email: 'demo@example.com',
        name: 'Demo User'
      }
    }
  });
});

// Mock dashboard data
app.get('/api/dashboard', (req, res) => {
  console.log('Dashboard data requested');
  res.json({
    success: true,
    data: {
      stats: {
        totalEmails: 1250,
        emailsSent: 1180,
        openRate: 24.5,
        clickRate: 3.2,
        bounceRate: 2.1
      },
      recentCampaigns: [
        {
          id: 1,
          name: 'Welcome Series',
          status: 'active',
          sent: 450,
          opens: 112,
          clicks: 18,
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ]
    }
  });
});

// Mock other endpoints
app.use('/api/*', (req, res) => {
  console.log('Generic API endpoint requested:', req.path);
  res.json({
    success: true,
    message: 'API endpoint working in demo mode',
    data: null
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log('404 - Not found:', req.path);
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  });
});

console.log('Starting server on port', PORT);

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Simple Backend server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 API Health check: http://localhost:${PORT}/api/health`);
  console.log(`📱 Frontend: http://localhost:3000`);
  console.log('Server is ready to accept connections');
});

server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. Trying to kill existing process...`);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Graceful shutdown...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Graceful shutdown...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

console.log('Server setup complete, waiting for connections...');