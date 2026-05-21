import type { StorageAdapter } from './storage/index.js';

/**
 * Build an idempotent shutdown closure that flushes the adapter to disk and
 * then exits. Guards against double-invocation (a process can receive both
 * SIGTERM and SIGINT). `close()` failures are logged but never block exit.
 *
 * Extracted from index.ts so the flush-once / exit-0 contract is unit-testable
 * without firing real OS signals.
 */
export function makeShutdown(
  adapter: StorageAdapter,
  exit: (code: number) => void = (c) => process.exit(c),
): (signal: string) => Promise<void> {
  let closed = false;
  return async (signal: string): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      await adapter.close();
    } catch (err) {
      console.error(`predicate-mcp: flush on ${signal} failed:`, err);
    }
    exit(0);
  };
}
