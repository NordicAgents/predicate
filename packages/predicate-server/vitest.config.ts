import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // No PREDICATE_BACKEND override — test imports OxigraphAdapter directly.
  },
});
