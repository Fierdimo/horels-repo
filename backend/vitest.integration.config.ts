import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Integration tests run sequentially to avoid DB conflicts
    pool: 'forks',
    poolOptions: undefined, // Removed in Vitest 4
    
    // Single fork to avoid parallel DB issues
    maxConcurrency: 1,
    fileParallelism: false,

    // Include only integration tests
    include: ['tests/v2/integration/**/*.test.ts'],

    // Setup files
    globalSetup: './tests/setup/integration-setup.ts',
    setupFiles: ['./tests/setup/test-db.ts'],

    // Timeout (DB operations are slower)
    testTimeout: 10000,
    hookTimeout: 10000,

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/repositories/v2/**/*.ts',
      ],
      exclude: [
        'src/repositories/v2/index.ts',
      ],
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
