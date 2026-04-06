/**
 * Vitest configuration specifically for V2 unit tests (models only).
 * 
 * These tests use in-memory SQLite and don't require database connections,
 * so we skip the global setup that creates the test database.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Skip global setup (no Docker/database needed for unit tests)
    globals: false,
    
    // Run tests sequentially for consistency
    sequence: {
      concurrent: false,
    },
    
    // Pattern to match test files
    include: ['tests/v2/unit/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    
    // Environment
    environment: 'node',
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/models/v2/**/*.ts'],
      exclude: ['src/models/v2/index.ts'],
    },
    
    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
