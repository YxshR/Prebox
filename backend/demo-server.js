const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mode: 'demo'
  });
});

// Simple health endpoint for frontend
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Mock API endpoints for demo
app.get('/api/campaigns', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 1,
        name: 'Welcome Campaign',
        status: 'active',
        sent: 1250,
        delivered: 1200,
        opened: 480,
        clicked: 120
      },
      {
        id: 2,
        name: 'Product Launch',
        status: 'completed',
        sent: 5000,
        delivered: 4850,
        opened: 1940,
        clicked: 485
      }
    ]
  });
});

app.get('/api/analytics/overview', (req, res) => {
  res.json({
    success: true,
    data: {
      totalSent: 6250,
      totalDelivered: 6050,
      totalOpened: 2420,
      totalClicked: 605,
      deliveryRate: 96.8,
      openRate: 38.7,
      clickRate: 9.7
    }
  });
});

// Catch all for API routes
app.use('/api/*', (req, res) => {
  res.json({
    success: true,
    message: 'Demo API endpoint',
    endpoint: req.path,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Demo Backend Server running on port ${PORT}`);
  console.log(`📚 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🎭 Demo Mode: All features are mocked for demonstration`);
});