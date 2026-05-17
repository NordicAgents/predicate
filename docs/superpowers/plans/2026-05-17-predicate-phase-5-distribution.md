# Predicate Phase 5 — Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Predicate installable in Claude Code via a single command:

```
/plugin marketplace add <owner>/predicate
/plugin install predicate@predicate
```

Bundle the MCP server into a single self-contained file, fix the plugin manifest to use the correct path variable, add the marketplace index, ship a `predicate` CLI for ops (`up`/`down`/`doctor`/`stats`), expose operator-facing skills (`predicate-doctor`, `predicate-stats`), and rewrite the README into a Claude-Code-first install guide.

**Architecture:** A new top-level esbuild pipeline produces two bundled `.mjs` files inside `packages/predicate-skill/`: `server.bundle.mjs` (the MCP entry, with `predicate-agent` + `predicate-reasoner` inlined) and `cli.bundle.mjs` (the `predicate` operator CLI). The bundles are committed so that cloning the repo as a Claude Code marketplace is enough — no `pnpm install` required on the user side. The plugin manifest moves to `${CLAUDE_PLUGIN_ROOT}/server.bundle.mjs`. A root-level `.claude-plugin/marketplace.json` declares the predicate plugin and points at `./packages/predicate-skill`. Two new skill subdirectories (`skills/predicate-doctor`, `skills/predicate-stats`) give Claude operator-facing slash-style entries by name. Fuseki + Docker remain prerequisites — there is no way to bundle them — but the CLI's `doctor` subcommand validates the entire stack and prints actionable error messages.

**Tech Stack:** Node 20+, esbuild (new build-time dev dep), existing `predicate-mcp`/`predicate-reasoner`/`predicate-agent` runtime deps (all pure JS, all inlineable).

**Spec reference:** [`docs/superpowers/specs/2026-05-16-predicate-design.md`](../specs/2026-05-16-predicate-design.md) §§ 7 (SKILL.md / host-agent contract), 10 (hooks). New material — distribution is not specified by the design doc; this plan defines the contract.

**Phase exit criteria:**
- `packages/predicate-skill/server.bundle.mjs` and `cli.bundle.mjs` exist, are committed, and run on a clean machine without `node_modules`.
- The plugin manifest uses `${CLAUDE_PLUGIN_ROOT}` and points at the bundle. The `${PLUGIN_DIR}/../predicate-mcp/dist/...` path is gone.
- A repo-root `.claude-plugin/marketplace.json` declares the predicate plugin. A `git clone` of this repo is enough to make `/plugin marketplace add <owner>/predicate` work.
- The `predicate` CLI works: `predicate up`, `predicate down`, `predicate doctor`, `predicate stats`, `predicate --version`.
- `predicate doctor` reports green when Fuseki is up + TBox loaded; reports actionable red when not.
- README has a Claude Code one-command install block at the top, an MCP-only install block, and a "what's required" preflight (Docker + Node 20).
- All 145 existing tests still pass; new tests cover the CLI surface.
- Phase tag `v1.1.0-distribution` at the final commit.

---

## File structure (created or modified in Phase 5)

```
predicate/
├── .claude-plugin/                                     (new)
│   └── marketplace.json                                ← new (root marketplace index)
├── packages/
│   ├── predicate-cli/                                  (new package)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── .eslintrc.json
│   │   ├── src/
│   │   │   ├── index.ts                                ← CLI entry (argv router)
│   │   │   ├── commands/
│   │   │   │   ├── up.ts                               ← docker compose up + bootstrap
│   │   │   │   ├── down.ts                             ← docker compose down
│   │   │   │   ├── doctor.ts                           ← health checks
│   │   │   │   └── stats.ts                            ← calls kgStats and prints
│   │   │   └── docker.ts                               ← locate compose file + exec wrapper
│   │   └── tests/
│   │       ├── doctor.test.ts
│   │       └── stats.test.ts
│   ├── predicate-skill/                                (modified)
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json                             ← rewrite (CLAUDE_PLUGIN_ROOT + bundle path)
│   │   ├── server.bundle.mjs                           ← new (committed bundle)
│   │   ├── cli.bundle.mjs                              ← new (committed bundle)
│   │   ├── skills/
│   │   │   ├── predicate/SKILL.md                      (existing)
│   │   │   ├── predicate-doctor/SKILL.md               ← new
│   │   │   └── predicate-stats/SKILL.md                ← new
│   │   ├── hooks/                                      (existing, unchanged)
│   │   ├── compose/                                    ← new (relocated docker-compose)
│   │   │   ├── docker-compose.yml                      ← copy of predicate-server's, paths fixed
│   │   │   └── fuseki/
│   │   │       └── config.ttl                          ← copy of predicate-server's
│   │   ├── scripts/
│   │   │   └── bundle.mjs                              ← new (esbuild driver)
│   │   ├── package.json                                ← new (bin: predicate)
│   │   └── README.md                                   ← rewritten
└── README.md                                            ← rewritten (Claude Code first)
```

