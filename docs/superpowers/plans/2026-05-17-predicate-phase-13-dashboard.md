# Predicate Phase 13 — Web Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Ship a minimal web dashboard for browsing extracted session data. A single static HTML file that talks to the local Fuseki SPARQL endpoint, plus a `predicate dashboard` CLI command that serves it on a localhost port and opens a browser. Tag v1.10.0-dashboard.

**Architecture:** Stay simple. The dashboard is one self-contained `dashboard.html` file with inline CSS + JS. It does fetch() calls against `http://localhost:3030/predicate/query` (CORS already enabled by Fuseki for localhost). No build step, no framework. The CLI command spins up a Node `http` server that serves the HTML and proxies SPARQL through a same-origin endpoint (avoids CORS in unusual setups). Default port 4040; configurable via `--port`. Opens browser automatically via `open` shell command (macOS) / `xdg-open` (Linux) / `start` (Windows) with a `--no-open` flag to suppress.

**Pages (sections in the single HTML):**
1. **Sessions list** — table of recent sessions with their counts.
2. **Hotspots** — files derived as `cb:Hotspot` from `kg:inferred`.
3. **Flaky commands** — commands derived as `cb:FlakyCommand`.
4. **Active files** — files derived as `cb:ActiveFile`.
5. **Stats snapshot** — current `predicate stats` numbers.

No write operations. Read-only.

**Tech Stack:** Node.js http module, vanilla HTML/CSS/JS. No frontend framework. No transpiler. Tests cover the CLI server lifecycle + HTML smoke.

---

## File Structure

**New files:**
- `packages/predicate-skill/dashboard/index.html` — the dashboard itself, ~250 lines incl. inline CSS/JS.
- `packages/predicate-cli/src/commands/dashboard.ts` — server lifecycle: pick port, serve HTML, optional browser open.
- `packages/predicate-cli/tests/dashboard.test.ts` — server start/stop, GET / serves HTML, GET /api/query proxies to Fuseki.

**Modified files:**
- `packages/predicate-cli/src/index.ts` — register `dashboard` command.
- `packages/predicate-skill/package.json` `files:` array — add `dashboard` directory to the publish list. Version bump 1.9.0 → 1.10.0.
- `packages/predicate-skill/.claude-plugin/plugin.json` — bump 1.9.0 → 1.10.0.
- `.claude-plugin/marketplace.json` — bump 1.9.0 → 1.10.0.
- README Status + new section "Dashboard" with the `predicate dashboard` command + screenshot placeholder.
- SKILL.md no change (this is an out-of-band visualization, not an agent workflow).

---

### Task 1: dashboard.html

Create `packages/predicate-skill/dashboard/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Predicate Dashboard</title>
  <style>
    :root { --bg:#0e0e10; --fg:#e8e8e8; --muted:#888; --accent:#2dd4bf; --warn:#f59e0b; --bad:#ef4444; --row:#1a1a1d; }
    * { box-sizing: border-box; }
    body { background:var(--bg); color:var(--fg); font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif; margin:0; padding:24px; }
    h1 { margin:0 0 4px; font-size:22px; }
    .sub { color:var(--muted); margin-bottom:24px; }
    .grid { display:grid; gap:24px; grid-template-columns:repeat(auto-fit,minmax(420px,1fr)); }
    .card { background:var(--row); border-radius:8px; padding:16px; }
    .card h2 { margin:0 0 8px; font-size:14px; color:var(--accent); text-transform:uppercase; letter-spacing:.05em; }
    .card .empty { color:var(--muted); font-style:italic; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th { text-align:left; color:var(--muted); padding:4px 8px 4px 0; font-weight:500; }
    td { padding:4px 8px 4px 0; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; vertical-align:top; word-break:break-all; }
    td.num { text-align:right; font-variant-numeric:tabular-nums; }
    .warn { color:var(--warn); }
    .bad  { color:var(--bad); }
    .stats { display:grid; gap:8px; grid-template-columns:1fr 1fr; }
    .stat { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #2a2a2e; }
    .stat:last-child { border-bottom:none; }
    .stat .k { color:var(--muted); }
    .stat .v { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
    .err { background:#3a1212; color:#f5c2c7; padding:12px; border-radius:6px; margin-bottom:16px; }
  </style>
</head>
<body>
<h1>Predicate Dashboard</h1>
<div class="sub">Session-history + reasoning over Fuseki @ <span id="ep"></span></div>
<div id="err" class="err" style="display:none"></div>
<div class="grid">
  <div class="card"><h2>Stats</h2><div class="stats" id="stats"></div></div>
  <div class="card"><h2>Recent Sessions</h2><div id="sessions"></div></div>
  <div class="card"><h2>Hotspots <span class="sub">(files modified in ≥3 sessions)</span></h2><div id="hotspots"></div></div>
  <div class="card"><h2>Flaky Commands <span class="sub">(failed in ≥2 sessions)</span></h2><div id="flaky"></div></div>
  <div class="card"><h2>Active Files <span class="sub">(modified in latest session)</span></h2><div id="active"></div></div>
</div>
<script>
const EP = '/api/query';
document.getElementById('ep').textContent = location.host;

async function ask(sparql) {
  const r = await fetch(EP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
    body: 'query=' + encodeURIComponent(sparql),
  });
  if (!r.ok) throw new Error('SPARQL ' + r.status + ': ' + (await r.text()));
  return (await r.json()).results.bindings;
}

function tbl(headers, rows, opts = {}) {
  if (!rows.length) return '<div class="empty">' + (opts.empty || 'no data') + '</div>';
  return '<table><thead><tr>'
       + headers.map(h => '<th>' + h + '</th>').join('')
       + '</tr></thead><tbody>'
       + rows.map(r => '<tr>' + r.map((c, i) => '<td' + (opts.numCols && opts.numCols.includes(i) ? ' class="num"' : '') + '>' + c + '</td>').join('') + '</tr>').join('')
       + '</tbody></table>';
}

function trim(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
function shortFile(f) { return f.replace(/^file:\/\//, '').split('/').slice(-3).join('/'); }

async function loadStats() {
  const q = `
    PREFIX pred: <https://predicate.dev/meta#>
    PREFIX cb:   <https://predicate.dev/codebase#>
    SELECT
      (COUNT(DISTINCT ?session) AS ?sessions)
      (COUNT(DISTINCT ?file) AS ?files)
      (COUNT(DISTINCT ?cmd) AS ?cmds)
    WHERE {
      GRAPH <kg:abox> {
        OPTIONAL { ?session a pred:Session }
        OPTIONAL { ?file cb:modifiedIn ?_s1 }
        OPTIONAL { ?cmd a cb:Command }
      }
    }
  `;
  const b = (await ask(q))[0];
  const ti = await ask('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }');
  const ii = await ask('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:inferred> { ?s ?p ?o } }');
  const stats = [
    ['sessions', b.sessions.value],
    ['files modified', b.files.value],
    ['commands', b.cmds.value],
    ['abox triples', ti[0].n.value],
    ['inferred triples', ii[0].n.value],
  ];
  document.getElementById('stats').innerHTML = stats.map(([k, v]) => `<div class="stat"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
}

async function loadSessions() {
  const q = `
    PREFIX pred: <https://predicate.dev/meta#>
    PREFIX cb:   <https://predicate.dev/codebase#>
    SELECT ?sid ?at
      (COUNT(DISTINCT ?file) AS ?nFiles)
      (COUNT(DISTINCT ?ok)   AS ?nOk)
      (COUNT(DISTINCT ?bad)  AS ?nBad)
    WHERE {
      GRAPH <kg:abox> {
        ?s a pred:Session ; pred:sessionId ?sid ; pred:at ?at .
        OPTIONAL { ?file cb:modifiedIn ?s }
        OPTIONAL { ?ok   cb:succeededIn ?s }
        OPTIONAL { ?bad  cb:failedIn    ?s }
      }
    }
    GROUP BY ?sid ?at
    ORDER BY DESC(?at)
    LIMIT 20
  `;
  const rows = (await ask(q)).map(b => [
    trim(b.sid.value, 32),
    b.at.value.slice(0, 19).replace('T', ' '),
    b.nFiles.value,
    b.nOk.value,
    `<span class="${parseInt(b.nBad.value) > 0 ? 'bad' : ''}">${b.nBad.value}</span>`,
  ]);
  document.getElementById('sessions').innerHTML = tbl(['session', 'at', 'files', 'ok', 'fail'], rows, { numCols: [2, 3, 4], empty: 'no sessions extracted yet' });
}

async function loadDerived(varName, klass, predicate, divId, label, empty) {
  const q = `
    PREFIX cb: <https://predicate.dev/codebase#>
    SELECT ?${varName} (COUNT(DISTINCT ?session) AS ?n)
    WHERE {
      { GRAPH <kg:inferred> { ?${varName} a cb:${klass} } }
      OPTIONAL { GRAPH <kg:abox> { ?${varName} cb:${predicate} ?session } }
    }
    GROUP BY ?${varName}
    ORDER BY DESC(?n)
    LIMIT 15
  `;
  const bindings = await ask(q);
  const rows = bindings.map(b => {
    const v = b[varName].value;
    const display = klass === 'FlakyCommand' ? trim(v, 80) : shortFile(v);
    return [display, b.n.value];
  });
  document.getElementById(divId).innerHTML = tbl([label, 'n'], rows, { numCols: [1], empty });
}

