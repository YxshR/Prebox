# Authentication System Test Suite

## Overview

This directory contains comprehensive tests for the authentication system rebuild. The test suite covers all requirements from the specification and ensures the system works correctly across all authentication flows.

## Test Structure

```
src/tests/
├── e2e/                           # End-to-end tests
│   ├── authentication-flows.e2e.test.ts    # Complete auth flow tests
│   └── user-workflows.e2e.test.ts          # User journey tests
├── integration/                   # Integration tests
│   ├── database-operations.integration.test.ts     # Database tests
│   ├── external-services.integration.test.ts      # API integration tests
│   └── phone-auth-flow.integration.test.ts        # Phone auth tests
├── performance/                   # Performance tests
│   ├── auth-performance.test.ts             # Auth endpoint performance
│   └── database-performance.test.ts        # Database performance
├── comprehensive/                 # Cross-cutting tests
│   ├── security-services.test.ts           # Security component tests
│   └── pricing-jwt-validation.test.ts      # Pricing security tests
└── utils/                        # Test utilities
    ├── test-app-factory.ts               # Test app creation
    ├── test-data-seeder.ts               # Test data management
    ├── test-cleanup.ts                   # Cleanup utilities
    └── comprehensive-test-runner.ts      # Test orchestration
```

## Requirements Coverage

### Requirement 1: Multi-Step Phone Number Signup Flow
- **1.1** Phone number input and validation ✅
- **1.2** Duplicate phone number prevention ✅
- **1.3** OTP generation and SMS delivery ✅
- **1.4** OTP verification with retry logic ✅
- **1.5** Rate limiting and security measures ✅
- **1.6** Email verification step ✅
- **1.7** Email code validation ✅
- **1.8** Password creation and account completion ✅

### Requirement 2: Auth0 Signup Flow
- **2.1** Auth0 authentication integration ✅
- **2.2** Profile data synchronization ✅
- **2.3** Phone verification for Auth0 users ✅
- **2.4** Error handling and fallbacks ✅

### Requirement 3: Multiple Login Methods
- **3.1** Auth0 login ✅
- **3.2** Phone OTP login ✅
- **3.3** Email/password login ✅
- **3.4** JWT token management ✅
- **3.5** Session handling and security ✅

### Requirement 4: Database Schema and Data Integrity
- **4.1** Database table creation and constraints ✅
- **4.2** Unique constraint enforcement ✅
- **4.3** Data persistence and retrieval ✅

### Requirement 5: Pricing System Integration
- **5.1** Pricing data fetching ✅
- **5.2** Database connectivity ✅
- **5.3** Fallback pricing handling ✅
- **5.4** API endpoint functionality ✅
- **5.5** Error handling and recovery ✅

### Requirement 6: Security and Error Handling
- **6.1** Input validation and sanitization ✅
- **6.2** Rate limiting implementation ✅
- **6.3** JWT token security ✅
- **6.4** CORS configuration ✅
- **6.5** Error message security ✅
- **6.6** Database security measures ✅

## Test Types

### Unit Tests
Test individual components in isolation with mocked dependencies.

**Location:** `src/auth/**/*.test.ts`, `src/pricing/**/*.test.ts`

**Coverage:**
- Authentication services
- Database operations
- Validation logic
- Error handling
- Security components

**Run Command:**
```bash
npm run test:unit
```

### Integration Tests
Test component interactions with real external services and databases.

**Location:** `src/tests/integration/`

**Coverage:**
- Database operations with real connections
- External service integrations (Auth0, Twilio, SendGrid)
- API endpoint functionality
- Cross-service communication

**Run Command:**
```bash
npm run test:integration
```

### End-to-End Tests
Test complete user workflows from start to finish.

**Location:** `src/tests/e2e/`

**Coverage:**
- Complete signup flows
- All login methods
- Error scenarios
- User journeys
- System integration

**Run Command:**
```bash
npm run test:e2e
```

### Performance Tests
Test system performance under various load conditions.