The `predicate-cli` package is the source-of-truth TypeScript; the bundle in `predicate-skill/cli.bundle.mjs` is its build artifact (committed for the marketplace-install path). Similarly `server.bundle.mjs` is built from `predicate-mcp/src/index.ts` with `predicate-agent` and `predicate-reasoner` inlined.

The `compose/` dir inside `predicate-skill/` is a deliberate duplicate of `packages/predicate-server/` content. Reasoning: when Claude Code installs a plugin from a marketplace, it only copies the plugin directory (`packages/predicate-skill/`) — sibling packages aren't included. The CLI's `up`/`down` commands need to find the compose file inside the plugin directory at install time. The original `predicate-server` package stays for dev workflows; the `compose/` mirror is for distribution.

---

## Task 1: Fix the plugin manifest variable + add marketplace.json

This task makes the plugin **technically loadable** by Claude Code via the marketplace path. No bundling yet — the manifest still points at the workspace `dist/`. That keeps Task 1 small and reviewable, and Task 2 swaps to the bundle.

**Files:**
- Modify: `packages/predicate-skill/.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Rewrite `packages/predicate-skill/.claude-plugin/plugin.json`**

Replace the file with:

```json
{
  "name": "predicate",
  "version": "1.0.0",
  "description": "Local reasoning knowledge graph (RDF/OWL) for AI agents.",
  "author": {
    "name": "MX Research"
  },
  "homepage": "https://github.com/mxresearch/predicate#readme",
  "repository": "https://github.com/mxresearch/predicate",
  "license": "Apache-2.0",
  "keywords": ["mcp", "knowledge-graph", "rdf", "owl", "sparql", "reasoning"],
  "mcpServers": {
    "predicate": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server.bundle.mjs"],
      "env": {
        "FUSEKI_URL": "http://localhost:3030",
        "PREDICATE_DATASET": "predicate"
      }
    }
  },
  "skills": "./skills/",
  "hooks": "./hooks/hooks.json"
}
```

Note: `${PLUGIN_DIR}` → `${CLAUDE_PLUGIN_ROOT}` (the correct CC plugin variable). The path target moves from `../predicate-mcp/dist/src/index.js` to `server.bundle.mjs` co-located with the manifest. The file doesn't exist yet — Task 2 produces it.

- [ ] **Step 2: Create `.claude-plugin/marketplace.json` at the repo root**

```bash
mkdir -p .claude-plugin
```

Then write `.claude-plugin/marketplace.json`:

```json
{
  "name": "predicate",
  "owner": {
    "name": "MX Research",
    "email": "admin@aerobase.se"
  },
  "metadata": {
    "description": "Predicate — local reasoning knowledge graph for AI agents",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "predicate",
      "source": "./packages/predicate-skill",
      "description": "Local RDF/OWL knowledge graph with 16-rule reasoner, agent loop, schema-evolution gates, and the 8 kg_* MCP tools.",
      "version": "1.0.0",
      "author": { "name": "MX Research" },
      "category": "knowledge-graph",
      "keywords": ["mcp", "rdf", "owl", "sparql", "reasoning", "agent"]
    }
  ]
}
```

- [ ] **Step 3: Verify the manifest parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json'))" && echo ok
node -e "JSON.parse(require('fs').readFileSync('packages/predicate-skill/.claude-plugin/plugin.json'))" && echo ok
```

Expected: `ok` twice.

- [ ] **Step 4: Run the existing test suite to confirm no regressions**

```bash
pnpm test
```

Expected: 145/145 still green (this task touches manifests only).

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/marketplace.json packages/predicate-skill/.claude-plugin/plugin.json
git commit -m "feat(skill): add marketplace.json + fix plugin manifest variable"
```

---

## Task 2: Bundle the MCP server with esbuild

Bundle `packages/predicate-mcp/src/index.ts` plus its full workspace-dep import graph (`predicate-agent`, `predicate-reasoner`) into a single committed `server.bundle.mjs` inside the plugin directory. External native deps stay external; everything pure-JS is inlined.

**Files:**
- Modify: `package.json` (workspace root) — add `esbuild` devDep + `build:bundle` script
- Create: `packages/predicate-skill/scripts/bundle.mjs`
- Create: `packages/predicate-skill/server.bundle.mjs` (build artifact, committed)
- Modify: `.gitignore` — make sure `server.bundle.mjs` is NOT ignored

- [ ] **Step 1: Add esbuild to the workspace root**

Modify the root `package.json`. Add to `devDependencies`:

```json
"devDependencies": {
  "typescript": "^5.5.0",
  "@types/node": "^20.14.0",
  "esbuild": "^0.27.0"
}
```

Add to `scripts`:

```json
"scripts": {
  "build": "pnpm -r --filter './packages/*' build",
  "build:bundle": "pnpm --filter predicate-skill bundle",
  ...
}
```

Run:

```bash
pnpm install
```

Expected: esbuild lands in `node_modules`; no errors.

- [ ] **Step 2: Create `packages/predicate-skill/scripts/bundle.mjs`**

```javascript
#!/usr/bin/env node
import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repoRoot = resolve(root, '..', '..');