async function load() {
  try {
    await loadStats();
    await loadSessions();
    await loadDerived('file', 'Hotspot',      'modifiedIn',  'hotspots', 'file',    'no hotspots — need ≥3 sessions touching the same file');
    await loadDerived('cmd',  'FlakyCommand', 'failedIn',    'flaky',    'command', 'no flaky commands — need ≥2 sessions with a failed command');
    await loadDerived('file', 'ActiveFile',   'modifiedIn',  'active',   'file',    'no active files — run a session, then `predicate maintain`');
  } catch (e) {
    document.getElementById('err').textContent = 'Failed to load: ' + e.message;
    document.getElementById('err').style.display = 'block';
  }
}
load();
setInterval(load, 30000); // refresh every 30s
</script>
</body>
</html>
```

The HTML is self-contained. The `/api/query` endpoint is proxied by the CLI server (Task 2) to avoid CORS.

### Task 2: `predicate dashboard` CLI

Create `packages/predicate-cli/src/commands/dashboard.ts`:

```typescript
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
    join(here, '..', '..', 'dashboard', 'index.html'),  // bundled cli.bundle.mjs next to dashboard/
    join(here, '..', 'dashboard', 'index.html'),
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
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    port,
    url: `http://127.0.0.1:${port}`,
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
```

### Task 3: Tests

Create `packages/predicate-cli/tests/dashboard.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { startDashboardServer, type DashboardServerHandle } from '../src/commands/dashboard.js';

let handle: DashboardServerHandle | undefined;

afterEach(async () => {
  if (handle) { await handle.close(); handle = undefined; }
});

describe('predicate dashboard server', () => {
  it('serves the dashboard HTML on GET /', async () => {
    handle = await startDashboardServer(0);  // port 0 = OS-assigned
    const r = await fetch(handle.url + '/');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/html');
    const body = await r.text();
    expect(body).toContain('<title>Predicate Dashboard</title>');
    expect(body).toContain('/api/query');
  });

  it('returns 404 for unknown paths', async () => {
    handle = await startDashboardServer(0);
    const r = await fetch(handle.url + '/nope');
    expect(r.status).toBe(404);
  });

  it('proxies SPARQL queries to Fuseki on POST /api/query', async () => {
    handle = await startDashboardServer(0);
    const r = await fetch(handle.url + '/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'query=' + encodeURIComponent('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:tbox> { ?s ?p ?o } }'),
    });
    expect(r.status).toBe(200);
    const json = await r.json() as { results: { bindings: Array<{ n: { value: string } }> } };
    expect(parseInt(json.results.bindings[0]!.n.value, 10)).toBeGreaterThan(0);
  });
});
```

Three tests. Uses port 0 so the OS picks a free port — tests don't conflict if run in parallel.

### Task 4: Register command + ensure dashboard ships in the bundle

Modify `packages/predicate-cli/src/index.ts`:
- Add `import { dashboard } from './commands/dashboard.js';`
- Add help text line: `dashboard       Serve a localhost web view of session-history + reasoning output.`
- Add switch case: `case 'dashboard':    return dashboard(process.argv.slice(3));`

Modify `packages/predicate-skill/package.json`:
- Add `"dashboard"` to the `files` array so the dashboard HTML ships in the npm package.

Modify `packages/predicate-skill/scripts/bundle.mjs` if needed:
- The bundle script likely copies certain files. Check if `dashboard/` needs to be copied alongside the bundles. If yes, add a copy step. If the bundle already serves from the source path, no change needed.

The `findDashboardHtml()` helper in dashboard.ts tries multiple candidate paths, so the dashboard should resolve in both dev (monorepo) and installed (npm) layouts.

### Task 5: README + version bump + release

- Bump 1.9.0 → 1.10.0 across all three manifest files.
- Top-level README: add new "Dashboard" section after the "CLI" section:
  ```markdown
  ## Dashboard

  ```bash
  predicate dashboard
  ```

  Serves a localhost web view at http://127.0.0.1:4040 showing recent
  sessions, hotspots, flaky commands, active files, and graph stats.
  Auto-refreshes every 30s. `--port N` to override; `--no-open` to skip
  the browser launch.
  ```
- Status section: v1.10 — web dashboard.
- Bundle rebuild.
- Single commit.
- Tag `v1.10.0-dashboard`.
- Merge to main + push.
- Expected test count: ~222 (219 + 3 new dashboard tests).
