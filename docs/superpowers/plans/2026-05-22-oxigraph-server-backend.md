# OxigraphServerAdapter (disk-backed native default) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `OxigraphServerAdapter` that runs native Oxigraph v0.5.8 as a managed per-store localhost daemon (RocksDB on disk), make it the default backend (`oxigraph`), rename the in-process WASM store to `oxigraph-wasm`, and fall back to WASM automatically when the native binary is unavailable.

**Architecture:** Native `oxigraph serve` is spawned per store directory and accessed over the SPARQL 1.1 HTTP protocol — structurally a sibling of the existing `FusekiAdapter`. Three new units (binary acquisition, daemon supervision, the HTTP adapter) plus a thin delegating wrapper that picks native-or-WASM at `ready()` time. Storage location and `--scope` resolution are reused unchanged from `config.ts`.

**Tech Stack:** TypeScript (ESM, NodeNext), vitest, native `oxigraph` CLI binary (downloaded + SHA-256-pinned), Node `child_process`/`net`/`crypto`/`fs`.

---

## Reference: the contract every adapter implements

From `packages/predicate-mcp/src/storage/adapter.ts` (do not change the method set):

```typescript
export interface StorageAdapter {
  select(query: string): Promise<SelectResult>;
  ask(query: string): Promise<boolean>;
  update(query: string): Promise<void>;
  knownGraphs(): Promise<string[]>;
  loadTurtle(turtle: string, graph: string): Promise<void>;
  serializeGraph(graph: string, format: TurtleFormat): Promise<string>;
  clearGraph(graph: string): Promise<void>;
  ready(): Promise<void>;
  close(): Promise<void>;
}
export type TurtleFormat = 'turtle' | 'nt' | 'nt-star';
```

`SelectResult` / `Term` live in `packages/predicate-mcp/src/sparql/types.ts`. The reference HTTP implementation to mirror is `packages/predicate-mcp/src/storage/fuseki.ts`.

## File structure

New (all under `packages/predicate-mcp/src/storage/`):
- `oxigraph-binary.ts` — `BackendUnavailable`, platform→asset map, SHA-256 table, `detectTarget()`, `ensureBinary()`.
- `oxigraph-daemon.ts` — per-store daemon handshake, `ensureUp()`, `stop()`, `stopAllUnderHome()`.
- `oxigraph-server.ts` — `OxigraphServerAdapter` (HTTP client).
- `oxigraph-default.ts` — `DefaultOxigraphAdapter` (tries native, falls back to WASM; this is what `backend=oxigraph` resolves to). *Refinement vs. spec: fallback lives in its own focused, testable unit rather than inline in the factory.*

New script:
- `packages/predicate-mcp/scripts/pin-oxigraph-checksums.mjs` — downloads the 6 release assets and prints the SHA-256 table to paste into `oxigraph-binary.ts`.

Modified:
- `packages/predicate-mcp/src/storage/adapter.ts` — `BackendName` union.
- `packages/predicate-mcp/src/storage/factory.ts` — new cases.
- `packages/predicate-mcp/src/storage/index.ts` — re-export new symbols.
- `packages/predicate-cli/src/commands/up.ts` — spawn daemon for native backend.
- `packages/predicate-cli/src/commands/down.ts` — stop daemon for native backend (+ `--all`).
- `packages/predicate-cli/src/commands/doctor.ts` — report live backend + daemon status.
- `packages/predicate-skill/.claude-plugin/plugin.json` — default backend env.

New tests (under `packages/predicate-mcp/tests/storage/`):
- `oxigraph-binary.test.ts`, `oxigraph-daemon.test.ts`, `oxigraph-server.test.ts`, `oxigraph-default.test.ts`; plus a branch added to existing `conformance.test.ts`.