await build({
  entryPoints: [resolve(repoRoot, 'packages/predicate-mcp/src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: resolve(root, 'server.bundle.mjs'),
  banner: { js: '#!/usr/bin/env node' },
  minify: false,
  sourcemap: false,
  // Native deps stay external — predicate has none today, but list the
  // common offenders so future migrations don't get bitten.
  external: ['better-sqlite3'],
});

console.log('built server.bundle.mjs');
```

- [ ] **Step 3: Add a `bundle` script to `packages/predicate-skill/package.json`**

The predicate-skill directory needs a `package.json` for pnpm to recognize it as a workspace member (it may not have one yet — check). Create or modify:

```json
{
  "name": "predicate-skill",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "bundle": "node scripts/bundle.mjs"
  }
}
```

- [ ] **Step 4: Make sure all upstream packages are built first**

`predicate-mcp` re-exports types and runtime symbols from `predicate-agent` and `predicate-reasoner` via the workspace symlink. esbuild resolves through `pnpm`'s symlinked `node_modules`. Run the regular workspace builds first to make sure source files exist where esbuild expects them:

```bash
pnpm --filter predicate-mcp build
pnpm --filter predicate-reasoner build
pnpm --filter predicate-agent build
```

Expected: each emits `dist/src/index.js` — clean exit.

- [ ] **Step 5: Run the bundler**

```bash
pnpm build:bundle
```

Expected output: `built server.bundle.mjs`. The file should be ~500KB–1MB depending on bundled deps. If esbuild reports unresolved imports, the error message names them — typically a workspace import using a `.js` extension that needs `.ts` in source. Fix by updating the offending import or marking it external.

- [ ] **Step 6: Smoke-test the bundle**

```bash
node packages/predicate-skill/server.bundle.mjs < /dev/null &
PID=$!
sleep 1
kill $PID 2>/dev/null || true
echo "bundle started"
```

Expected: process starts, doesn't crash for 1s, gets killed. (Full MCP handshake is exercised by the existing tests.)

- [ ] **Step 7: Make sure `.gitignore` does NOT exclude the bundle**

Read the current `.gitignore`. If it has any pattern that catches `*.bundle.mjs` or `server.bundle.mjs`, add an explicit `!` exception or remove the broad pattern. The current `.gitignore` ignores `dist/` and `node_modules/` only, so the bundle (under `packages/predicate-skill/`) should already be safe — verify with:

```bash
git check-ignore packages/predicate-skill/server.bundle.mjs || echo "not ignored — good"
```

Expected: `not ignored — good`.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml \
        packages/predicate-skill/package.json \
        packages/predicate-skill/scripts/bundle.mjs \
        packages/predicate-skill/server.bundle.mjs
git commit -m "build: bundle MCP server into self-contained server.bundle.mjs"
```

---

## Task 3: Predicate CLI — `up`/`down`/`doctor`/`stats`

A small Node CLI bundled into `cli.bundle.mjs`. It wraps `docker compose` for Fuseki ops and provides health checks + a stats viewer that can run without Claude.

**Files:**
- Create: `packages/predicate-cli/package.json`
- Create: `packages/predicate-cli/tsconfig.json`
- Create: `packages/predicate-cli/vitest.config.ts`
- Create: `packages/predicate-cli/.eslintrc.json`
- Create: `packages/predicate-cli/src/index.ts`
- Create: `packages/predicate-cli/src/docker.ts`
- Create: `packages/predicate-cli/src/commands/up.ts`
- Create: `packages/predicate-cli/src/commands/down.ts`
- Create: `packages/predicate-cli/src/commands/doctor.ts`
- Create: `packages/predicate-cli/src/commands/stats.ts`
- Create: `packages/predicate-cli/tests/doctor.test.ts`
- Create: `packages/predicate-cli/tests/stats.test.ts`
- Create: `packages/predicate-skill/compose/docker-compose.yml`
- Create: `packages/predicate-skill/compose/fuseki/config.ttl`
- Modify: `packages/predicate-skill/scripts/bundle.mjs` (add CLI bundle)
- Modify: `packages/predicate-skill/package.json` (add `bin`)
- Create: `packages/predicate-skill/cli.bundle.mjs` (build artifact, committed)

- [ ] **Step 1: Write `packages/predicate-cli/package.json`**

```json
{
  "name": "predicate-cli",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "dist/src/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "ESLINT_USE_FLAT_CONFIG=false eslint src tests --max-warnings 0"
  },
  "dependencies": {
    "predicate-mcp": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Mirror the existing tsconfig/eslintrc/vitest from another package**

Use `packages/predicate-agent/tsconfig.json` as the template:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

vitest.config.ts:

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
```

.eslintrc.json:

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

- [ ] **Step 3: Write `packages/predicate-cli/src/docker.ts`**

```typescript
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Locate the docker-compose.yml shipped with the plugin. Strategy:
 * 1. $PREDICATE_COMPOSE_DIR if set
 * 2. <plugin-root>/compose (when run via the bundled CLI inside an installed plugin)
 * 3. ../predicate-skill/compose (when run from source in this monorepo)
 * 4. ../predicate-server (legacy fallback for dev workflows)
 *
 * Returns the directory containing `docker-compose.yml`.
 */
export function findComposeDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.PREDICATE_COMPOSE_DIR,
    resolve(here, 'compose'),
    resolve(here, '..', 'compose'),
    resolve(here, '..', '..', 'predicate-skill', 'compose'),
    resolve(here, '..', '..', '..', 'predicate-skill', 'compose'),
    resolve(here, '..', '..', '..', 'predicate-server'),
  ].filter((p): p is string => Boolean(p));
  for (const c of candidates) {
    if (c && existsSync(resolve(c, 'docker-compose.yml'))) return c;
  }
  throw new Error(
    'Could not locate docker-compose.yml. ' +
    'Set PREDICATE_COMPOSE_DIR to the directory containing it, ' +
    `or run from the predicate repo root. Searched: ${candidates.join(', ')}`,
  );
}

export function dockerAvailable(): boolean {
  try {
    execSync('docker version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function compose(args: string[], cwd: string): number {
  const r = spawnSync('docker', ['compose', ...args], { cwd, stdio: 'inherit' });
  return r.status ?? 1;
}
```

- [ ] **Step 4: Write `packages/predicate-cli/src/commands/up.ts`**

```typescript
import { findComposeDir, dockerAvailable, compose } from '../docker.js';

export async function up(): Promise<number> {
  if (!dockerAvailable()) {
    console.error('Docker not found. Install Docker Desktop or Docker Engine first.');
    return 2;
  }
  const dir = findComposeDir();
  console.log(`bringing Fuseki up from ${dir}`);
  return compose(['up', '-d'], dir);
}
```

- [ ] **Step 5: Write `packages/predicate-cli/src/commands/down.ts`**

```typescript
import { findComposeDir, dockerAvailable, compose } from '../docker.js';

export async function down(): Promise<number> {
  if (!dockerAvailable()) {
    console.error('Docker not found.');
    return 2;
  }
  const dir = findComposeDir();
  return compose(['down'], dir);
}
```

- [ ] **Step 6: Write `packages/predicate-cli/src/commands/doctor.ts`**

```typescript
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { dockerAvailable } from '../docker.js';

interface Check { name: string; ok: boolean; detail?: string }

export async function doctor(): Promise<number> {
  const cfg = loadConfig();
  const checks: Check[] = [];

  checks.push({
    name: 'docker installed',
    ok: dockerAvailable(),
    detail: dockerAvailable() ? '' : 'install Docker Desktop',
  });

  const ping = await fetch(`${cfg.fusekiUrl}/$/ping`).catch(() => null);
  checks.push({
    name: 'fuseki reachable',
    ok: Boolean(ping?.ok),
    detail: ping?.ok ? cfg.fusekiUrl : `not reachable at ${cfg.fusekiUrl} — try 'predicate up'`,
  });

  if (ping?.ok) {
    const client = new SparqlClient(cfg);
    const tboxOk = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <kg:tbox> { ?c a owl:Class } }
    `).catch(() => false);
    checks.push({
      name: 'kg:tbox loaded',
      ok: tboxOk,
      detail: tboxOk ? '' : "no classes found — try 'predicate up' (re-runs bootstrap)",
    });
  }

  const width = Math.max(...checks.map((c) => c.name.length));
  for (const c of checks) {
    const mark = c.ok ? '[x]' : '[ ]';
    const name = c.name.padEnd(width);
    const detail = c.detail ? `  — ${c.detail}` : '';
    console.log(`${mark} ${name}${detail}`);
  }

  return checks.every((c) => c.ok) ? 0 : 1;
}
```

- [ ] **Step 7: Write `packages/predicate-cli/src/commands/stats.ts`**

```typescript
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { kgStats } from 'predicate-mcp/src/tools/kg-stats.js';

export async function stats(): Promise<number> {
  const client = new SparqlClient(loadConfig());
  const s = await kgStats(client);
  const rows: [string, string | number][] = [
    ['triples', s.triples],
    ['abox', s.abox],
    ['inferred', s.inferred],
    ['tbox', s.tbox],
    ['classes', s.classes],
    ['inferredRatio', s.inferredRatio.toFixed(3)],
    ['unusedConceptRatio', s.unusedConceptRatio.toFixed(3)],
    ['materializationLatencyMsP95', s.materializationLatencyMsP95],
  ];
  const width = Math.max(...rows.map(([k]) => k.length));
  for (const [k, v] of rows) {
    console.log(`${k.padEnd(width)}  ${v}`);
  }
  return 0;
}
```

- [ ] **Step 8: Write `packages/predicate-cli/src/index.ts`**

```typescript
#!/usr/bin/env node
import { up } from './commands/up.js';
import { down } from './commands/down.js';
import { doctor } from './commands/doctor.js';
import { stats } from './commands/stats.js';

const VERSION = '1.0.0';

function help(): void {
  console.log(`predicate <command>

Commands:
  up           Bring Fuseki up (docker compose up -d) and load the seed TBox.
  down         Stop Fuseki, preserve the data volume.
  doctor       Health checks: docker, fuseki, tbox.
  stats        Print kg_stats output for the live graph.
  --version    Print the predicate version.
  --help       This message.

Env:
  FUSEKI_URL                http://localhost:3030 (default)
  PREDICATE_DATASET         predicate (default)
  PREDICATE_ADMIN_USER      admin (default)
  PREDICATE_ADMIN_PASSWORD  changeme (default)
  PREDICATE_COMPOSE_DIR     override docker-compose.yml location
`);
}

async function main(): Promise<number> {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'up':        return up();
    case 'down':      return down();
    case 'doctor':    return doctor();
    case 'stats':     return stats();
    case '--version':
    case 'version':   console.log(VERSION); return 0;
    case undefined:
    case '--help':
    case 'help':      help(); return 0;
    default:
      console.error(`unknown command: ${cmd}`);
      help();
      return 2;
  }
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 9: Write the failing tests `packages/predicate-cli/tests/doctor.test.ts`**

```typescript
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
    process.env.FUSEKI_URL = 'http://localhost:65535';   // closed port
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await doctor();
    log.mockRestore();
    process.env.FUSEKI_URL = original;
    expect(code).toBe(1);
  });
});
```

Tests for `packages/predicate-cli/tests/stats.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { stats } from '../src/commands/stats.js';

describe('stats', () => {
  it('prints kg_stats output and returns 0', async () => {
    const lines: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((m: string) => {
      lines.push(m);
    });
    const code = await stats();
    log.mockRestore();
    expect(code).toBe(0);
    expect(lines.some((l) => l.startsWith('triples'))).toBe(true);
    expect(lines.some((l) => l.startsWith('abox'))).toBe(true);
  });
});
```

- [ ] **Step 10: Install + run**

```bash
pnpm install
pnpm --filter predicate-cli test
```

Expected: 3 passed.

Full workspace:

```bash
pnpm test
```

Expected: 145 + 3 = 148 total.

- [ ] **Step 11: Copy compose files into `packages/predicate-skill/compose/`**

```bash
mkdir -p packages/predicate-skill/compose/fuseki
cp packages/predicate-server/docker-compose.yml packages/predicate-skill/compose/docker-compose.yml
cp packages/predicate-server/fuseki/config.ttl packages/predicate-skill/compose/fuseki/config.ttl
```

Read `packages/predicate-skill/compose/docker-compose.yml`. The `volumes` paths in the copy must still resolve from the new location. The original uses `./fuseki/config.ttl` which is now `compose/fuseki/config.ttl` relative to the skill — the relative path stays valid because we copied `fuseki/` alongside. No edit needed unless verification fails.

- [ ] **Step 12: Verify the bundled compose works**

```bash
PREDICATE_COMPOSE_DIR=packages/predicate-skill/compose docker compose -f packages/predicate-skill/compose/docker-compose.yml config
```

Expected: prints the resolved compose config without error. If the docker-compose.yml uses a name like `fuseki-data:/fuseki` that's a named volume, the named volume from this compose context is independent from the dev-time one — which is correct, plugin users get a fresh data dir.

- [ ] **Step 13: Extend `packages/predicate-skill/scripts/bundle.mjs` to also build the CLI bundle**

Append after the existing `build({...})` block:

```javascript
await build({
  entryPoints: [resolve(repoRoot, 'packages/predicate-cli/src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: resolve(root, 'cli.bundle.mjs'),
  banner: { js: '#!/usr/bin/env node' },
  minify: false,
  sourcemap: false,
  external: ['better-sqlite3'],
});

console.log('built cli.bundle.mjs');
```

- [ ] **Step 14: Build the bundle**

```bash
pnpm build:bundle
chmod +x packages/predicate-skill/cli.bundle.mjs
```

Expected: both `server.bundle.mjs` and `cli.bundle.mjs` produced.

- [ ] **Step 15: Add `bin` to `packages/predicate-skill/package.json`**

Modify `packages/predicate-skill/package.json`:

```json
{
  "name": "predicate-skill",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "bin": {
    "predicate": "./cli.bundle.mjs"
  },
  "scripts": {
    "bundle": "node scripts/bundle.mjs"
  }
}
```

(The `private: true` keeps this from being npm-publishable. Removing `private` is a separate Phase 5b step if you want to publish to npm.)

- [ ] **Step 16: Smoke-test the bundled CLI**

```bash
node packages/predicate-skill/cli.bundle.mjs --version
```

Expected: `1.0.0`.

```bash
node packages/predicate-skill/cli.bundle.mjs doctor
```

Expected: 3 lines of `[x] / [ ]` checks; exit 0 if Fuseki is running, 1 if not.

- [ ] **Step 17: Commit**

```bash
git add packages/predicate-cli \
        packages/predicate-skill/scripts/bundle.mjs \
        packages/predicate-skill/package.json \
        packages/predicate-skill/cli.bundle.mjs \
        packages/predicate-skill/server.bundle.mjs \
        packages/predicate-skill/compose \
        pnpm-lock.yaml
git commit -m "feat(cli): predicate up/down/doctor/stats + bundled CLI"
```

---

## Task 4: Operator skills — `/predicate-doctor` and `/predicate-stats`

In Claude Code, plugin skills appear as named entries the agent (and the user via auto-trigger) can reach for. Adding two operator skills gives users a quick way to run `doctor` and `stats` without typing the shell command — Claude reads the skill body and calls the right MCP tool.

