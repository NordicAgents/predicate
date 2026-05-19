import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { loadConfig } from 'predicate-mcp/src/config.js';

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i < 0 || i + 1 >= args.length ? undefined : args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function help(): void {
  console.log(`predicate dashboard [--port N] [--no-open]

Serve a localhost dashboard for browsing session-history + reasoning
output extracted by the Stop hook.

Options:
  --port N    Listen on this port (default 4040).
  --no-open   Don't auto-open the browser.
  --help      Print this message.
`);
}

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open'
            : process.platform === 'win32'  ? 'start'
            : 'xdg-open';
  try {
    spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // openBrowser is best-effort; failure is fine
  }
}

async function proxyQuery(req: IncomingMessage, res: ServerResponse, fusekiUrl: string, dataset: string): Promise<void> {
  let body = '';
  await new Promise<void>((resolve, reject) => {
    req.on('data', (c) => { body += String(c); });
    req.on('end', () => resolve());
    req.on('error', reject);
  });
  try {
    const r = await fetch(`${fusekiUrl}/${dataset}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
      body,
    });
    const text = await r.text();
    res.writeHead(r.status, { 'Content-Type': r.headers.get('Content-Type') ?? 'application/sparql-results+json' });
    res.end(text);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`upstream error: ${(e as Error).message}`);
  }
}

const PROPOSAL_IRI = /^[A-Za-z][A-Za-z0-9+.-]*:[A-Za-z0-9:_./#-]+$/;
const ALLOWED_VERBS = new Set(['approve', 'reject']);

interface Digest {
  sessions: number;
  sessionsMaxAt: string;
  staging: number;
  inferred: number;
}
const DIGEST_KEYS: Array<keyof Digest> = ['sessions', 'sessionsMaxAt', 'staging', 'inferred'];

const sseClients = new Set<ServerResponse>();
let pollerTimer: NodeJS.Timeout | undefined;
let lastDigest: Digest | undefined;

async function runAction(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body = '';
  let aborted = false;
  await new Promise<void>((resolve, reject) => {
    req.on('data', (c) => {
      body += String(c);
      if (body.length > 4096) { aborted = true; req.destroy(); }
    });
    req.on('end', () => resolve());
    req.on('error', reject);
  });
  if (aborted) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'request body too large' }));
    return;
  }
  let parsed: { verb?: unknown; proposalId?: unknown };
  try { parsed = JSON.parse(body); } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'invalid JSON' }));
    return;
  }
  const verb = parsed.verb;
  const id = parsed.proposalId;
  if (typeof verb !== 'string' || !ALLOWED_VERBS.has(verb)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'invalid verb' }));
    return;
  }
  if (typeof id !== 'string' || !PROPOSAL_IRI.test(id)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'invalid proposalId' }));
    return;
  }
  const cliBin = process.env.PREDICATE_CLI_BIN ?? 'predicate';
  const cliArgs = (process.env.PREDICATE_CLI_ARGS ?? '').split(' ').filter(Boolean);
  const child = spawn(cliBin, [...cliArgs, 'schema', verb, id], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  let stdout = '';
  let stderr = '';
  const cap = (s: string, chunk: string) => (s + chunk).slice(0, 64 * 1024);
  child.stdout.on('data', (c) => { stdout = cap(stdout, String(c)); });
  child.stderr.on('data', (c) => { stderr = cap(stderr, String(c)); });
  const exitCode: number = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code ?? -1));
    child.on('error', () => resolve(-1));
  });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: exitCode === 0, exitCode, stdout, stderr }));
}

async function fetchDigest(fusekiUrl: string, dataset: string): Promise<Digest> {
  const sparql = `
    PREFIX pred: <https://predicate.dev/meta#>
    SELECT ?sessions ?sessionsMaxAt ?staging ?inferred
    WHERE {
      { SELECT (COUNT(DISTINCT ?s) AS ?sessions) (COALESCE(MAX(?at), "") AS ?sessionsMaxAt)
        WHERE { GRAPH <kg:abox> { OPTIONAL { ?s a pred:Session ; pred:at ?at } } } }
      { SELECT (COUNT(*) AS ?staging)
        WHERE { GRAPH <kg:tbox-staging> { ?p a pred:Proposal } } }
      { SELECT (COUNT(*) AS ?inferred)
        WHERE { GRAPH <kg:inferred> { ?s ?p ?o } } }
    }
  `;
  const r = await fetch(`${fusekiUrl}/${dataset}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
    body: 'query=' + encodeURIComponent(sparql),
  });
  if (!r.ok) throw new Error(`digest query: ${r.status}`);
  const j = await r.json() as { results: { bindings: Array<Record<string, { value: string }>> } };
  const b = j.results.bindings[0]!;
  return {
    sessions: parseInt(b['sessions']!.value, 10),
    sessionsMaxAt: b['sessionsMaxAt']?.value ?? '',
    staging: parseInt(b['staging']!.value, 10),
    inferred: parseInt(b['inferred']!.value, 10),
  };
}