Run tests from `packages/predicate-mcp` with `pnpm vitest run <path>` (the package's `test` script is `vitest run`).

---

### Task 1: Rename WASM backend to `oxigraph-wasm`; reserve `oxigraph` for native

**Files:**
- Modify: `packages/predicate-mcp/src/storage/adapter.ts` (last line)
- Modify: `packages/predicate-mcp/src/storage/factory.ts:11-20`
- Test: `packages/predicate-mcp/tests/storage/factory.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/predicate-mcp/tests/storage/factory.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { getAdapter, _resetAdapterCache } from '../../src/storage/factory.js';

describe('factory backend selection', () => {
  afterEach(() => {
    _resetAdapterCache();
    delete process.env.PREDICATE_BACKEND;
    delete process.env.PREDICATE_STORE_PATH;
  });

  it('oxigraph-wasm selects the in-process WASM adapter', () => {
    process.env.PREDICATE_BACKEND = 'oxigraph-wasm';
    process.env.PREDICATE_STORE_PATH = ':memory:';
    const a = getAdapter();
    expect(a.constructor.name).toBe('OxigraphAdapter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/storage/factory.test.ts -t 'oxigraph-wasm'`
Expected: FAIL — `unknown PREDICATE_BACKEND='oxigraph-wasm'`.

- [ ] **Step 3: Implement**

In `adapter.ts`, replace the last line:

```typescript
export type BackendName = 'oxigraph' | 'oxigraph-wasm' | 'fuseki';
```

In `factory.ts`, replace the `switch` body so WASM moves to its new name and `oxigraph` is reserved (native added in Task 7):

```typescript
  switch (cfg.backend) {
    case 'fuseki':
      cached = new FusekiAdapter(cfg);
      return cached;
    case 'oxigraph-wasm':
      cached = new OxigraphAdapter({ storePath: cfg.oxigraphStorePath });
      return cached;
    case 'oxigraph':
      // Native daemon with automatic WASM fallback — wired in Task 7.
      throw new Error('oxigraph (native) backend not yet wired');
    default:
      throw new Error(`unknown PREDICATE_BACKEND='${cfg.backend}'`);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/storage/factory.test.ts -t 'oxigraph-wasm'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/storage/adapter.ts packages/predicate-mcp/src/storage/factory.ts packages/predicate-mcp/tests/storage/factory.test.ts
git commit -m "refactor(storage): rename WASM backend to oxigraph-wasm, reserve oxigraph for native"
```

---

### Task 2: `oxigraph-binary.ts` — platform detection + `BackendUnavailable`

**Files:**
- Create: `packages/predicate-mcp/src/storage/oxigraph-binary.ts`
- Test: `packages/predicate-mcp/tests/storage/oxigraph-binary.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { detectTarget, BackendUnavailable, OXIGRAPH_VERSION } from '../../src/storage/oxigraph-binary.js';

describe('detectTarget', () => {
  it('maps darwin/arm64 to the aarch64 apple asset', () => {
    expect(detectTarget('darwin', 'arm64')).toBe(`oxigraph_v${OXIGRAPH_VERSION}_aarch64_apple`);
  });
  it('maps linux/x64 to the x86_64 linux gnu asset', () => {
    expect(detectTarget('linux', 'x64')).toBe(`oxigraph_v${OXIGRAPH_VERSION}_x86_64_linux_gnu`);
  });
  it('maps win32/x64 to the windows .exe asset', () => {
    expect(detectTarget('win32', 'x64')).toBe(`oxigraph_v${OXIGRAPH_VERSION}_x86_64_windows_msvc.exe`);
  });
  it('throws BackendUnavailable for an unsupported target', () => {
    expect(() => detectTarget('sunos', 'mips')).toThrow(BackendUnavailable);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/storage/oxigraph-binary.test.ts`
Expected: FAIL — cannot find module `oxigraph-binary.js`.

- [ ] **Step 3: Implement**

Create `oxigraph-binary.ts`:

```typescript
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { homeRoot } from '../config.js';

/** Thrown when the native Oxigraph backend cannot be made available; the
 *  caller (DefaultOxigraphAdapter) treats this as the signal to fall back to
 *  the in-process WASM store. */
export class BackendUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendUnavailable';
  }
}

export const OXIGRAPH_VERSION = '0.5.8';

const ASSET_BY_TARGET: Record<string, string> = {
  'darwin-arm64': `oxigraph_v${OXIGRAPH_VERSION}_aarch64_apple`,
  'darwin-x64': `oxigraph_v${OXIGRAPH_VERSION}_x86_64_apple`,
  'linux-arm64': `oxigraph_v${OXIGRAPH_VERSION}_aarch64_linux_gnu`,
  'linux-x64': `oxigraph_v${OXIGRAPH_VERSION}_x86_64_linux_gnu`,
  'win32-arm64': `oxigraph_v${OXIGRAPH_VERSION}_aarch64_windows_msvc.exe`,
  'win32-x64': `oxigraph_v${OXIGRAPH_VERSION}_x86_64_windows_msvc.exe`,
};

// SHA-256 of each release asset, pinned from the v0.5.8 GitHub release.
// Populate via scripts/pin-oxigraph-checksums.mjs (Task 3).
const SHA256_BY_ASSET: Record<string, string> = {
  // filled in Task 3
};

export function detectTarget(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  const key = `${platform}-${arch}`;
  const asset = ASSET_BY_TARGET[key];
  if (!asset) throw new BackendUnavailable(`no prebuilt oxigraph binary for ${key}`);
  return asset;
}

export function binDir(): string {
  return join(homeRoot(), 'bin');
}

export function binPath(asset = detectTarget()): string {
  return join(binDir(), asset.endsWith('.exe') ? 'oxigraph.exe' : 'oxigraph');
}

function downloadUrl(asset: string): string {
  return `https://github.com/oxigraph/oxigraph/releases/download/v${OXIGRAPH_VERSION}/${asset}`;
}