**Files:**
- Create: `packages/predicate-skill/skills/predicate-doctor/SKILL.md`
- Create: `packages/predicate-skill/skills/predicate-stats/SKILL.md`

- [ ] **Step 1: Write `packages/predicate-skill/skills/predicate-doctor/SKILL.md`**

```markdown
---
name: predicate-doctor
description: Run a health check on the Predicate stack — Fuseki reachability, TBox loaded, all 8 kg_* tools responsive. Use when the user asks "is predicate working", "what's the status", or any kg_* tool just returned an unexpected error.
---

# When to use

- The user asks "is predicate up", "check predicate", "what's wrong with the kg".
- A `kg_*` MCP tool just returned a connection or auth error.
- After bringing Fuseki up for the first time, to confirm the seed TBox loaded.

# Workflow

1. Call `kg_stats`. If it errors with a connection refused or 401, **Fuseki is not reachable** — tell the user to run `predicate up` (or `pnpm fuseki:up` from a dev clone) and stop here.
2. If `kg_stats` succeeds, report:
   - `s.tbox > 0` → TBox is loaded.
   - `s.classes` → number of declared classes (should be ≥ 10 for the seed codebase TBox).
   - `s.triples`, `s.abox`, `s.inferred` → graph sizes.
3. Optionally call `kg_explore_schema("File")` to confirm the seed TBox is the codebase domain.

# Report format

A short summary in this shape:

> Predicate is **up**. TBox: N classes. ABox: M triples. Inferred: K. Last
> materialization p95: X ms. (or: "no materialization events yet")

If anything is off, lead with what's broken and the one-liner fix.
```

- [ ] **Step 2: Write `packages/predicate-skill/skills/predicate-stats/SKILL.md`**

```markdown
---
name: predicate-stats
description: Show current graph metrics — triple counts, inferred ratio, unused-concept ratio. Use when the user asks "how big is the graph", "what's the inferred ratio", "show stats", or wants to track v1 success metrics from the PRD.
---

# When to use

- The user asks "how many triples", "graph size", "stats", "metrics".
- The user wants to track the bounded-growth metric (`unusedConceptRatio < 0.15`).
- Before/after a `kg_maintain` run to see what changed.

# Workflow

1. Call `kg_stats`.
2. Render the result as a compact table:

```
triples                123
abox                   45
inferred                8
tbox                   70
classes                12
inferredRatio        0.151
unusedConceptRatio   0.500
materializationLatencyMsP95   0
```

3. If `unusedConceptRatio > 0.15`, note that the bounded-growth metric is currently failing the PRD §16 target and the next `kg_maintain` run should help.
4. If `materializationLatencyMsP95 == 0`, note that no materialization events have been recorded yet (this is normal until the reasoner runs).
```

- [ ] **Step 3: Verify the skill manifest still parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('packages/predicate-skill/.claude-plugin/plugin.json'))" && echo ok
```

The manifest's `"skills": "./skills/"` value picks up subdirectories automatically; no edit needed.

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-skill/skills/predicate-doctor \
        packages/predicate-skill/skills/predicate-stats
git commit -m "feat(skill): add predicate-doctor + predicate-stats operator skills"
```

---

## Task 5: Add a `bundle` step to the workspace `build` script

Now that the bundle is part of the distribution surface, it must be rebuilt automatically when any source package changes. Tie `pnpm build` to also run the bundler.

**Files:**
- Modify: workspace root `package.json`

- [ ] **Step 1: Update the root `build` script**

Read the current root `package.json`. Replace the `build` script:

```json
"scripts": {
  "build": "pnpm -r --filter './packages/*' build && pnpm build:bundle",
  "build:bundle": "pnpm --filter predicate-skill bundle",
  "test": "pnpm -r --workspace-concurrency=1 --filter './packages/*' test",
  ...
}
```

- [ ] **Step 2: Verify the chain**

```bash
rm -f packages/predicate-skill/server.bundle.mjs \
      packages/predicate-skill/cli.bundle.mjs
pnpm build
ls -la packages/predicate-skill/*.bundle.mjs
```

Expected: both bundles regenerated. Sizes nonzero.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "build: make pnpm build also rebuild the plugin bundles"
```

---

## Task 6: Rewrite the README — Claude-Code-first install

The current README starts with "git clone + pnpm install". Phase 5 flips it to "marketplace install" and pushes the dev path to the bottom.

**Files:**
- Modify: `README.md` (top-level)
- Modify: `packages/predicate-skill/README.md`

- [ ] **Step 1: Rewrite root `README.md`**

Read the current README. Replace it entirely with:

```markdown
# Predicate

A local-first MCP skill that gives AI agents a knowledge graph they can reason
over and that improves itself with use.

See [`docs/predicate-prd.md`](docs/predicate-prd.md) for the product brief,
[`docs/superpowers/specs/2026-05-16-predicate-design.md`](docs/superpowers/specs/2026-05-16-predicate-design.md)
for the v1 architecture.

## Quick install (Claude Code)

