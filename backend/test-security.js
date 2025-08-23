/**
 * Simple security test script to verify middleware functionality
 * This bypasses Jest to test our security implementation directly
 */

const express = require('express');
const request = require('supertest');

// Mock the logger and redis for testing
const mockLogger = {
  info: console.log,
  warn: console.warn,
  error: console.error
};

const mockRedis = {
  connect: async () => Promise.resolve(),
  quit: async () => Promise.resolve(),
  setEx: async () => Promise.resolve('OK'),
  get: async () => Promise.resolve(null),
  del: async () => Promise.resolve(1),
  on: () => {},
  off: () => {}
};

// Set up environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DEMO_MODE = 'true';

async function testSecurityMiddleware() {
  console.log('🔒 Testing Security Middleware...');
  
  try {
    // Import our security classes (using require for Node.js compatibility)
    const { ComprehensiveSecurityMiddleware } = require('./dist/auth/comprehensive-security.middleware.js');
    const { SecurityIntegration } = require('./dist/auth/security-integration.middleware.js');
    
    const app = express();
    const securityIntegration = new SecurityIntegration();
    
    // Initialize security
    securityIntegration.initializeAllSecurity(app);
    app.use(express.json());
    
    // Add test endpoints
    app.get('/test/health', (req, res) => {
      res.json({ status: 'ok', security: 'enabled' });
    });
    
    app.post('/test/auth', (req, res) => {
      res.json({ success: true, data: req.body });
    });
    
    // Test 1: Security headers
    console.log('Testing security headers...');
    const headerResponse = await request(app)
      .get('/test/health')
      .expect(200);
    
    const hasSecurityHeaders = 
      headerResponse.headers['x-content-type-options'] === 'nosniff' &&
      headerResponse.headers['x-frame-options'] === 'DENY' &&
      headerResponse.headers['x-request-id'];
    
    console.log('✅ Security headers:', hasSecurityHeaders ? 'PASS' : 'FAIL');
    
    // Test 2: CORS
    console.log('Testing CORS...');
    const corsResponse = await request(app)
      .get('/test/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    
    const hasCors = corsResponse.headers['access-control-allow-origin'];
    console.log('✅ CORS headers:', hasCors ? 'PASS' : 'FAIL');
    
    // Test 3: Input sanitization
    console.log('Testing input sanitization...');
    const sanitizeResponse = await request(app)
      .post('/test/auth')
      .send({ 
        message: 'Hello <script>alert("xss")</script> World',
        email: 'test@example.com'
      })
      .expect(200);
    
    const isSanitized = !sanitizeResponse.body.data.message.includes('<script>');
    console.log('✅ Input sanitization:', isSanitized ? 'PASS' : 'FAIL');
    
    // Test 4: Password hashing
    console.log('Testing password hashing...');
    const password = 'testPassword123!';
    const hash1 = await ComprehensiveSecurityMiddleware.hashPassword(password);
    const hash2 = await ComprehensiveSecurityMiddleware.hashPassword(password);
    const isValid = await ComprehensiveSecurityMiddleware.verifyPassword(password, hash1);
    
    const hashingWorks = hash1 !== hash2 && isValid && hash1.startsWith('$2');
    console.log('✅ Password hashing:', hashingWorks ? 'PASS' : 'FAIL');
    
    // Test 5: JWT tokens
    console.log('Testing JWT tokens...');
    const payload = { userId: '123', email: 'test@example.com' };
    const token = ComprehensiveSecurityMiddleware.generateAccessToken(payload);
    const decoded = ComprehensiveSecurityMiddleware.verifyAccessToken(token);
    
    const jwtWorks = decoded.userId === payload.userId && decoded.email === payload.email;
    console.log('✅ JWT tokens:', jwtWorks ? 'PASS' : 'FAIL');
    
    console.log('\n🎉 Security middleware tests completed!');
    
    if (hasSecurityHeaders && hasCors && isSanitized && hashingWorks && jwtWorks) {
      console.log('✅ All security measures are working correctly!');
      return true;
    } else {
      console.log('❌ Some security measures failed!');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Security test failed:', error.message);
    return false;
  }
}

// Run the test
testSecurityMiddleware()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });