import { defineConfig } from 'vitest/config';
import * as dotenv from 'dotenv';

// Load .env (if present) so developer-provided values take precedence
dotenv.config();

// Set test environment variables globally before any test files load.
// Prefer values from the environment (or .env) and fall back to safe test defaults.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-key-for-testing-only';
process.env.PMS_API_URL = process.env.PMS_API_URL ?? 'https://api.test-pms.com';
process.env.PMS_API_KEY = process.env.PMS_API_KEY ?? 'test-pms-api-key';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? 'sk_test_test-stripe-secret-key';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_webhook_secret';
process.env.DB_HOST = process.env.DB_HOST ?? '127.0.0.1';
process.env.DB_USER = process.env.DB_USER ?? 'sw2_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'sw2_password';
process.env.DB_NAME = process.env.DB_NAME ?? 'sw2_test';
process.env.DB_PORT = process.env.DB_PORT ?? '3306';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Run a global setup once to ensure the test DB and migrations are applied
    globalSetup: ['./tests/globalSetup.ts'],
    // Run tests sequentially to avoid database concurrency issues
    // Disable worker threads so Vitest runs tests sequentially in-process
    // Increase timeout for database operations
    testTimeout: 30000,
    // Run files sequentially
    maxConcurrency: 1,
  },
});