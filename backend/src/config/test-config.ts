/**
 * Comprehensive Test Configuration
 * Defines test categories, coverage requirements, and testing utilities
 */

export interface TestConfig {
  categories: TestCategory[];
  coverage: CoverageConfig;
  performance: PerformanceConfig;
  integration: IntegrationConfig;
}

export interface TestCategory {
  name: string;
  description: string;
  pattern: string;
  timeout: number;
  required: boolean;
}

export interface CoverageConfig {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  excludePatterns: string[];
}

export interface PerformanceConfig {
  emailSendingCapacity: {
    maxEmailsPerSecond: number;
    maxConcurrentRequests: number;
    testDuration: number;
  };
  apiResponseTime: {
    maxResponseTime: number;
    percentile95: number;
  };
}

export interface IntegrationConfig {
  database: {
    testDatabase: string;
    resetBetweenTests: boolean;
  };
  externalServices: {
    mockByDefault: boolean;
    realServicesInCI: boolean;
  };
}

export const testConfig: TestConfig = {
  categories: [
    {
      name: 'unit',
      description: 'Unit tests for individual service methods',
      pattern: '**/*.service.test.ts',
      timeout: 5000,
      required: true
    },
    {
      name: 'integration',
      description: 'Integration tests for API endpoints',
      pattern: '**/*.integration.test.ts',
      timeout: 10000,
      required: true
    },
    {
      name: 'e2e',
      description: 'End-to-end tests for user workflows',
      pattern: '**/*.e2e.test.ts',
      timeout: 30000,
      required: true
    },
    {
      name: 'performance',
      description: 'Performance tests for email sending capacity',
      pattern: '**/*.performance.test.ts',
      timeout: 60000,
      required: false
    }
  ],
  coverage: {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
    excludePatterns: [
      'src/**/*.d.ts',
      'src/**/__tests__/**',
      'src/**/index.ts',
      'src/demo/**',
      'src/config/migrations/**'
    ]
  },
  performance: {
    emailSendingCapacity: {
      maxEmailsPerSecond: 100,
      maxConcurrentRequests: 50,
      testDuration: 30000 // 30 seconds
    },
    apiResponseTime: {
      maxResponseTime: 1000, // 1 second
      percentile95: 500 // 500ms
    }
  },
  integration: {
    database: {
      testDatabase: 'bulk_email_test',
      resetBetweenTests: true
    },
    externalServices: {
      mockByDefault: true,
      realServicesInCI: false
    }
  }
};

// Test utilities and helpers
export class TestUtils {
  static generateMockUser(overrides: Partial<any> = {}) {
    return {
      id: 'test-user-id',
      tenantId: 'test-tenant-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      subscriptionTier: 'FREE',
      ...overrides
    };
  }

  static generateMockTenant(overrides: Partial<any> = {}) {
    return {
      id: 'test-tenant-id',
      name: 'Test Tenant',
      subscriptionTier: 'FREE',
      quotas: {
        dailyEmails: 100,
        monthlyEmails: 2000,
        monthlyRecipients: 300
      },
      ...overrides
    };
  }

  static generateMockEmail(overrides: Partial<any> = {}) {
    return {
      id: 'test-email-id',
      tenantId: 'test-tenant-id',
      to: 'recipient@example.com',
      subject: 'Test Email',
      htmlContent: '<p>Test content</p>',
      textContent: 'Test content',
      ...overrides
    };
  }

  static generateMockCampaign(overrides: Partial<any> = {}) {
    return {
      id: 'test-campaign-id',
      tenantId: 'test-tenant-id',
      name: 'Test Campaign',
      templateId: 'test-template-id',
      status: 'DRAFT',
      ...overrides
    };
  }

  static async waitFor(condition: () => boolean, timeout: number = 5000): Promise<void> {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  }

  static mockDatabase() {
    return {
      query: jest.fn(),
      connect: jest.fn(),
      release: jest.fn(),
      end: jest.fn()
    };
  }

  static mockRedis() {
    return {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      quit: jest.fn()
    };
  }
}