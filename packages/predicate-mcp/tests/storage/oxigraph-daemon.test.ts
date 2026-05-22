import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureUp, stop, status } from '../../src/storage/oxigraph-daemon.js';
import { ensureBinary, BackendUnavailable } from '../../src/storage/oxigraph-binary.js';

let hasBinary = true;
try { await ensureBinary(); } catch (e) { hasBinary = !(e instanceof BackendUnavailable); }

const store = join(tmpdir(), `predicate-daemon-test-${process.pid}`);

describe.skipIf(!hasBinary)('oxigraph daemon', () => {
  afterAll(async () => {
    await stop(store);
    await fs.rm(store, { recursive: true, force: true });
  });

  it('spawns a daemon and writes a handshake', async () => {
    const h = await ensureUp(store);
    expect(h.port).toBeGreaterThan(0);
    const onDisk = JSON.parse(await fs.readFile(join(store, 'oxigraph.json'), 'utf8'));
    expect(onDisk.pid).toBe(h.pid);
  });

  it('reuses the running daemon instead of spawning a second', async () => {
    const a = await ensureUp(store);
    const b = await ensureUp(store);
    expect(b.pid).toBe(a.pid);
    expect(b.port).toBe(a.port);
  });

  it('stop() removes the handshake file', async () => {
    await ensureUp(store);
    await stop(store);
    const h = await status(store);
    expect(h).toBeNull();
  });
});