function diffDigests(a: Digest, b: Digest): Array<keyof Digest> {
  return DIGEST_KEYS.filter((k) => a[k] !== b[k]);
}

function sseWrite(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function startPoller(fusekiUrl: string, dataset: string): void {
  if (pollerTimer) return;
  pollerTimer = setInterval(async () => {
    if (sseClients.size === 0) return;
    try {
      const next = await fetchDigest(fusekiUrl, dataset);
      if (!lastDigest) {
        lastDigest = next;
        return;
      }
      const changed = diffDigests(lastDigest, next);
      if (changed.length > 0) {
        lastDigest = next;
        for (const c of sseClients) sseWrite(c, 'change', { changed });
      }
    } catch (e) {
      for (const c of sseClients) sseWrite(c, 'error', { error: (e as Error).message });
    }
  }, 1000);
  pollerTimer.unref?.();
}

function stopPollerIfIdle(): void {
  if (sseClients.size === 0 && pollerTimer) {
    clearInterval(pollerTimer);
    pollerTimer = undefined;
    lastDigest = undefined;
  }
}

async function handleEvents(req: IncomingMessage, res: ServerResponse, fusekiUrl: string, dataset: string): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  try {
    const d = await fetchDigest(fusekiUrl, dataset);
    lastDigest = d;
    sseWrite(res, 'digest', d);
  } catch (e) {
    sseWrite(res, 'error', { error: (e as Error).message });
  }
  sseClients.add(res);
  startPoller(fusekiUrl, dataset);
  const heartbeat = setInterval(() => res.write(`: keep-alive\n\n`), 25_000);
  heartbeat.unref?.();
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    stopPollerIfIdle();
  });
}

function findDashboardHtml(): string {
  // Try multiple candidates so this works both from source (workspace dev) and from the bundled package.
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', '..', '..', 'predicate-skill', 'dashboard', 'index.html'),
    join(here, 'dashboard', 'index.html'),               // bundled cli.bundle.mjs sits next to dashboard/
    join(here, '..', 'dashboard', 'index.html'),
    join(here, '..', '..', 'dashboard', 'index.html'),
  ];
  for (const p of candidates) {
    try { readFileSync(p, 'utf8'); return p; } catch { /* try next */ }
  }
  throw new Error(`dashboard/index.html not found — checked ${candidates.join(', ')}`);
}

export interface DashboardServerHandle {
  port: number;
  url: string;
  close: () => Promise<void>;
}

export async function startDashboardServer(port: number): Promise<DashboardServerHandle> {
  const cfg = loadConfig();
  const htmlPath = findDashboardHtml();
  const html = readFileSync(htmlPath, 'utf8');

  const server = createServer((req, res) => {
    if (req.url === '/api/query' && req.method === 'POST') {
      void proxyQuery(req, res, cfg.fusekiUrl, cfg.dataset);
      return;
    }
    if (req.url === '/api/action' && req.method === 'POST') {
      void runAction(req, res);
      return;
    }
    if (req.url === '/api/events' && req.method === 'GET') {
      void handleEvents(req, res, cfg.fusekiUrl, cfg.dataset);
      return;
    }
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;

  return {
    port: boundPort,
    url: `http://127.0.0.1:${boundPort}`,
    close: () => new Promise<void>((resolve) => {
      for (const c of sseClients) c.end();
      sseClients.clear();
      if (pollerTimer) { clearInterval(pollerTimer); pollerTimer = undefined; lastDigest = undefined; }
      server.close(() => resolve());
    }),
  };
}

export async function dashboard(args: string[]): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  const portStr = parseFlag(args, '--port');
  const port = portStr ? parseInt(portStr, 10) : 4040;
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    console.error('predicate dashboard: --port must be 1–65535');
    return 2;
  }

  const handle = await startDashboardServer(port);
  console.log(`predicate dashboard: serving ${handle.url}`);
  if (!hasFlag(args, '--no-open')) openBrowser(handle.url);
  console.log('press Ctrl-C to stop');

  // Keep the process alive
  await new Promise<void>(() => {});
  return 0;  // unreachable, but typescript-required
}