**Location:** `src/tests/performance/`

**Coverage:**
- Authentication endpoint performance
- Database query optimization
- Concurrent user handling
- Rate limiting effectiveness

**Run Command:**
```bash
npm run test:performance
```

## Running Tests

### Individual Test Suites

```bash
# Run all unit tests
npm run test:unit

# Run all integration tests
npm run test:integration

# Run all end-to-end tests
npm run test:e2e

# Run performance tests
npm run test:performance

# Run comprehensive tests
npm run test:comprehensive
```

### Comprehensive Test Runner

Run all tests with detailed reporting:

```bash
# Run all test types
npm run test:all

# Run specific test type
npm run test:comprehensive -- --type unit
npm run test:comprehensive -- --type integration
npm run test:comprehensive -- --type e2e
npm run test:comprehensive -- --type performance

# Run specific test suite
npm run test:comprehensive -- --suite "Authentication Services"
```

### Coverage Reports

Generate test coverage reports:

```bash
# Generate coverage for all tests
npm run test:coverage

# Generate coverage for specific test type
npm run test:unit -- --coverage
npm run test:integration -- --coverage
```

## Test Configuration

### Jest Configuration
Tests use Jest with TypeScript support. Configuration is in `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/config/test-setup.ts'],
  testTimeout: 30000,
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    }
  }
};
```

### Environment Setup
Tests require specific environment variables:

```bash
# Test database
DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/test_db

# Test API keys (use test/sandbox keys)
TWILIO_ACCOUNT_SID=test_sid
TWILIO_AUTH_TOKEN=test_token
SENDGRID_API_KEY=test_key
AUTH0_DOMAIN=test.auth0.com
AUTH0_CLIENT_ID=test_client_id
AUTH0_CLIENT_SECRET=test_secret

# Test configuration
NODE_ENV=test
JWT_SECRET=test_jwt_secret
```

### Database Setup
Tests use a separate test database:

```bash
# Create test database
createdb auth_system_test

# Run migrations
npm run db:migrate -- --env=test

# Seed test data
npm run db:seed -- --env=test
```

## Test Data Management

### Test Data Seeder
The `TestDataSeeder` class provides utilities for creating test data:

```typescript
import { TestDataSeeder } from '../utils/test-data-seeder';

const seeder = new TestDataSeeder(dbService);

// Create test user
const user = await seeder.createUser({
  email: 'test@example.com',
  phone: '+1234567890',
  password: 'TestPass123!'
});

// Create phone verification
const verification = await seeder.createPhoneVerification('+1234567890');

// Seed pricing data
await seeder.seedPricingData();
```

### Test Cleanup
The `TestCleanup` class handles test data cleanup:

```typescript
import { TestCleanup } from '../utils/test-cleanup';

const cleanup = new TestCleanup(dbService);

// Clean up after each test
afterEach(async () => {
  await cleanup.cleanupUserData();
});

// Clean up after all tests
afterAll(async () => {
  await cleanup.cleanupAll();
});
```

## Mocking External Services

### Auth0 Mocking
```typescript
jest.mock('auth0', () => ({
  ManagementClient: jest.fn().mockImplementation(() => ({
    getUser: jest.fn().mockResolvedValue(mockUser),
    createUser: jest.fn().mockResolvedValue(mockUser)
  }))
}));
```

### Twilio Mocking
```typescript
jest.mock('twilio', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'test-message-sid',
        status: 'sent'
      })
    }
  }))
}));
```

### SendGrid Mocking
```typescript
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{
    statusCode: 202,
    body: '',
    headers: {}
  }])
}));
```

## Test Patterns

### Async Test Pattern
```typescript
describe('Authentication Service', () => {
  it('should create user successfully', async () => {
    const userData = { email: 'test@example.com' };
    
    const result = await authService.createUser(userData);
    
    expect(result).toMatchObject({
      email: userData.email,
      id: expect.any(String)
    });
  });
});
```

