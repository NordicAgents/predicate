import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10_000,
    // Test files share live Fuseki state (kg:abox, kg:provenance, etc.).
    // Run them serially within this package to avoid cross-file races.
    fileParallelism: false,
  },
});