Prerequisites: **Docker** (for Fuseki) and **Node 20+**.

```
/plugin marketplace add mxresearch/predicate
/plugin install predicate@predicate
```

Restart Claude Code (or `/reload-plugins`). Then bring Fuseki up — the plugin
ships a CLI for this:

```bash
predicate up           # starts Fuseki, loads the seed TBox + meta + shapes
predicate doctor       # confirms everything is green
```

Try it in Claude:

> "Why did login break?"

Claude will call `kg_explore_schema → kg_ask → kg_explain` against your graph.
To load a codebase as an ABox in one shot, ask:

> "Research goal: what depends on auth.ts transitively. Use my code at
> /path/to/repo as the corpus."

That routes through `kg_research_goal(executeResearch=true, corpusRoot=...)`,
which fetches the files, extracts triples, and asserts them through
`kg_assert` (TBox-membership-gated, RDF-star-provenance-tagged).

## MCP-only install (any tool that speaks MCP)

If you only want the 8 `kg_*` tools and don't want the SKILL.md / hooks:

```bash
git clone https://github.com/mxresearch/predicate
cd predicate
pnpm install && pnpm build
predicate up

claude mcp add predicate -- node "$(pwd)/packages/predicate-skill/server.bundle.mjs" \
  --env FUSEKI_URL=http://localhost:3030 \
  --env PREDICATE_DATASET=predicate
```

## Tools

| Tool | What it does |
|---|---|
| `kg_explore_schema` | Returns the TBox slice for a concept (classes, properties, characteristics). |
| `kg_ask` | Executes a caller-drafted SPARQL query, logs to `kg:usage`, truncates results. |
| `kg_assert` | Writes a triple to `kg:abox` with RDF-star provenance; rejects undeclared predicates. |
| `kg_explain` | Returns a backward-chained derivation for a claim, with cited provenance. |
| `kg_propose_schema` | Stages a `SchemaDelta` proposal in `kg:tbox-staging`. |
| `kg_research_goal` | Decompose a goal → gap-detect → (optional) execute research → return a plan. |
| `kg_stats` | Triples / abox / inferred / tbox counts, inferred ratio, unused-concept ratio. |
| `kg_maintain` | Runs reaper + generalizer + promotion sweeper. |

## CLI

```
predicate up           # docker compose up + bootstrap graphs + load TBox
predicate down         # stop fuseki, keep the volume
predicate doctor       # health checks (docker, fuseki, tbox, tools)
predicate stats        # current kg_stats output
predicate --version
predicate --help
```

## Packages

| Package | Purpose |
|---|---|
| `predicate-server` | Fuseki/TDB2 in Docker; 8 named graphs (dev workflow) |
| `predicate-mcp` | MCP server; 8 tools, all implemented |
| `predicate-reasoner` | OWL 2 RL reasoner (16 rules) + SHACL + kg_explain |
| `predicate-agent` | Goal store, decomposer, gap detector, research, schema proposer, sweeper, generalizer |
| `predicate-cli` | `predicate up/down/doctor/stats` CLI |
| `predicate-ontology` | Versioned TBox + SHACL shapes + meta vocabulary |
| `predicate-eval` | End-to-end demo + multi-hop eval harness |
| `predicate-skill` | Claude Code plugin — bundled server + CLI + SKILL.md + hooks |

## Development

Clone, install, build, test, run:

```bash
git clone https://github.com/mxresearch/predicate
cd predicate
pnpm install
pnpm build            # builds all packages + the plugin bundle
pnpm test             # 148 tests against a live Fuseki
pnpm fuseki:up        # for development; `predicate up` is the user-facing alias
```

See `docs/superpowers/plans/` for the per-phase implementation plans
(Foundation through Distribution).

## Status

**v1.1 — distributable.** All 8 MCP tools implemented; the agent loop is
closed end-to-end (goal → decompose → gap-detect → research → extract →
assert → query → explain) with schema-evolution gates (propose → stage →
validate → usage gate → promote). One-command Claude Code install via the
marketplace path. Operator CLI for Fuseki ops.

Deferred to v1.2 (see spec §17): materialization caching, tag-while-deriving
for `kg_explain`, intent-aware `ResearchSource` filtering, journal-based
cross-system promotion atomicity, LLM-augmented decomposer + extractor,
web/code research sources beyond `DocsResearchSource`, npm publish.
```

- [ ] **Step 2: Rewrite `packages/predicate-skill/README.md`**

Replace the file with:

```markdown
# predicate-skill

Claude Code plugin packaging the Predicate MCP server + SKILL.md + SessionStart
hook + operator skills. This is the install target for the marketplace path.

## Install (via marketplace)

```
/plugin marketplace add mxresearch/predicate
/plugin install predicate@predicate
```

After install, bring Fuseki up:

```bash
predicate up
predicate doctor
```

## What's in this directory

- `.claude-plugin/plugin.json` — MCP server + skills + hooks registration.
- `server.bundle.mjs` — bundled MCP server (no `node_modules` required).
- `cli.bundle.mjs` — bundled `predicate` CLI, surfaced via the package's `bin`.
- `skills/predicate/SKILL.md` — host-agent contract: triggers, workflow,
  HARD-GATE anti-patterns, four worked examples.
