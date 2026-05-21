import { describe, it, expect, vi } from 'vitest';
import { makeShutdown } from '../src/shutdown.js';
import type { StorageAdapter } from '../src/storage/index.js';
import { OxigraphAdapter } from '../src/storage/index.js';

describe('makeShutdown', () => {
  it('closes the adapter exactly once even if invoked twice', async () => {
    let closes = 0;
    const adapter = { close: vi.fn(async () => { closes++; }) } as unknown as StorageAdapter;
    const exits: number[] = [];
    const shutdown = makeShutdown(adapter, (code) => { exits.push(code); });

    await shutdown('SIGTERM');
    await shutdown('SIGINT');

    expect(closes).toBe(1);
    expect(exits).toEqual([0]);
  });

  it('still exits 0 if close throws', async () => {
    const adapter = { close: vi.fn(async () => { throw new Error('disk full'); }) } as unknown as StorageAdapter;
    const exits: number[] = [];
    const shutdown = makeShutdown(adapter, (code) => { exits.push(code); });

    await shutdown('SIGTERM');

    expect(exits).toEqual([0]);
  });

  it('flushes a real in-memory adapter without throwing', async () => {
    const exits: number[] = [];
    const shutdown = makeShutdown(new OxigraphAdapter({ storePath: ':memory:' }), (c) => { exits.push(c); });
    await shutdown('SIGTERM');
    expect(exits).toEqual([0]);
  });
});