export function sha256(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

/** Ensure the native oxigraph binary exists locally; download + verify on first
 *  use. Returns the executable path. Throws BackendUnavailable on any failure. */
export async function ensureBinary(
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const asset = detectTarget();
  const dest = binPath(asset);
  if (await fileExists(dest)) return dest;

  const expected = SHA256_BY_ASSET[asset];
  if (!expected) throw new BackendUnavailable(`no pinned checksum for ${asset}`);

  let bytes: Uint8Array;
  try {
    const res = await fetchImpl(downloadUrl(asset));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    throw new BackendUnavailable(`download failed for ${asset}: ${(err as Error).message}`);
  }

  const got = sha256(bytes);
  if (got !== expected) {
    throw new BackendUnavailable(`checksum mismatch for ${asset}: expected ${expected}, got ${got}`);
  }

  await fs.mkdir(binDir(), { recursive: true });
  const tmp = `${dest}.tmp`;
  await fs.writeFile(tmp, bytes);
  await fs.chmod(tmp, 0o755);
  await fs.rename(tmp, dest);
  return dest;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/storage/oxigraph-binary.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/storage/oxigraph-binary.ts packages/predicate-mcp/tests/storage/oxigraph-binary.test.ts
git commit -m "feat(storage): oxigraph binary target detection + verified download"
```

---

### Task 3: Pin the real SHA-256 checksums

**Files:**
- Create: `packages/predicate-mcp/scripts/pin-oxigraph-checksums.mjs`
- Modify: `packages/predicate-mcp/src/storage/oxigraph-binary.ts` (`SHA256_BY_ASSET`)

- [ ] **Step 1: Write the script**

Create `packages/predicate-mcp/scripts/pin-oxigraph-checksums.mjs`:

```javascript
import { createHash } from 'node:crypto';

const VERSION = '0.5.8';
const ASSETS = [
  `oxigraph_v${VERSION}_aarch64_apple`,
  `oxigraph_v${VERSION}_x86_64_apple`,
  `oxigraph_v${VERSION}_aarch64_linux_gnu`,
  `oxigraph_v${VERSION}_x86_64_linux_gnu`,
  `oxigraph_v${VERSION}_aarch64_windows_msvc.exe`,
  `oxigraph_v${VERSION}_x86_64_windows_msvc.exe`,
];

for (const asset of ASSETS) {
  const url = `https://github.com/oxigraph/oxigraph/releases/download/v${VERSION}/${asset}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${asset}: HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const sha = createHash('sha256').update(buf).digest('hex');
  console.log(`  '${asset}': '${sha}',`);
}
```

- [ ] **Step 2: Run it to produce the table**

Run: `node packages/predicate-mcp/scripts/pin-oxigraph-checksums.mjs`
Expected: six `'<asset>': '<64-hex>',` lines on stdout.

- [ ] **Step 3: Paste into `SHA256_BY_ASSET`**

Replace the `// filled in Task 3` comment in `oxigraph-binary.ts` with the six printed lines.

- [ ] **Step 4: Sanity check the table is complete**

Run: `node -e "import('./packages/predicate-mcp/dist/src/storage/oxigraph-binary.js').catch(()=>{})"` is not needed; instead grep:
Run: `grep -c "': '" packages/predicate-mcp/src/storage/oxigraph-binary.ts`
Expected: at least `6`.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/scripts/pin-oxigraph-checksums.mjs packages/predicate-mcp/src/storage/oxigraph-binary.ts
git commit -m "chore(storage): pin oxigraph v0.5.8 binary checksums"
```

---

### Task 4: `oxigraph-daemon.ts` — per-store daemon supervision

**Files:**
- Create: `packages/predicate-mcp/src/storage/oxigraph-daemon.ts`
- Test: `packages/predicate-mcp/tests/storage/oxigraph-daemon.test.ts`

- [ ] **Step 1: Write the failing test (integration; skips without a binary)**

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureUp, stop } from '../../src/storage/oxigraph-daemon.js';
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/storage/oxigraph-daemon.test.ts`
Expected: FAIL — cannot find module `oxigraph-daemon.js`.

- [ ] **Step 3: Implement**

Create `oxigraph-daemon.ts`:

```typescript
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

  if (!(await waitForHealth('127.0.0.1', port))) {
    try { if (child.pid) process.kill(child.pid); } catch { /* ignore */ }
    throw new BackendUnavailable(`oxigraph daemon did not become ready on 127.0.0.1:${port}`);
  }

  const handle: DaemonHandle = { host: '127.0.0.1', port, pid: child.pid!, version: OXIGRAPH_VERSION };
  await fs.writeFile(handshakePath(storePath), JSON.stringify(handle), 'utf8');
  return handle;
}

/** Stop the daemon serving `storePath` (if any) and remove its handshake. */
export async function stop(storePath: string): Promise<void> {
  const h = await readHandshake(storePath);
  if (!h) return;
  try { process.kill(h.pid, 'SIGTERM'); } catch { /* already gone */ }
  try { await fs.unlink(handshakePath(storePath)); } catch { /* ignore */ }
}

/** Read a daemon handshake without spawning. */
export function status(storePath: string): Promise<DaemonHandle | null> {
  return readHandshake(storePath);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/storage/oxigraph-daemon.test.ts`
Expected: PASS (2 tests), or SKIPPED if no binary could be obtained (offline).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/storage/oxigraph-daemon.ts packages/predicate-mcp/tests/storage/oxigraph-daemon.test.ts
git commit -m "feat(storage): per-store oxigraph daemon supervision (spawn/reuse/stop)"
```

---

### Task 5: `OxigraphServerAdapter` — the HTTP client

**Files:**
- Create: `packages/predicate-mcp/src/storage/oxigraph-server.ts`
- Test: covered by conformance in Task 6

- [ ] **Step 1: Implement (no separate unit test — proven by Task 6 conformance)**

Create `oxigraph-server.ts`:

```typescript
import type { SelectResult, AskResult, SparqlError } from '../sparql/types.js';
import type { StorageAdapter, TurtleFormat } from './adapter.js';
import { ensureUp, type DaemonHandle } from './oxigraph-daemon.js';

function err(status: number, body: string): SparqlError {
  const e = new Error(`SPARQL error ${status}: ${body}`) as SparqlError;
  e.status = status;
  e.body = body;
  return e;
}

export interface OxigraphServerAdapterOptions {
  storePath: string;
}

export class OxigraphServerAdapter implements StorageAdapter {
  private storePath: string;
  private handle: DaemonHandle | null = null;
  private readyPromise: Promise<void> | null = null;

  constructor(opts: OxigraphServerAdapterOptions) {
    this.storePath = opts.storePath;
  }

  async ready(): Promise<void> {
    if (this.readyPromise === null) {
      this.readyPromise = ensureUp(this.storePath).then((h) => { this.handle = h; });
    }
    await this.readyPromise;
  }

  private base(): string {
    if (!this.handle) throw new Error('OxigraphServerAdapter.ready() was not awaited');
    return `http://${this.handle.host}:${this.handle.port}`;
  }

  async select(query: string): Promise<SelectResult> {
    await this.ready();
    const res = await fetch(`${this.base()}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/sparql-results+json',
      },
      body: query,
    });
    if (!res.ok) throw err(res.status, await res.text());
    return (await res.json()) as SelectResult;
  }

  async ask(query: string): Promise<boolean> {
    await this.ready();
    const res = await fetch(`${this.base()}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/sparql-results+json',
      },
      body: query,
    });
    if (!res.ok) throw err(res.status, await res.text());
    return ((await res.json()) as AskResult).boolean;
  }

  async update(query: string): Promise<void> {
    await this.ready();
    const res = await fetch(`${this.base()}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sparql-update' },
      body: query,
    });
    if (!res.ok) throw err(res.status, await res.text());
  }

  async knownGraphs(): Promise<string[]> {
    const r = await this.select(
      'SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } FILTER(STRSTARTS(STR(?g), "kg:")) }',
    );
    return r.results.bindings.map((b) => b['g']!.value);
  }

  async loadTurtle(turtle: string, graph: string): Promise<void> {
    await this.ready();
    const url = `${this.base()}/store?graph=${encodeURIComponent(graph)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/turtle' },
      body: turtle,
    });
    if (!res.ok) throw err(res.status, await res.text());
  }

  async serializeGraph(graph: string, format: TurtleFormat): Promise<string> {
    await this.ready();
    // Native Oxigraph supports RDF-star MIME types directly — no Fuseki workaround.
    const mime =
      format === 'turtle' ? 'text/turtle'
      : format === 'nt-star' ? 'application/n-triples-star'
      : 'application/n-triples';
    const url = `${this.base()}/store?graph=${encodeURIComponent(graph)}`;
    const res = await fetch(url, { method: 'GET', headers: { 'Accept': mime } });
    if (!res.ok) throw err(res.status, await res.text());
    return await res.text();
  }

  async clearGraph(graph: string): Promise<void> {
    await this.update(`DROP SILENT GRAPH <${graph}>`);
  }

  async close(): Promise<void> {
    // The daemon is shared across sessions; close() releases client state only.
    // Daemon lifecycle is owned by `predicate up` / `predicate down`.
  }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm -C packages/predicate-mcp build`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-mcp/src/storage/oxigraph-server.ts
git commit -m "feat(storage): OxigraphServerAdapter (SPARQL HTTP client for native daemon)"
```

---

### Task 6: Conformance for the native server adapter

**Files:**
- Modify: `packages/predicate-mcp/tests/storage/conformance.test.ts:10-21`

- [ ] **Step 1: Add a `oxigraph-server` branch to the conformance harness**

Replace the `makeAdapter()` function with:

```typescript
async function makeAdapter(): Promise<StorageAdapter> {
  if (BACKEND === 'fuseki') {
    const { FusekiAdapter } = await import('../../src/storage/fuseki.js');
    const { loadConfig } = await import('../../src/config.js');
    return new FusekiAdapter(loadConfig());
  }
  if (BACKEND === 'oxigraph-server') {
    const { OxigraphServerAdapter } = await import('../../src/storage/oxigraph-server.js');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    return new OxigraphServerAdapter({
      storePath: join(tmpdir(), `predicate-conformance-${process.pid}`),
    });
  }
  if (BACKEND === 'oxigraph' || BACKEND === 'oxigraph-wasm') {
    const { OxigraphAdapter } = await import('../../src/storage/oxigraph.js');
    return new OxigraphAdapter({ storePath: ':memory:' });
  }
  throw new Error(`unknown BACKEND=${BACKEND}`);
}
```

- [ ] **Step 2: Run conformance against the native server**

Run: `BACKEND=oxigraph-server pnpm vitest run tests/storage/conformance.test.ts`
Expected: PASS (6 tests) when a binary is obtainable. If offline, the suite errors at `ensureUp`; this leg is gated in CI behind binary availability — document that the default `BACKEND=oxigraph-wasm` leg (no network) is the always-on guarantee.

- [ ] **Step 3: Run the default (WASM) leg to confirm no regression**

Run: `pnpm vitest run tests/storage/conformance.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-mcp/tests/storage/conformance.test.ts
git commit -m "test(storage): run StorageAdapter conformance against oxigraph-server"
```

---

### Task 7: `DefaultOxigraphAdapter` — native with automatic WASM fallback

**Files:**
- Create: `packages/predicate-mcp/src/storage/oxigraph-default.ts`
- Modify: `packages/predicate-mcp/src/storage/factory.ts` (`oxigraph` case)
- Test: `packages/predicate-mcp/tests/storage/oxigraph-default.test.ts`

- [ ] **Step 1: Write the failing test (forces fallback by unsupported target)**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { DefaultOxigraphAdapter } from '../../src/storage/oxigraph-default.js';

describe('DefaultOxigraphAdapter fallback', () => {
  afterEach(() => { delete process.env.PREDICATE_OXIGRAPH_FORCE_UNAVAILABLE; });

  it('falls back to the in-process WASM store when native is unavailable', async () => {
    process.env.PREDICATE_OXIGRAPH_FORCE_UNAVAILABLE = '1';
    const a = new DefaultOxigraphAdapter({ storePath: ':memory:' });
    await a.ready();
    expect(a.activeBackend()).toBe('oxigraph-wasm');
    await a.update(`INSERT DATA { GRAPH <kg:a> { <urn:s> <urn:p> "v" } }`);
    expect(await a.ask(`ASK { GRAPH <kg:a> { <urn:s> <urn:p> "v" } }`)).toBe(true);
    await a.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/storage/oxigraph-default.test.ts`
Expected: FAIL — cannot find module `oxigraph-default.js`.

- [ ] **Step 3: Implement the test escape hatch in `oxigraph-binary.ts`**

At the top of `ensureBinary()` in `oxigraph-binary.ts`, add (right after the function opening brace):

```typescript
  if (process.env.PREDICATE_OXIGRAPH_FORCE_UNAVAILABLE === '1') {
    throw new BackendUnavailable('forced unavailable (PREDICATE_OXIGRAPH_FORCE_UNAVAILABLE=1)');
  }
```

- [ ] **Step 4: Implement `oxigraph-default.ts`**

```typescript
import type { SelectResult } from '../sparql/types.js';
import type { StorageAdapter, TurtleFormat, BackendName } from './adapter.js';
import { OxigraphServerAdapter } from './oxigraph-server.js';
import { OxigraphAdapter } from './oxigraph.js';
import { BackendUnavailable } from './oxigraph-binary.js';

export interface DefaultOxigraphAdapterOptions {
  storePath: string;
}

/** The `backend=oxigraph` default: try the native disk-backed daemon; on
 *  BackendUnavailable, transparently fall back to the in-process WASM store.
 *  Worst case equals the previous default behavior. */
export class DefaultOxigraphAdapter implements StorageAdapter {
  private storePath: string;
  private inner: StorageAdapter | null = null;
  private active: Extract<BackendName, 'oxigraph' | 'oxigraph-wasm'> | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(opts: DefaultOxigraphAdapterOptions) {
    this.storePath = opts.storePath;
  }

  async ready(): Promise<void> {
    if (this.initPromise === null) this.initPromise = this.init();
    await this.initPromise;
  }

  private async init(): Promise<void> {
    const server = new OxigraphServerAdapter({ storePath: this.storePath });
    try {
      await server.ready();
      this.inner = server;
      this.active = 'oxigraph';
    } catch (e) {
      if (!(e instanceof BackendUnavailable)) throw e;
      console.error(
        `predicate: native Oxigraph unavailable (${e.message}); using in-process WASM store.`,
      );
      const wasm = new OxigraphAdapter({ storePath: this.storePath });
      await wasm.ready();
      this.inner = wasm;
      this.active = 'oxigraph-wasm';
    }
  }

  /** Which backend ended up live. Valid after `ready()`. */
  activeBackend(): 'oxigraph' | 'oxigraph-wasm' {
    if (!this.active) throw new Error('activeBackend() called before ready()');
    return this.active;
  }

  private async use(): Promise<StorageAdapter> {
    await this.ready();
    return this.inner!;
  }

  async select(q: string): Promise<SelectResult> { return (await this.use()).select(q); }
  async ask(q: string): Promise<boolean> { return (await this.use()).ask(q); }
  async update(q: string): Promise<void> { return (await this.use()).update(q); }
  async knownGraphs(): Promise<string[]> { return (await this.use()).knownGraphs(); }
  async loadTurtle(t: string, g: string): Promise<void> { return (await this.use()).loadTurtle(t, g); }
  async serializeGraph(g: string, f: TurtleFormat): Promise<string> { return (await this.use()).serializeGraph(g, f); }
  async clearGraph(g: string): Promise<void> { return (await this.use()).clearGraph(g); }
  async close(): Promise<void> { if (this.inner) await this.inner.close(); }
}
```

- [ ] **Step 5: Wire the factory `oxigraph` case**

In `factory.ts`, add the import and replace the throwing `case 'oxigraph'`:

```typescript
import { DefaultOxigraphAdapter } from './oxigraph-default.js';
```
```typescript
    case 'oxigraph':
      cached = new DefaultOxigraphAdapter({ storePath: cfg.oxigraphStorePath });
      return cached;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run tests/storage/oxigraph-default.test.ts tests/storage/factory.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-mcp/src/storage/oxigraph-default.ts packages/predicate-mcp/src/storage/oxigraph-binary.ts packages/predicate-mcp/src/storage/factory.ts packages/predicate-mcp/tests/storage/oxigraph-default.test.ts
git commit -m "feat(storage): default oxigraph backend = native daemon with WASM fallback"
```

---

### Task 8: Export new symbols from the storage barrel

**Files:**
- Modify: `packages/predicate-mcp/src/storage/index.ts`

- [ ] **Step 1: Inspect current exports**

Run: `cat packages/predicate-mcp/src/storage/index.ts`
Expected: see existing `export` lines for adapter/oxigraph/fuseki/factory.

- [ ] **Step 2: Add re-exports**

Append:

```typescript
export { OxigraphServerAdapter } from './oxigraph-server.js';
export { DefaultOxigraphAdapter } from './oxigraph-default.js';
export { BackendUnavailable, ensureBinary, detectTarget } from './oxigraph-binary.js';
export { ensureUp, stop as stopDaemon, status as daemonStatus } from './oxigraph-daemon.js';
```

- [ ] **Step 3: Type-check**

Run: `pnpm -C packages/predicate-mcp build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-mcp/src/storage/index.ts
git commit -m "chore(storage): export native oxigraph backend symbols"
```

---

### Task 9: `predicate up` spawns the daemon for the native backend

**Files:**
- Modify: `packages/predicate-cli/src/commands/up.ts:116-118`

- [ ] **Step 1: Replace the non-fuseki `else` branch**

In `up.ts`, replace the `} else {` block (currently lines 116-118, the Oxigraph log line) with:

```typescript
  } else if (cfg.backend === 'oxigraph') {
    const { ensureUp } = await import('predicate-mcp/src/storage/oxigraph-daemon.js');
    try {
      const h = await ensureUp(cfg.oxigraphStorePath);
      console.log(
        `predicate up: scope=${scope ?? 'auto'} — native oxigraph daemon on 127.0.0.1:${h.port}, store ${cfg.oxigraphStorePath}`,
      );
    } catch (e) {
      console.error(
        `predicate up: native oxigraph unavailable (${(e as Error).message}); the server will fall back to the in-process WASM store.`,
      );
    }
  } else {
    // oxigraph-wasm: in-process, no daemon to start.
    console.log(`predicate up: scope=${scope ?? 'auto'} — in-process WASM store at ${cfg.oxigraphStorePath}`);
  }
```

- [ ] **Step 2: Manual smoke test**

Run: `pnpm -C packages/predicate-cli build && node packages/predicate-cli/dist/src/index.js up --scope local`
Expected: prints `native oxigraph daemon on 127.0.0.1:<port>` (or the WASM fallback line if offline), exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-cli/src/commands/up.ts
git commit -m "feat(cli): predicate up spawns the native oxigraph daemon"
```

---

### Task 10: `predicate down` stops the daemon (+ `--all`)

**Files:**
- Modify: `packages/predicate-cli/src/commands/down.ts`

- [ ] **Step 1: Replace the Oxigraph branch of `down()`**

Replace everything after the `if (cfg.backend === 'fuseki') { ... }` block with:

```typescript
  if (cfg.backend === 'oxigraph') {
    const { stopDaemon } = await import('predicate-mcp/src/storage/index.js');
    if (process.argv.includes('--all')) {
      const { homeRoot } = await import('predicate-mcp/src/config.js');
      const { readdir } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const roots: string[] = [join(homeRoot(), 'store')];
      try {
        const projects = await readdir(join(homeRoot(), 'projects'));
        for (const p of projects) roots.push(join(homeRoot(), 'projects', p, 'store'));
      } catch { /* none */ }
      for (const r of roots) await stopDaemon(r).catch(() => {});
      console.log(`predicate down: stopped home-registered oxigraph daemons (${roots.length} candidate stores).`);
      return 0;
    }
    await stopDaemon(cfg.oxigraphStorePath);
    console.log(`predicate down: stopped oxigraph daemon for ${cfg.oxigraphStorePath} (in-repo stores: run from the repo).`);
    return 0;
  }

  // oxigraph-wasm: flush any in-flight writes; nothing else to stop.
  const adapter = getCachedAdapter();
  if (adapter) {
    try { await adapter.close(); } catch { /* best effort */ }
  }
  console.log('WASM backend is in-process; no daemon to stop. Store flushed to disk.');
  return 0;
```

- [ ] **Step 2: Manual smoke test**

Run: `node packages/predicate-cli/dist/src/index.js down`
Expected: prints `stopped oxigraph daemon for <path>` and exits 0 (after a prior `up`).

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-cli/src/commands/down.ts
git commit -m "feat(cli): predicate down stops the native oxigraph daemon (--all sweeps home stores)"
```

---

### Task 11: `predicate doctor` reports the live backend + daemon status

**Files:**
- Modify: `packages/predicate-cli/src/commands/doctor.ts:65-98`

- [ ] **Step 1: Add a native-daemon check inside the non-fuseki branch**

In `doctor.ts`, immediately after the `oxigraph store writable` check is pushed (after line 76's closing `});`), add:

```typescript
    if (cfg.backend === 'oxigraph') {
      const { daemonStatus } = await import('predicate-mcp/src/storage/index.js');
      const h = await daemonStatus(cfg.oxigraphStorePath).catch(() => null);
      let live = false;
      if (h) {
        live = await fetch(`http://${h.host}:${h.port}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sparql-query', 'Accept': 'application/sparql-results+json' },
          body: 'ASK {}',
          signal: AbortSignal.timeout(1000),
        }).then((r) => r.ok).catch(() => false);
      }
      checks.push({
        name: 'oxigraph daemon',
        ok: live,
        detail: live
          ? `127.0.0.1:${h!.port} (pid ${h!.pid}, v${h!.version})`
          : "no live daemon — run 'predicate up' (native default; falls back to WASM if the binary is unavailable)",
      });
    }
```

- [ ] **Step 2: Manual smoke test**

Run: `node packages/predicate-cli/dist/src/index.js up && node packages/predicate-cli/dist/src/index.js doctor`
Expected: doctor prints a `[x] oxigraph daemon  — 127.0.0.1:<port> (pid …, v0.5.8)` line (or `[ ]` with the hint when the binary is unavailable).

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-cli/src/commands/doctor.ts
git commit -m "feat(cli): doctor reports native oxigraph daemon status"
```

---

### Task 12: Flip the plugin default to the native backend

**Files:**
- Modify: `packages/predicate-skill/.claude-plugin/plugin.json:17-20`

- [ ] **Step 1: Update the MCP server env**

The default `loadConfig()` already resolves `oxigraph` → native. Keep the env explicit and correct: in `plugin.json`, leave `"PREDICATE_BACKEND": "oxigraph"` (now native) and keep `"PREDICATE_DATASET": "predicate"`. No change needed if it already reads `oxigraph`; confirm it does:

Run: `grep -A3 '"env"' packages/predicate-skill/.claude-plugin/plugin.json`
Expected: `"PREDICATE_BACKEND": "oxigraph"`.

- [ ] **Step 2: Update the description string**

Change the top-level `"description"` to note disk-backed default, e.g. replace "Local reasoning knowledge graph (RDF/OWL) for AI agents" with "Local reasoning knowledge graph (RDF/OWL) for AI agents — disk-backed native Oxigraph by default, in-process WASM fallback".

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/predicate-skill/.claude-plugin/plugin.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-skill/.claude-plugin/plugin.json
git commit -m "feat(skill): default backend is disk-backed native Oxigraph (WASM fallback)"
```

---

### Task 13: Full suite + final verification

- [ ] **Step 1: Run the whole MCP test suite**

Run: `pnpm -C packages/predicate-mcp test`
Expected: all green (native-daemon legs skip cleanly if offline).

- [ ] **Step 2: Build all packages**

Run: `pnpm -r build`
Expected: no TypeScript errors.

- [ ] **Step 3: End-to-end smoke**

Run:
```bash
node packages/predicate-cli/dist/src/index.js up --scope local
node packages/predicate-cli/dist/src/index.js doctor
node packages/predicate-cli/dist/src/index.js down
```
Expected: `up` reports the daemon (or WASM fallback), `doctor` is all `[x]`, `down` stops cleanly.

- [ ] **Step 4: Commit any final touch-ups**

```bash
git add -A
git commit -m "test: full suite green for native oxigraph backend" || echo "nothing to commit"
```

---

## Self-review

**Spec coverage:**
- Native daemon adapter → Tasks 4, 5. Binary acquisition (download + pinned SHA-256) → Tasks 2, 3. Per-store daemon supervision → Task 4. Default + auto-fallback + naming → Tasks 1, 7. Reuse of `resolveStorePath`/`--scope` → unchanged; exercised in Tasks 9–11. Concurrency (reuse running daemon) → Task 4 test. Error handling (`BackendUnavailable`) → Tasks 2, 7. Doctor reporting → Task 11. Testing via existing conformance → Task 6. No migration → not implemented (correct; no users). Plugin default → Task 12.
- One spec deviation, intentional and noted: fallback lives in `oxigraph-default.ts` (own unit) rather than inline in the factory — improves testability (Task 7 test); and the daemon uses a pure free-port pick rather than a fixed 7878/7879 offset — conflict-free and simpler. Both are refinements consistent with the spec's intent.

**Placeholder scan:** No "TBD"/"add error handling" placeholders. The one deferred value (SHA-256 table) has an executable task (Task 3) that produces and pastes the real values.

**Type consistency:** `BackendName = 'oxigraph' | 'oxigraph-wasm' | 'fuseki'` used consistently (Tasks 1, 7). `DaemonHandle {host,port,pid,version}` defined in Task 4, consumed identically in Tasks 5, 11. `ensureUp`/`stop`/`status` exported in Task 8 and consumed as `ensureUp`/`stopDaemon`/`daemonStatus` (aliases declared in Task 8, used in Tasks 10, 11). `ensureBinary(fetchImpl?)`, `detectTarget(platform?,arch?)`, `BackendUnavailable`, `sha256` signatures match across Tasks 2, 4, 7.
