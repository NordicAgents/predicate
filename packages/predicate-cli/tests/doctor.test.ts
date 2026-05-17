import { describe, it, expect, vi } from 'vitest';
import { doctor } from '../src/commands/doctor.js';

describe('doctor', () => {
  it('returns 0 when fuseki is up and tbox is loaded', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await doctor();
    log.mockRestore();
    expect(code).toBe(0);
  });

  it('returns 1 when fuseki is unreachable', async () => {
    const original = process.env.FUSEKI_URL;
    process.env.FUSEKI_URL = 'http://localhost:65535';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await doctor();
    log.mockRestore();
    process.env.FUSEKI_URL = original;
    expect(code).toBe(1);
  });
});