### Error Testing Pattern
```typescript
it('should handle duplicate email error', async () => {
  await seeder.createUser({ email: 'existing@example.com' });
  
  await expect(authService.createUser({ 
    email: 'existing@example.com' 
  })).rejects.toThrow(/duplicate key value/);
});
```

### Integration Test Pattern
```typescript
describe('Phone Signup Integration', () => {
  it('should complete full signup flow', async () => {
    // Step 1: Start signup
    const startResult = await request(app)
      .post('/api/auth/signup/phone/start')
      .send({ phone: '+1234567890' })
      .expect(200);
    
    // Step 2: Verify OTP
    const otpRecord = await seeder.getLatestPhoneVerification('+1234567890');
    const verifyResult = await request(app)
      .post('/api/auth/signup/phone/verify')
      .send({ phone: '+1234567890', otp: otpRecord.otp_code })
      .expect(200);
    
    expect(verifyResult.body.success).toBe(true);
  });
});
```

## Debugging Tests

### Debug Configuration
Add debug configuration to VS Code:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Verbose Output
Run tests with verbose output:

```bash
npm run test -- --verbose --no-coverage
```

### Debug Specific Test
```bash
npm run test -- --testNamePattern="should complete signup flow"
```

## Continuous Integration

### GitHub Actions Configuration
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:ci
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
```

### Test Reports
Tests generate multiple report formats:

- **JSON Report:** `test-reports/comprehensive-test-report-{timestamp}.json`
- **HTML Report:** `test-reports/comprehensive-test-report-{timestamp}.html`
- **Coverage Report:** `coverage/lcov-report/index.html`
- **JUnit Report:** `test-reports/junit.xml`

## Performance Benchmarks

### Expected Performance Metrics

| Test Type | Expected Duration | Coverage Target |
|-----------|------------------|-----------------|
| Unit Tests | < 30 seconds | > 90% |
| Integration Tests | < 2 minutes | > 85% |
| E2E Tests | < 5 minutes | > 80% |
| Performance Tests | < 10 minutes | N/A |

### Performance Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Authentication Endpoint | < 500ms | Optimize if exceeded |
| Database Query | < 100ms | Review query if exceeded |
| OTP Generation | < 200ms | Check external service |
| JWT Validation | < 50ms | Review token complexity |

## Troubleshooting

### Common Issues

**Database Connection Errors:**
```bash
# Check database is running
pg_isready -h localhost -p 5432

# Reset test database
dropdb auth_system_test && createdb auth_system_test
npm run db:migrate -- --env=test
```

**External Service Timeouts:**
```bash
# Check network connectivity
curl -I https://api.twilio.com
curl -I https://api.sendgrid.com

# Use mock services for local testing
export USE_MOCK_SERVICES=true
```

**Memory Issues:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Run tests with limited workers
npm run test -- --maxWorkers=2
```

### Test Debugging

**Enable Debug Logging:**
```bash
export DEBUG=auth:*
npm run test
```

**Run Single Test File:**
```bash
npm run test src/tests/e2e/authentication-flows.e2e.test.ts
```

**Skip Slow Tests:**
```bash
npm run test -- --testPathIgnorePatterns=performance
```

## Contributing

### Adding New Tests

1. **Identify Requirements:** Ensure new tests cover specific requirements
2. **Choose Test Type:** Select appropriate test type (unit/integration/e2e)
3. **Follow Patterns:** Use established test patterns and utilities
4. **Update Documentation:** Add test descriptions and coverage info
5. **Verify Coverage:** Ensure coverage thresholds are met

### Test Review Checklist

- [ ] Tests cover all specified requirements
- [ ] Error scenarios are tested
- [ ] Performance implications considered
- [ ] Mocks are properly configured
- [ ] Cleanup is handled correctly
- [ ] Documentation is updated
- [ ] CI/CD integration works

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Library Documentation](https://testing-library.com/docs/)
- [Auth System Requirements](../../.kiro/specs/auth-troubleshooting/requirements.md)
- [Auth System Design](../../.kiro/specs/auth-troubleshooting/design.md)