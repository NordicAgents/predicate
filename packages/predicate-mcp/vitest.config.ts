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
      // Default to the zero-dependency in-process WASM backend so `pnpm test`
      // is green with no Docker and uses an isolated :memory: store — not the
      // developer's on-disk daemon.  Opt into the native leg with
      // PREDICATE_BACKEND=oxigraph or the Fuseki leg with
      // PREDICATE_BACKEND=fuseki (requires those services running).
      PREDICATE_BACKEND: process.env.PREDICATE_BACKEND ?? 'oxigraph-wasm',
      PREDICATE_STORE_PATH: process.env.PREDICATE_STORE_PATH ?? ':memory:',
    },
  },
});
