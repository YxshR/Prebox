module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
    '!src/demo/**',
    '!src/config/migrations/**',
    '!src/tests/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/config/test-setup.ts'],
  testTimeout: 30000, // Increased for performance tests
  maxWorkers: '50%', // Use half of available CPU cores
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.service.test.ts'],
      testTimeout: 10000
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/**/*.integration.test.ts'],
      testTimeout: 20000
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/src/tests/e2e/**/*.e2e.test.ts'],
      testTimeout: 30000
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/src/tests/performance/**/*.performance.test.ts'],
      testTimeout: 60000,
      maxWorkers: 1 // Run performance tests sequentially
    },
    {
      displayName: 'comprehensive',
      testMatch: ['<rootDir>/src/tests/comprehensive/**/*.test.ts'],
      testTimeout: 20000
    }
  ]
};