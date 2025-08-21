# Comprehensive Testing Suite

This document describes the comprehensive testing strategy implemented for the bulk email platform backend.

## Test Categories

### 1. Unit Tests (`*.service.test.ts`)
Tests individual service methods in isolation with mocked dependencies.

**Coverage:**
- All service methods
- Business logic validation
- Error handling scenarios
- Edge cases and boundary conditions

**Run Command:**
```bash
npm run test:unit
```

**Examples:**
- `src/analytics/analytics.service.test.ts`
- `src/admin/admin.service.test.ts`
- `src/auth/auth.service.test.ts`

### 2. Integration Tests (`*.integration.test.ts`)
Tests API endpoints with real HTTP requests and database interactions.

**Coverage:**
- All REST API endpoints
- Authentication and authorization
- Request/response validation
- Database operations
- External service integrations

**Run Command:**
```bash
npm run test:integration
```

**Examples:**
- `src/tests/integration/api-endpoints.integration.test.ts`
- `src/auth/api-authentication.integration.test.ts`
- `src/domains/domain.integration.test.ts`

### 3. End-to-End Tests (`*.e2e.test.ts`)
Tests complete user workflows from start to finish.

**Coverage:**
- User registration and onboarding
- Email campaign creation and sending
- Subscription management
- Custom domain setup
- Scheduled email workflows
- Analytics and reporting

**Run Command:**
```bash
npm run test:e2e
```

**Examples:**
- `src/tests/e2e/user-workflows.e2e.test.ts`

### 4. Performance Tests (`*.performance.test.ts`)
Tests system performance under load and stress conditions.

**Coverage:**
- Email sending capacity
- Concurrent request handling
- Database performance
- Queue processing efficiency
- Memory usage optimization

**Run Command:**
```bash
npm run test:performance
```

**Examples:**
- `src/tests/performance/email-capacity.performance.test.ts`

### 5. Comprehensive Tests (`comprehensive/*.test.ts`)
Tests specific feature combinations and complex scenarios.

**Coverage:**
- Scheduled email functionality
- Branding system integration
- Multi-tenant isolation
- Feature interaction testing

**Run Command:**
```bash
npm run test:comprehensive
```

**Examples:**
- `src/tests/comprehensive/scheduled-email-branding.test.ts`

## Test Configuration

### Jest Configuration
The project uses Jest with TypeScript support and multiple test projects:

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  projects: [
    { displayName: 'unit', testMatch: ['**/*.service.test.ts'] },
    { displayName: 'integration', testMatch: ['**/*.integration.test.ts'] },
    { displayName: 'e2e', testMatch: ['**/e2e/**/*.e2e.test.ts'] },
    { displayName: 'performance', testMatch: ['**/performance/**/*.performance.test.ts'] },
    { displayName: 'comprehensive', testMatch: ['**/comprehensive/**/*.test.ts'] }
  ]
};
```

### Coverage Requirements
- **Statements:** 90%
- **Branches:** 85%
- **Functions:** 90%
- **Lines:** 90%

### Test Utilities
Common test utilities are provided in `src/config/test-config.ts`:

```typescript
import { TestUtils } from '../config/test-config';

// Generate mock data
const mockUser = TestUtils.generateMockUser();
const mockTenant = TestUtils.generateMockTenant();
const mockEmail = TestUtils.generateMockEmail();

// Mock services
const mockDatabase = TestUtils.mockDatabase();
const mockRedis = TestUtils.mockRedis();
```

## Running Tests

### Individual Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Performance tests only
npm run test:performance

# Comprehensive tests only
npm run test:comprehensive
```

### All Tests
```bash
# Run all test categories sequentially
npm run test:all

# Run comprehensive test suite with detailed reporting
npm run test:comprehensive-suite
```

### Coverage Reports
```bash
# Generate coverage report
npm run test:coverage

# CI/CD pipeline tests
npm run test:ci
```

### Watch Mode
```bash
# Watch for changes and re-run tests
npm run test:watch
```

## Test Structure

### Service Unit Tests
```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  
  beforeEach(() => {
    service = new ServiceName();
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange
      const input = { /* test data */ };
      mockDatabase.query.mockResolvedValue({ rows: [/* expected data */] });

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toEqual(/* expected result */);
      expect(mockDatabase.query).toHaveBeenCalledWith(/* expected query */);
    });

    it('should handle error case', async () => {
      // Arrange
      mockDatabase.query.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.methodName(input)).rejects.toThrow('Expected error message');
    });
  });
});
```

### Integration Tests
```typescript
describe('API Endpoint Integration', () => {
  let app: express.Application;
  let authToken: string;

  beforeAll(async () => {
    app = createTestApp();
    authToken = await getTestAuthToken();
  });

  it('should handle API request successfully', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ /* request data */ })
      .expect(200);

    expect(response.body).toHaveProperty('expectedField');
  });
});
```