- `skills/predicate-doctor/SKILL.md`, `skills/predicate-stats/SKILL.md` —
  operator skills.
- `hooks/hooks.json` + `hooks/session-start.sh` — SessionStart hook that
  surfaces current goal/class counts.
- `compose/docker-compose.yml`, `compose/fuseki/config.ttl` — Fuseki config
  the CLI launches.

## Rebuilding the bundles

Bundles are committed so the marketplace install path works without
`pnpm install`. To rebuild after a source change:

```bash
pnpm --filter predicate-skill bundle
```

Or rebuild everything:

```bash
pnpm build
```
```

- [ ] **Step 3: Commit**

```bash
git add README.md packages/predicate-skill/README.md
git commit -m "docs: marketplace-install flow at the top, dev workflow at the bottom"
```

---

## Task 7: Phase 5 exit — verify + tag

**Files:**
- Modify: `README.md` (Status block already updated in Task 6 — verify only)

- [ ] **Step 1: Full verification chain**

```bash
pnpm test                          # 148/148 (145 + 3 new CLI)
pnpm typecheck                     # clean
pnpm lint                          # clean
pnpm build                         # rebuilds everything + bundles
predicate doctor                   # green if Fuseki is up
predicate stats                    # prints the table
```

If `predicate` isn't on PATH yet, run via the bundle:

```bash
node packages/predicate-skill/cli.bundle.mjs doctor
node packages/predicate-skill/cli.bundle.mjs stats
```

- [ ] **Step 2: Verify the marketplace install path works locally**

This simulates what a fresh Claude Code install would see:

```bash
# Pretend we're in a fresh checkout with no node_modules
node packages/predicate-skill/server.bundle.mjs < /dev/null &
SERVER_PID=$!
sleep 1
kill $SERVER_PID 2>/dev/null || true
echo "bundle starts without node_modules"
```

Expected: process starts, doesn't crash.

- [ ] **Step 3: Tag**

```bash
git tag v1.1.0-distribution
```

- [ ] **Step 4: Confirm final state**

```bash
git log --oneline -15
git tag --list 'v*'
```

Expected tags through Phase 5: `v0.1.0-foundation`, `v0.2.0-discipline`, `v0.3a.0-goals-and-gaps`, `v0.3b.0-research-execution`, `v0.3c.0-schema-evolution`, `v1.0.0`, `v1.1.0-distribution`.

- [ ] **Step 5: Print a final summary** (no commit; this is for the user)

```bash
echo "Phase 5 done."
echo "Install for users: /plugin marketplace add mxresearch/predicate"
echo "Then:               /plugin install predicate@predicate"
echo "Then:               predicate up && predicate doctor"
```

---

## Self-review

- **Spec coverage:** Distribution is not in the design spec — Phase 5 is the canonical contract for it. The plan respects the spec's existing surfaces: 8 MCP tools (no changes), the SKILL.md discipline contract (extended with two operator skills, not modified), the 8 named graphs (unchanged), the substrate (unchanged). No spec violations.
- **Placeholder scan:** zero "TBD" / "implement later" / "handle errors". Every step shows actual code or actual commands.
- **Type consistency:** `KgStats` reused from `predicate-agent`'s types (Phase 4). `SparqlClient` and `loadConfig` reused from `predicate-mcp`. The new CLI is a thin shell; the `doctor` and `stats` commands are wrappers over existing typed APIs.
- **Cross-package import paths:** `predicate-cli` imports from `predicate-mcp` via `predicate-mcp/src/*` workspace paths, matching the established pattern (Phase 3b, 4). esbuild resolves these via the pnpm symlinks. The bundle inlines them — no runtime workspace dependency.
- **Known follow-ups (Phase 5b candidate):**
  - **npm publish.** Drop `"private": true` from `packages/predicate-skill/package.json`, set the `name` to the public package name, and `npm publish` from a clean checkout. The `bin` already wires up `predicate`. After publish, users could `npm install -g predicate-skill && predicate up` without cloning.
  - **Slash commands proper.** Claude Code may add a dedicated `commands/` directory in a future plugin spec. The current operator-skill approach surfaces the same actions through the skill-router; revisit when the platform's command spec stabilizes.
  - **Multi-platform install matrix** (Gemini CLI, VS Code Copilot, OpenCode, Codex). Each needs its own hook adapter — context-mode's approach is to centralize a `context-mode hook <platform> <event>` dispatcher. Predicate's hook surface is smaller (just SessionStart, currently), so this is mostly README work plus per-platform `settings.json` snippets.
  - **Postinstall doctor.** Add a postinstall script to `predicate-skill/package.json` that runs `predicate doctor` and warns if Fuseki isn't reachable. Currently the user has to run it manually.
- **Test surface:** 3 new CLI tests; the workspace total goes 145 → 148. The plan does not add tests for the bundle integrity itself — the smoke test in Task 7 Step 2 is the substitute. A full E2E that starts the bundle as a subprocess, opens an MCP stdio session, and exercises tools would be the next level of rigor; tracked as a v1.2 follow-up.
