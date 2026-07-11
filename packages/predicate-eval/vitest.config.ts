import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
    env: {
      // Default to the in-process WASM backend with an isolated :memory:
      // store — NOT the developer's on-disk daemon. The 'oxigraph' default
      // auto-spawns a native daemon over .predicate/store when the binary is
      // available, which makes every test process share one persistent
      // RocksDB store: slow, cross-run polluting, and hang-prone under disk
      // pressure (matches predicate-mcp's config, which learned this first).
      // Opt into the native leg with PREDICATE_BACKEND=oxigraph or Fuseki
      // with PREDICATE_BACKEND=fuseki.
      PREDICATE_BACKEND: process.env.PREDICATE_BACKEND ?? 'oxigraph-wasm',
      PREDICATE_STORE_PATH: process.env.PREDICATE_STORE_PATH ?? ':memory:',
    },
  },
});