### E2E Tests
```typescript
describe('User Workflow E2E', () => {
  it('should complete full user journey', async () => {
    // Step 1: User registration
    const registrationResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    // Step 2: Email verification
    await request(app)
      .post('/api/auth/verify-email')
      .send({ token: verificationToken })
      .expect(200);

    // Step 3: Create campaign
    const campaignResponse = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send(campaignData)
      .expect(201);

    // Step 4: Send emails
    await request(app)
      .post(`/api/campaigns/${campaignId}/send`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
```

## Performance Testing

### Email Sending Capacity
Tests the system's ability to handle high-volume email sending:

```typescript
it('should send emails within performance thresholds', async () => {
  const testEmails = Array.from({ length: 1000 }, generateTestEmail);
  
  const startTime = performance.now();
  await Promise.all(testEmails.map(email => emailService.sendEmail(email)));
  const endTime = performance.now();
  
  const emailsPerSecond = (testEmails.length / (endTime - startTime)) * 1000;
  expect(emailsPerSecond).toBeGreaterThan(100); // Minimum 100 emails/second
});
```

### Load Testing
Tests system behavior under sustained load:

```typescript
it('should handle sustained high load', async () => {
  const testDuration = 30000; // 30 seconds
  const targetRate = 100; // emails per second
  
  // Run sustained load test
  const results = await runLoadTest(testDuration, targetRate);
  
  expect(results.averageRate).toBeGreaterThan(targetRate * 0.8);
  expect(results.errorRate).toBeLessThan(5); // Less than 5% errors
});
```

## Mocking Strategy

### Database Mocking
```typescript
const mockDatabase = {
  query: jest.fn(),
  connect: jest.fn(),
  release: jest.fn(),
  end: jest.fn()
};

// Mock successful query
mockDatabase.query.mockResolvedValue({ rows: [{ id: 1, name: 'test' }] });

// Mock database error
mockDatabase.query.mockRejectedValue(new Error('Connection failed'));
```

### External Service Mocking
```typescript
const mockEmailProvider = {
  sendEmail: jest.fn(),
  verifyDomain: jest.fn(),
  setupWebhooks: jest.fn()
};

// Mock successful email sending
mockEmailProvider.sendEmail.mockResolvedValue({
  messageId: 'msg-123',
  status: 'queued'
});
```

## Continuous Integration

### GitHub Actions
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:ci
      - uses: codecov/codecov-action@v1
```

### Test Reports
The comprehensive test suite generates detailed reports:

- **JSON Report:** `test-results.json` with detailed metrics
- **Coverage Report:** HTML coverage report in `coverage/` directory
- **Performance Metrics:** Detailed performance analysis

## Best Practices

### Test Organization
1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain the scenario
3. **Follow AAA pattern** (Arrange, Act, Assert)
4. **Mock external dependencies** to ensure test isolation
5. **Clean up after tests** using `beforeEach` and `afterEach`

### Test Data Management
1. **Use factory functions** for generating test data
2. **Avoid hardcoded values** that might change
3. **Create realistic test scenarios** that match production usage
4. **Test edge cases** and boundary conditions

### Performance Considerations
1. **Run performance tests in isolation** to avoid interference
2. **Use appropriate timeouts** for different test types
3. **Monitor memory usage** during long-running tests
4. **Clean up resources** to prevent memory leaks

### Error Testing
1. **Test all error paths** and exception scenarios
2. **Verify error messages** are user-friendly
3. **Test error recovery** mechanisms
4. **Validate error logging** and monitoring

## Troubleshooting

### Common Issues

#### Test Timeouts
```bash
# Increase timeout for specific tests
jest.setTimeout(30000);

# Or in jest.config.js
testTimeout: 30000
```

#### Memory Issues
```bash
# Run tests with more memory
node --max-old-space-size=4096 node_modules/.bin/jest

# Or run tests sequentially
jest --runInBand
```

#### Database Connection Issues
```typescript
// Ensure proper cleanup
afterAll(async () => {
  await database.end();
});
```

### Debugging Tests
```bash
# Run specific test file
npm test -- --testPathPattern=analytics.service.test.ts

# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Verbose output
npm test -- --verbose
```

## Metrics and Reporting

### Coverage Metrics
- **Statement Coverage:** Percentage of statements executed
- **Branch Coverage:** Percentage of branches taken
- **Function Coverage:** Percentage of functions called
- **Line Coverage:** Percentage of lines executed

### Performance Metrics
- **Throughput:** Requests/emails processed per second
- **Response Time:** Average and 95th percentile response times
- **Error Rate:** Percentage of failed operations
- **Resource Usage:** Memory and CPU utilization

### Quality Metrics
- **Test Count:** Total number of tests per category
- **Test Success Rate:** Percentage of passing tests
- **Test Duration:** Time taken to run test suites
- **Code Quality:** ESLint and TypeScript compliance

## Future Enhancements

1. **Visual Regression Testing:** Screenshot comparison for UI components
2. **Contract Testing:** API contract validation with Pact
3. **Chaos Engineering:** Fault injection testing
4. **Security Testing:** Automated security vulnerability scanning
5. **Accessibility Testing:** Automated accessibility compliance checks