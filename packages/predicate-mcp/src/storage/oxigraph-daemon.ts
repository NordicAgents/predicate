import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { ensureBinary, BackendUnavailable, OXIGRAPH_VERSION } from './oxigraph-binary.js';

export interface DaemonHandle {
  host: string;
  port: number;
  pid: number;
  version: string;
}

function handshakePath(storePath: string): string {
  return join(storePath, 'oxigraph.json');
}

async function readHandshake(storePath: string): Promise<DaemonHandle | null> {
  try {
    return JSON.parse(await fs.readFile(handshakePath(storePath), 'utf8')) as DaemonHandle;
  } catch {
    return null;
  }
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function healthOk(host: string, port: number): Promise<boolean> {
  try {
    const r = await fetch(`http://${host}:${port}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/sparql-results+json',
      },
      body: 'ASK {}',
      signal: AbortSignal.timeout(1000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

function pickPort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => res(port));
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForHealth(host: string, port: number, tries = 50): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (await healthOk(host, port)) return true;
    await sleep(200);
  }
  return false;
}

/** Ensure a daemon is serving `storePath`. Reuse a live one if the handshake is
 *  valid; otherwise spawn a fresh one on a free localhost port. */
export async function ensureUp(storePath: string): Promise<DaemonHandle> {
  // NOTE: two concurrent callers can both pass the no-valid-handshake guard and
  // each spawn. The loser fails RocksDB's exclusive write lock and exits;
  // waitForHealth then returns false → BackendUnavailable → WASM fallback. No
  // external lock here: the spec accepts this for per-store singletons.
  const existing = await readHandshake(storePath);
  if (existing && pidAlive(existing.pid) && (await healthOk(existing.host, existing.port))) {
    return existing;
  }

  const bin = await ensureBinary();
  await fs.mkdir(storePath, { recursive: true });
  const port = await pickPort();

  const child = spawn(bin, ['serve', '--location', storePath, '--bind', `127.0.0.1:${port}`], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  if (child.pid === undefined) {
    throw new BackendUnavailable(`oxigraph daemon spawn failed (no PID assigned) for ${bin}`);
  }

  if (!(await waitForHealth('127.0.0.1', port))) {
    try { if (child.pid) process.kill(child.pid); } catch { /* ignore */ }
    throw new BackendUnavailable(`oxigraph daemon did not become ready on 127.0.0.1:${port} after 10s`);
  }

  const handle: DaemonHandle = { host: '127.0.0.1', port, pid: child.pid!, version: OXIGRAPH_VERSION };
  await fs.writeFile(handshakePath(storePath), JSON.stringify(handle), 'utf8');
  return handle;
}

/** Stop the daemon serving `storePath` (if any) and remove its handshake. */
export async function stop(storePath: string): Promise<void> {
  const h = await readHandshake(storePath);
  if (!h) return;
  // Only kill if the recorded PID is still our live daemon; otherwise the PID may
  // have been recycled to an unrelated process. Either way, clear the handshake.
  if (pidAlive(h.pid) && (await healthOk(h.host, h.port))) {
    try { process.kill(h.pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  try { await fs.unlink(handshakePath(storePath)); } catch { /* ignore */ }
}

/** Read a daemon handshake without spawning. */
export function status(storePath: string): Promise<DaemonHandle | null> {
  return readHandshake(storePath);
}
