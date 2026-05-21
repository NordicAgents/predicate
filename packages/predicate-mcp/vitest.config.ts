import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10_000,
    // Test files share live backend state (kg:abox, kg:provenance, etc.).
    // Run them serially within this package to avoid cross-file races.
    fileParallelism: false,
    env: {
      // Default to the zero-dependency Oxigraph backend so `pnpm test` is
      // green with no Docker, matching the README. Opt into the Fuseki leg
      // with PREDICATE_BACKEND=fuseki (requires a running Fuseki).
      PREDICATE_BACKEND: process.env.PREDICATE_BACKEND ?? 'oxigraph',
    },
  },
});
