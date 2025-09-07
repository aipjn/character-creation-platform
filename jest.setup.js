// Jest setup file for global test configuration
// This file is executed before each test file

// Extend Jest matchers if needed
// import 'jest-extended';

// Set up global test timeout
jest.setTimeout(10000);

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Suppress console logs in tests unless needed
if (process.env.VERBOSE_TESTS !== 'true') {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}