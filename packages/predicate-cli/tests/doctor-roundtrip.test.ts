import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { roundTripSelfTest } from '../src/commands/doctor.js';

describe('doctor round-trip self-test', () => {
  it('asserts, persists, and re-reads a triple across adapter instances', async () => {
    const store = mkdtempSync(join(tmpdir(), 'pred-rt-'));
    try {
      const ok = await roundTripSelfTest(store);
      expect(ok.persisted).toBe(true);
      expect(existsSync(store)).toBe(true);
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });
});
