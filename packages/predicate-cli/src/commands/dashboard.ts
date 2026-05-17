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
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
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
