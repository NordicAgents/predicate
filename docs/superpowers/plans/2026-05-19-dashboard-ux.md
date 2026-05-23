# Dashboard UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Predicate dashboard from a passive 5-card status page into an interactive tool by adding (A) click-to-drill side panels for sessions/files/commands, (B) a schema-staging review queue with Approve/Reject, and (C) Server-Sent Events for live updates.

**Architecture:** Three additive layers over the existing dashboard. The browser-side HTML/JS grows new UI; the Node dashboard server gains two endpoints (`/api/action`, `/api/events`) plus an internal 1Hz Fuseki poller that broadcasts only on digest changes. State-changing actions are forwarded to two new CLI verbs (`predicate schema approve|reject|list`) that reuse `PromotionSweeper`'s existing promote/reject internals — exposed via a tiny new public method on the sweeper class. No changes to the Stop hook, ontology, or `predicate maintain`.

**Tech Stack:** TypeScript, Node `http`, Vitest, single-file `index.html` (vanilla JS + CSS), Apache Jena Fuseki, SPARQL 1.1, RDF-star.

**Spec:** [`docs/superpowers/specs/2026-05-19-dashboard-ux-design.md`](../specs/2026-05-19-dashboard-ux-design.md)

---

## File Structure

**New files**
- `packages/predicate-cli/src/commands/schema.ts` — `predicate schema approve|reject|list` CLI verbs.
- `packages/predicate-cli/tests/schema.test.ts` — Vitest coverage for the verbs.
- `packages/predicate-cli/tests/dashboard-action.test.ts` — `/api/action` endpoint tests.
- `packages/predicate-cli/tests/dashboard-events.test.ts` — `/api/events` SSE tests.
- `packages/predicate-agent/tests/promotion-sweeper-actions.test.ts` — Tests for the new public sweeper methods.

**Modified files**
- `packages/predicate-agent/src/promotion-sweeper.ts` — Add public `promoteById(id, opts)` and `rejectById(id, opts)` methods that wrap the existing private logic and accept a custom `actor` label.
- `packages/predicate-cli/src/commands/dashboard.ts` — Add `/api/action` and `/api/events` endpoints; add internal poller + SSE client set; preserve the existing `/api/query` proxy.
- `packages/predicate-cli/src/index.ts` — Register the `schema` dispatch + help text.
- `packages/predicate-skill/dashboard/index.html` — Add side-panel CSS/HTML/JS, staging card, EventSource subscription with polling fallback.

**Responsibility boundaries**
- `promotion-sweeper.ts` owns the *semantics* of promote and reject. The CLI doesn't reimplement them.
- `schema.ts` owns CLI shape (argv parsing, JSON output, exit codes).
- `dashboard.ts` owns HTTP/SSE; it never touches Fuseki for state changes — it spawns the CLI.
- `index.html` owns UI; it talks to the server, never to Fuseki directly.

This split means each file stays under ~400 lines and can be reasoned about independently.

---

## Task 1: Expose `promoteById` and `rejectById` on `PromotionSweeper`

The existing `promote` and `rejectExpired` are `private`. We add public methods that take a proposal id, look up the row, and call into the same logic — but with a configurable `actor` label so audit events distinguish user-initiated actions from sweeper-initiated ones.

**Files:**
- Modify: `packages/predicate-agent/src/promotion-sweeper.ts`
- Test: `packages/predicate-agent/tests/promotion-sweeper-actions.test.ts`

- [ ] **Step 1.1: Write the failing test for `promoteById` success path**

Create `packages/predicate-agent/tests/promotion-sweeper-actions.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { SchemaProposer } from '../src/schema-proposer.js';
import { PromotionSweeper } from '../src/promotion-sweeper.js';

const client = new SparqlClient(loadConfig());
const C = 'https://industriagents.com/predicate/codebase';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:inferred']) {
    await reset(g);
  }
});

afterAll(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:inferred']) {
    await reset(g);
  }
});

describe('PromotionSweeper.promoteById', () => {
  it('promotes a proposal regardless of useCount and tags the event with the supplied actor', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#userApprovedProp`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'user-test' });

    const sweeper = new PromotionSweeper(client, { useThreshold: 999 });
    const result = await sweeper.promoteById(id, { actor: 'user-approve' });
    expect(result.outcome).toBe('promoted');

    const events = await client.select(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT ?actor WHERE {
        GRAPH <kg:meta> {
          ?e a pred:SchemaPromoted ; pred:actor ?actor ; pred:goal <${id}> .
        }
      }
    `);
    expect(events.results.bindings[0]!['actor']!.value).toBe('user-approve');
  });
});
```

- [ ] **Step 1.2: Run the test to confirm it fails**

Run: `pnpm --filter predicate-agent test promotion-sweeper-actions`
Expected: FAIL with "sweeper.promoteById is not a function".

- [ ] **Step 1.3: Refactor `promote` and `rejectExpired` to accept an `actor`**

In `packages/predicate-agent/src/promotion-sweeper.ts`:

a) Change the `private async promote(p: ProposalRow)` signature to `private async promote(p: ProposalRow, actor: string = 'PromotionSweeper')`. Replace the two hard-coded `pred:actor "PromotionSweeper"` lines inside `promote` with `pred:actor ${escapeLiteral(actor)}`.

b) Change `private async rejectExpired(p: ProposalRow)` to `private async rejectExpired(p: ProposalRow, actor: string = 'PromotionSweeper', reason: string = 'expired')`. Replace the hard-coded `"PromotionSweeper"` and `{ reason: 'expired' }` lines with the variables.

c) Update the existing call sites inside `decide()` so they pass no extra arguments (the defaults preserve current behavior).

- [ ] **Step 1.4: Add a private `loadProposalRow(id)` helper**

Add this method just below `listProposals`:

```typescript
private async loadProposalRow(id: string): Promise<ProposalRow | null> {
  const r = await this.client.select(`
    PREFIX pred: <${META}>
    SELECT ?kind ?expiresAt ?useCount ?justification ?parent ?migration WHERE {
      GRAPH <kg:tbox-staging> {
        ${escapeIRI(id)} a pred:Proposal ;
                          pred:kind          ?kind ;
                          pred:expiresAt     ?expiresAt ;
                          pred:useCount      ?useCount ;
                          pred:justification ?justification .
        OPTIONAL { ${escapeIRI(id)} pred:parent    ?parent }
        OPTIONAL { ${escapeIRI(id)} pred:migration ?migration }
      }
    }
  `);
  const b = r.results.bindings[0];
  if (!b) return null;
  return {
    id,
    kind: b['kind']!.value,
    expiresAt: b['expiresAt']!.value,
    useCount: parseInt(b['useCount']!.value, 10),
    justification: b['justification']!.value,
    parent: b['parent']?.value,
    migration: b['migration']?.value,
  };
}
```

- [ ] **Step 1.5: Add public `promoteById` and `rejectById`**

Add these methods on the `PromotionSweeper` class, just below `run()`:

```typescript
async promoteById(
  id: string,
  opts: { actor: string },
): Promise<PromotionDecision> {
  const row = await this.loadProposalRow(id);
  if (!row) {
    return { proposalId: id, outcome: 'rejected-validation', reason: 'proposal not found' };
  }
  const validation = await this.validateProposalInIsolation(row);
  if (!validation.ok) {
    await this.recordValidationFailed(row, validation.reason ?? 'validation failed');
    return {
      proposalId: id,
      outcome: 'rejected-validation',
      reason: validation.reason,
    };
  }
  const promoted = await this.promote(row, opts.actor);
  return {
    proposalId: id,
    outcome: 'promoted',
    turtleFile: promoted.turtleFile,
    tboxVersion: promoted.tboxVersion,
  };
}

async rejectById(
  id: string,
  opts: { actor: string; reason: string },
): Promise<PromotionDecision> {
  const row = await this.loadProposalRow(id);
  if (!row) {
    return { proposalId: id, outcome: 'rejected-expired', reason: 'proposal not found' };
  }
  await this.rejectExpired(row, opts.actor, opts.reason);
  return { proposalId: id, outcome: 'rejected-expired', reason: opts.reason };
}
```

- [ ] **Step 1.6: Run the test to confirm it passes**

Run: `pnpm --filter predicate-agent test promotion-sweeper-actions`
Expected: PASS.

- [ ] **Step 1.7: Run the existing sweeper test to confirm no regression**

Run: `pnpm --filter predicate-agent test promotion-sweeper.test`
Expected: PASS — the default-arg refactor preserves all previous behavior.

- [ ] **Step 1.8: Add a failing test for `rejectById`**

Append to `promotion-sweeper-actions.test.ts`:

```typescript
describe('PromotionSweeper.rejectById', () => {
  it('removes the proposal and tags the event with the supplied actor + reason', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#userRejectedProp`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'user-test' });

    const sweeper = new PromotionSweeper(client);
    const result = await sweeper.rejectById(id, {
      actor: 'user-reject',
      reason: 'rejected via dashboard',
    });
    expect(result.outcome).toBe('rejected-expired');

    const stillThere = await client.ask(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      ASK { GRAPH <kg:tbox-staging> { <${id}> a pred:Proposal } }
    `);
    expect(stillThere).toBe(false);

    const events = await client.select(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT ?actor ?payload WHERE {
        GRAPH <kg:meta> {
          ?e a pred:SchemaRejected ; pred:actor ?actor ; pred:goal <${id}> ; pred:payload ?payload .
        }
      }
    `);
    const b = events.results.bindings[0]!;
    expect(b['actor']!.value).toBe('user-reject');
    expect(JSON.parse(b['payload']!.value)).toEqual({ reason: 'rejected via dashboard' });
  });

  it('returns "rejected-expired" with reason="proposal not found" for unknown IRIs', async () => {
    const sweeper = new PromotionSweeper(client);
    const result = await sweeper.rejectById('urn:predicate:proposal:nope', {
      actor: 'user-reject', reason: 'x',
    });
    expect(result.reason).toBe('proposal not found');
  });
});
```

- [ ] **Step 1.9: Run both tests; commit**

Run: `pnpm --filter predicate-agent test promotion-sweeper`
Expected: all tests PASS.

```bash
git add packages/predicate-agent/src/promotion-sweeper.ts \
        packages/predicate-agent/tests/promotion-sweeper-actions.test.ts
git commit -m "feat(agent): public promoteById/rejectById on PromotionSweeper

Adds promoteById and rejectById that wrap the existing private
promote/rejectExpired logic and accept a custom actor label so
user-driven approvals from the dashboard are distinguishable
from automated sweeper actions in kg:meta event payloads."
```

---

## Task 2: New `predicate schema` CLI verbs

Three subcommands in one module. `list` returns the staging queue as JSON for the dashboard. `approve`/`reject` invoke the new sweeper methods. Output is line-delimited JSON to keep parsing trivial.

**Files:**
- Create: `packages/predicate-cli/src/commands/schema.ts`
- Test: `packages/predicate-cli/tests/schema.test.ts`
- Modify: `packages/predicate-cli/src/index.ts`

- [ ] **Step 2.1: Write failing tests for the three verbs**

Create `packages/predicate-cli/tests/schema.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { SchemaProposer } from 'predicate-agent/src/schema-proposer.js';
import { schema } from '../src/commands/schema.js';

const client = new SparqlClient(loadConfig());
const C = 'https://industriagents.com/predicate/codebase';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:inferred']) {
    await reset(g);
  }
});

afterAll(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:inferred']) {
    await reset(g);
  }
});

function captureStdout(): { restore: () => string } {
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((c: string | Uint8Array) => {
    chunks.push(typeof c === 'string' ? c : Buffer.from(c).toString('utf8'));
    return true;
  }) as typeof process.stdout.write;
  return { restore: () => { process.stdout.write = orig; return chunks.join(''); } };
}

describe('predicate schema list', () => {
  it('returns proposals as a JSON array', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#listed`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'test' });

    const cap = captureStdout();
    const code = await schema(['list']);
    const out = cap.restore();
    expect(code).toBe(0);

    const parsed = JSON.parse(out) as Array<{ id: string; kind: string; useCount: number }>;
    expect(parsed.some((p) => p.id === id && p.kind === 'add-property' && p.useCount === 0)).toBe(true);
  });
});

describe('predicate schema approve', () => {
  it('promotes the proposal and prints {ok:true,outcome:"promoted"}', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#approveTest`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'test' });

    const cap = captureStdout();
    const code = await schema(['approve', id]);
    const out = cap.restore();
    expect(code).toBe(0);
    const result = JSON.parse(out) as { ok: boolean; outcome: string };
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('promoted');
  });

  it('exits 2 and prints usage when the id is missing', async () => {
    const code = await schema(['approve']);
    expect(code).toBe(2);
  });
});

describe('predicate schema reject', () => {
  it('removes the proposal and prints {ok:true,outcome:"rejected-expired"}', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#rejectTest`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'test' });

    const cap = captureStdout();
    const code = await schema(['reject', id]);
    const out = cap.restore();
    expect(code).toBe(0);
    const result = JSON.parse(out) as { ok: boolean; outcome: string };
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('rejected-expired');
  });
});
```

- [ ] **Step 2.2: Run the test to confirm it fails**

Run: `pnpm --filter predicate-cli test schema`
Expected: FAIL with "Cannot find module './commands/schema.js'".

- [ ] **Step 2.3: Implement the `schema` command**

Create `packages/predicate-cli/src/commands/schema.ts`:

```typescript
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { PromotionSweeper } from 'predicate-agent/src/promotion-sweeper.js';

const META = 'https://industriagents.com/predicate/meta#';
const PROPOSAL_IRI = /^[A-Za-z][A-Za-z0-9+.\-]*:[A-Za-z0-9:_./#\-]+$/;

function help(): void {
  console.log(`predicate schema <verb> [args]

Verbs:
  list                    Print pending proposals from kg:tbox-staging as JSON.
  approve <proposalIri>   Force-promote a proposal (still runs validation).
  reject  <proposalIri>   Reject and remove a proposal from staging.
`);
}

async function listProposals(): Promise<number> {
  const client = new SparqlClient(loadConfig());
  const r = await client.select(`
    PREFIX pred: <${META}>
    SELECT ?id ?kind ?justification ?motivatingGoal ?proposedAt ?expiresAt ?useCount
    WHERE {
      GRAPH <kg:tbox-staging> {
        ?id a pred:Proposal ;
            pred:kind          ?kind ;
            pred:justification ?justification ;
            pred:proposedAt    ?proposedAt ;
            pred:expiresAt     ?expiresAt ;
            pred:useCount      ?useCount .
        OPTIONAL { ?id pred:motivatingGoal ?motivatingGoal }
      }
    }
    ORDER BY ?expiresAt
    LIMIT 200
  `);
  const out = r.results.bindings.map((b) => ({
    id: b['id']!.value,
    kind: b['kind']!.value,
    justification: b['justification']!.value,
    motivatingGoal: b['motivatingGoal']?.value,
    proposedAt: b['proposedAt']!.value,
    expiresAt: b['expiresAt']!.value,
    useCount: parseInt(b['useCount']!.value, 10),
  }));
  process.stdout.write(JSON.stringify(out));
  return 0;
}

async function approveProposal(id: string): Promise<number> {
  if (!PROPOSAL_IRI.test(id)) {
    console.error(`predicate schema approve: invalid proposal IRI: ${id}`);
    return 2;
  }
  const client = new SparqlClient(loadConfig());
  const sweeper = new PromotionSweeper(client);
  const decision = await sweeper.promoteById(id, { actor: 'user-approve' });
  const ok = decision.outcome === 'promoted';
  process.stdout.write(JSON.stringify({ ok, ...decision }));
  return ok ? 0 : 1;
}

async function rejectProposal(id: string): Promise<number> {
  if (!PROPOSAL_IRI.test(id)) {
    console.error(`predicate schema reject: invalid proposal IRI: ${id}`);
    return 2;
  }
  const client = new SparqlClient(loadConfig());
  const sweeper = new PromotionSweeper(client);
  const decision = await sweeper.rejectById(id, {
    actor: 'user-reject',
    reason: 'rejected via dashboard',
  });
  const ok = decision.outcome === 'rejected-expired';
  process.stdout.write(JSON.stringify({ ok, ...decision }));
  return ok ? 0 : 1;
}

export async function schema(args: string[]): Promise<number> {
  const verb = args[0];
  switch (verb) {
    case 'list':    return listProposals();
    case 'approve': {
      const id = args[1];
      if (!id) { help(); return 2; }
      return approveProposal(id);
    }
    case 'reject': {
      const id = args[1];
      if (!id) { help(); return 2; }
      return rejectProposal(id);
    }
    case undefined:
    case '--help':
    case 'help': help(); return 0;
    default:
      console.error(`predicate schema: unknown verb: ${verb}`);
      help();
      return 2;
  }
}
```

- [ ] **Step 2.4: Wire `schema` into the CLI dispatch**

Modify `packages/predicate-cli/src/index.ts`:

a) Add the import after the `init` import:

```typescript
import { schema } from './commands/schema.js';
```

b) Add the help line in the Commands block, right after `dashboard`:

```
  schema            List / approve / reject pending kg:tbox-staging proposals.
```

c) Add the case in the switch, just below the `dashboard` case:

```typescript
    case 'schema':          return schema(process.argv.slice(3));
```

- [ ] **Step 2.5: Run the test to confirm it passes**

Run: `pnpm --filter predicate-cli test schema`
Expected: all three describe blocks PASS.

- [ ] **Step 2.6: Run the existing CLI test suite to confirm no regression**

Run: `pnpm --filter predicate-cli test`
Expected: every existing test still PASS.

- [ ] **Step 2.7: Commit**

```bash
git add packages/predicate-cli/src/commands/schema.ts \
        packages/predicate-cli/src/index.ts \
        packages/predicate-cli/tests/schema.test.ts
git commit -m "feat(cli): predicate schema list|approve|reject

Three subcommands that expose the kg:tbox-staging queue to scripts
and the dashboard. approve/reject reuse PromotionSweeper's existing
validation + git-tracked Turtle commit + kg:meta event pipeline,
tagged with actor='user-approve' or 'user-reject'."
```

---

## Task 3: `/api/action` endpoint on the dashboard server

Server-side handler for Approve/Reject button clicks. Validates verb + IRI, spawns the CLI with no shell, captures stdout/stderr.

**Files:**
- Modify: `packages/predicate-cli/src/commands/dashboard.ts`
- Test: `packages/predicate-cli/tests/dashboard-action.test.ts`

- [ ] **Step 3.1: Write failing tests for `/api/action`**

Create `packages/predicate-cli/tests/dashboard-action.test.ts`:

```typescript
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { startDashboardServer, type DashboardServerHandle } from '../src/commands/dashboard.js';
import { withCodebaseTBox } from 'predicate-mcp/tests/fixtures/with-codebase.js';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { SchemaProposer } from 'predicate-agent/src/schema-proposer.js';

let handle: DashboardServerHandle | undefined;

beforeAll(async () => { await withCodebaseTBox(); });
afterEach(async () => { if (handle) { await handle.close(); handle = undefined; } });

async function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/action', () => {
  it('rejects unknown verbs with 400', async () => {
    handle = await startDashboardServer(0);
    const r = await post(handle.url + '/api/action', { verb: 'evil', proposalId: 'urn:predicate:proposal:x' });
    expect(r.status).toBe(400);
  });

  it('rejects shell-metacharacter IRIs with 400', async () => {
    handle = await startDashboardServer(0);
    const r = await post(handle.url + '/api/action', {
      verb: 'reject',
      proposalId: 'urn:predicate:proposal:`rm -rf /`',
    });
    expect(r.status).toBe(400);
  });

  it('approves a real proposal end-to-end', async () => {
    const client = new SparqlClient(loadConfig());
    await client.update('DROP SILENT GRAPH <kg:tbox-staging>');
    await client.update('CREATE SILENT GRAPH <kg:tbox-staging>');
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: 'https://industriagents.com/predicate/codebase#httpApproveTest',
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'http-test' });

    handle = await startDashboardServer(0);
    const r = await post(handle.url + '/api/action', { verb: 'approve', proposalId: id });
    expect(r.status).toBe(200);
    const json = await r.json() as { ok: boolean; exitCode: number; stdout: string };
    expect(json.ok).toBe(true);
    expect(json.exitCode).toBe(0);
    const parsedCliOutput = JSON.parse(json.stdout) as { outcome: string };
    expect(parsedCliOutput.outcome).toBe('promoted');
  });
});
```

- [ ] **Step 3.2: Run the test to confirm it fails**

Run: `pnpm --filter predicate-cli test dashboard-action`
Expected: FAIL — every `/api/action` request currently returns 404.

- [ ] **Step 3.3: Add `/api/action` handler in `dashboard.ts`**

In `packages/predicate-cli/src/commands/dashboard.ts`:

a) Add at the top, after the existing `import { spawn } ...` line, replace the import with the typed version:

```typescript
import { spawn } from 'node:child_process';
```

(if it's already there, leave it.)

b) Add this constant near the top of the file, just after `findDashboardHtml`:

```typescript
const PROPOSAL_IRI = /^[A-Za-z][A-Za-z0-9+.\-]*:[A-Za-z0-9:_./#\-]+$/;
const ALLOWED_VERBS = new Set(['approve', 'reject']);
```

c) Add this function below `proxyQuery`:

```typescript
async function runAction(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body = '';
  await new Promise<void>((resolve, reject) => {
    req.on('data', (c) => { body += String(c); if (body.length > 4096) req.destroy(); });
    req.on('end', () => resolve());
    req.on('error', reject);
  });
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
  const child = spawn('predicate', ['schema', verb, id], {
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
```

d) In the `createServer` callback, before the existing 404 fallthrough, add:

```typescript
    if (req.url === '/api/action' && req.method === 'POST') {
      void runAction(req, res);
      return;
    }
```

- [ ] **Step 3.4: Run the test to confirm it passes**

Run: `pnpm --filter predicate-cli test dashboard-action`
Expected: all three tests PASS.

- [ ] **Step 3.5: Commit**

```bash
git add packages/predicate-cli/src/commands/dashboard.ts \
        packages/predicate-cli/tests/dashboard-action.test.ts
git commit -m "feat(dashboard): /api/action endpoint for approve/reject

POST {verb, proposalId} → spawns 'predicate schema verb id' as a
child process with shell:false. Verb is whitelisted, IRI matches
a strict regex, body is capped at 4KB. Returns JSON
{ok, exitCode, stdout, stderr}."
```

---

## Task 4: `/api/events` SSE endpoint with 1Hz digest poller

The server runs a single internal poller that hits Fuseki once per second for a digest (counts + max-timestamps for the relevant graphs). On any digest change it broadcasts `event: change\ndata: {"changed":[...]}` to all open SSE clients. The poller is started on first SSE connection and stopped when the last client disconnects.

**Files:**
- Modify: `packages/predicate-cli/src/commands/dashboard.ts`
- Test: `packages/predicate-cli/tests/dashboard-events.test.ts`

- [ ] **Step 4.1: Write failing test for the SSE endpoint**

Create `packages/predicate-cli/tests/dashboard-events.test.ts`:

```typescript
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { startDashboardServer, type DashboardServerHandle } from '../src/commands/dashboard.js';
import { withCodebaseTBox } from 'predicate-mcp/tests/fixtures/with-codebase.js';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { SchemaProposer } from 'predicate-agent/src/schema-proposer.js';

let handle: DashboardServerHandle | undefined;

beforeAll(async () => { await withCodebaseTBox(); });
afterEach(async () => { if (handle) { await handle.close(); handle = undefined; } });

async function readSseUntil(url: string, predicate: (evt: { event: string; data: string }) => boolean, timeoutMs = 5000): Promise<{ event: string; data: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const r = await fetch(url, { signal: ctrl.signal });
  const reader = r.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const ev = { event: 'message', data: '' };
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) ev.event = line.slice(6).trim();
          else if (line.startsWith('data:')) ev.data = line.slice(5).trim();
        }
        if (ev.data && predicate(ev)) {
          ctrl.abort();
          clearTimeout(t);
          return ev;
        }
      }
    }
  } finally {
    clearTimeout(t);
  }
  throw new Error('SSE stream ended without matching event');
}

describe('GET /api/events', () => {
  it('emits an initial digest event on connect', async () => {
    handle = await startDashboardServer(0);
    const ev = await readSseUntil(handle.url + '/api/events', (e) => e.event === 'digest');
    expect(ev.event).toBe('digest');
    const data = JSON.parse(ev.data) as { sessions: number; staging: number; inferred: number };
    expect(typeof data.sessions).toBe('number');
    expect(typeof data.staging).toBe('number');
  });

  it('broadcasts a change event when staging count changes', async () => {
    handle = await startDashboardServer(0);
    // Open SSE, ignore the first digest, then mutate staging.
    const url = handle.url + '/api/events';
    const changePromise = readSseUntil(
      url,
      (e) => e.event === 'change' && JSON.parse(e.data).changed.includes('staging'),
      8000,
    );
    // Give the server a moment to attach the client and snapshot the digest.
    await new Promise((r) => setTimeout(r, 1500));
    const client = new SparqlClient(loadConfig());
    const proposer = new SchemaProposer(client);
    await proposer.propose({
      kind: 'add-property',
      add: [{
        s: 'https://industriagents.com/predicate/codebase#sseTest',
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'sse-test' });
    const ev = await changePromise;
    expect(JSON.parse(ev.data).changed).toContain('staging');
  });
});
```

- [ ] **Step 4.2: Run the test to confirm it fails**

Run: `pnpm --filter predicate-cli test dashboard-events`
Expected: FAIL — `/api/events` returns 404.

- [ ] **Step 4.3: Implement the SSE infrastructure**

In `packages/predicate-cli/src/commands/dashboard.ts`:

a) Add the digest type + state declarations near the top (after the constants from Task 3):

```typescript
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
```

b) Add the digest query helper:

```typescript
async function fetchDigest(fusekiUrl: string, dataset: string): Promise<Digest> {
  const sparql = `
    PREFIX pred: <https://industriagents.com/predicate/meta#>
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
  // Initial digest snapshot.
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
```

c) In `createServer`'s callback, add the route just below the `/api/action` route:

```typescript
    if (req.url === '/api/events' && req.method === 'GET') {
      void handleEvents(req, res, cfg.fusekiUrl, cfg.dataset);
      return;
    }
```

d) Also export the SSE state helpers for the close path of `startDashboardServer`. Modify the existing `close` returned by `startDashboardServer` so it also stops the poller and ends all open SSE clients:

```typescript
    close: () => new Promise<void>((resolve) => {
      for (const c of sseClients) c.end();
      sseClients.clear();
      if (pollerTimer) { clearInterval(pollerTimer); pollerTimer = undefined; lastDigest = undefined; }
      server.close(() => resolve());
    }),
```

- [ ] **Step 4.4: Run the test to confirm it passes**

Run: `pnpm --filter predicate-cli test dashboard-events`
Expected: both tests PASS within ~10s.

- [ ] **Step 4.5: Re-run all dashboard tests to verify no regression**

Run: `pnpm --filter predicate-cli test dashboard`
Expected: original `dashboard.test.ts` + `dashboard-action.test.ts` + `dashboard-events.test.ts` all PASS.

- [ ] **Step 4.6: Commit**

```bash
git add packages/predicate-cli/src/commands/dashboard.ts \
        packages/predicate-cli/tests/dashboard-events.test.ts
git commit -m "feat(dashboard): /api/events SSE with 1Hz digest poller

One internal setInterval fans digest deltas out to all connected
SSE clients. Poller only runs while at least one client is
attached. On Fuseki error the stream emits 'event: error' and
keeps polling. Heartbeat every 25s."
```

---

## Task 5: Browser-side EventSource + polling fallback

The dashboard subscribes once on load. On `change`, it re-runs the affected card queries. If `EventSource` is unavailable or the connection errors, it falls back to the original 30s `setInterval`.

**Files:**
- Modify: `packages/predicate-skill/dashboard/index.html`

- [ ] **Step 5.1: Replace the bottom `load(); setInterval(load, 30000);` lines with the SSE subscriber**

Open `packages/predicate-skill/dashboard/index.html`. Replace:

```javascript
load();
setInterval(load, 30000); // refresh every 30s
```

with:

```javascript
const CARD_RELOADERS = {
  sessions: async () => { await loadSessions(); await loadStats(); },
  staging:  async () => { await loadStats(); /* staging card reload added in Task 6 */ },
  inferred: async () => {
    await loadDerived('file', 'Hotspot',      'modifiedIn', 'hotspots', 'file', 'no hotspots — need ≥3 sessions touching the same file');
    await loadDerived('cmd',  'FlakyCommand', 'failedIn',   'flaky',    'command', 'no flaky commands — need ≥2 sessions with a failed command');
    await loadDerived('file', 'ActiveFile',   'modifiedIn', 'active',   'file', 'no active files — run a session, then `predicate maintain`');
    await loadStats();
  },
};

function setConnState(connected) {
  const sub = document.querySelector('.sub');
  if (!sub) return;
  let badge = document.getElementById('conn-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'conn-badge';
    badge.style.marginLeft = '8px';
    badge.style.fontSize = '11px';
    badge.style.padding = '2px 6px';
    badge.style.borderRadius = '4px';
    sub.appendChild(badge);
  }
  badge.textContent = connected ? '● live' : '○ disconnected';
  badge.style.background = connected ? '#0f3a30' : '#3a1212';
  badge.style.color = connected ? '#2dd4bf' : '#f5c2c7';
}

function startLive() {
  if (typeof EventSource === 'undefined') return startPollingFallback();
  let es;
  try { es = new EventSource('/api/events'); } catch { return startPollingFallback(); }
  let opened = false;
  es.addEventListener('digest', () => { opened = true; setConnState(true); });
  es.addEventListener('change', (ev) => {
    setConnState(true);
    let payload;
    try { payload = JSON.parse(ev.data); } catch { return; }
    const changed = payload.changed || [];
    const keys = new Set();
    for (const k of changed) {
      if (k === 'sessions' || k === 'sessionsMaxAt') keys.add('sessions');
      else if (k === 'staging') keys.add('staging');
      else if (k === 'inferred') keys.add('inferred');
    }
    for (const k of keys) { CARD_RELOADERS[k]?.(); }
  });
  es.addEventListener('error', () => {
    setConnState(false);
    if (!opened) { es.close(); startPollingFallback(); }
  });
}

function startPollingFallback() {
  setConnState(false);
  setInterval(load, 30000);
}

load();
startLive();
```

- [ ] **Step 5.2: Manual sanity check (no Vitest coverage here — pure browser glue)**

Start the dashboard against a live Fuseki, then propose a fake schema element using the agent fixture in a separate process, and confirm the staging count updates without a hard refresh. If you don't have a quick way to do this, defer manual verification to Task 7's end-to-end check.

Run: `cd /Users/mx/Documents/Work/MX/Research/predicate && node packages/predicate-cli/dist/src/index.js dashboard --no-open --port 4040`
Open `http://127.0.0.1:4040` in a browser. Verify the live badge appears.

- [ ] **Step 5.3: Commit**

```bash
git add packages/predicate-skill/dashboard/index.html
git commit -m "feat(dashboard): EventSource client with polling fallback

Subscribes once to /api/events, re-runs only the affected card
queries on 'change'. Shows a live/disconnected badge. Falls back
to the original 30s setInterval if EventSource is unavailable or
the connection drops before the first digest arrives."
```

---

## Task 6: Schema-staging card UI

A new card in the browser grid showing pending proposals, with Approve/Reject buttons that POST to `/api/action`.

**Files:**
- Modify: `packages/predicate-skill/dashboard/index.html`

- [ ] **Step 6.1: Add the card HTML**

In `packages/predicate-skill/dashboard/index.html`, locate the `<div class="grid">` block and insert the staging card immediately after the Stats card:

```html
  <div class="card"><h2>Schema Staging <span class="sub" id="staging-sub"></span></h2><div id="staging"></div></div>
```

- [ ] **Step 6.2: Add the card-specific CSS**

Inside the `<style>` block, append:

```css
    .stage-row { display:grid; grid-template-columns: 80px 1fr 90px 90px 140px; gap:8px; align-items:center; padding:6px 0; border-bottom:1px solid #2a2a2e; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
    .stage-row:last-child { border-bottom:none; }
    .stage-just { color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .stage-kind { color:var(--accent); font-size:11px; text-transform:uppercase; letter-spacing:.05em; }
    .stage-actions { display:flex; gap:6px; justify-content:flex-end; }
    .stage-actions button { background:var(--row); color:var(--fg); border:1px solid #2a2a2e; padding:4px 10px; border-radius:4px; cursor:pointer; font:inherit; }
    .stage-actions button.ok    { border-color: var(--accent); color: var(--accent); }
    .stage-actions button.bad   { border-color: var(--bad);    color: var(--bad); }
    .stage-actions button.confirm { background:var(--accent); color:#000; }
    .stage-actions button.confirm.bad { background:var(--bad); color:#fff; }
    .stage-actions button:disabled { opacity:.5; cursor:wait; }
    .stage-err { color:var(--bad); font-size:11px; margin-top:4px; }
```

- [ ] **Step 6.3: Add the loader + action handler JS**

In the `<script>` block, add these functions just below `loadDerived`:

```javascript
function ttlString(expiresAtIso) {
  const ms = new Date(expiresAtIso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

async function loadStaging() {
  const threshold = await ask(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    SELECT ?n WHERE { GRAPH <kg:meta> { <urn:predicate:config> pred:promotionUseThreshold ?n } }
  `).then(b => b[0] ? parseInt(b[0].n.value, 10) : 3).catch(() => 3);

  const q = `
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    SELECT ?id ?kind ?justification ?expiresAt ?useCount
    WHERE {
      GRAPH <kg:tbox-staging> {
        ?id a pred:Proposal ;
            pred:kind          ?kind ;
            pred:justification ?justification ;
            pred:expiresAt     ?expiresAt ;
            pred:useCount      ?useCount .
      }
    }
    ORDER BY ?expiresAt
    LIMIT 50
  `;
  const rows = await ask(q);
  const el = document.getElementById('staging');
  const sub = document.getElementById('staging-sub');
  if (!rows.length) {
    sub.textContent = '';
    el.innerHTML = '<div class="empty">no pending proposals</div>';
    return;
  }
  const expiringSoon = rows.filter(r => {
    const ms = new Date(r.expiresAt.value).getTime() - Date.now();
    return ms > 0 && ms < 86_400_000;
  }).length;
  sub.textContent = `${rows.length} pending · ${expiringSoon} expiring < 24h`;
  el.innerHTML = rows.map(b => {
    const id = b.id.value;
    const safeId = id.replace(/"/g, '&quot;');
    return `
      <div class="stage-row" data-id="${safeId}">
        <span class="stage-kind">${b.kind.value}</span>
        <span class="stage-just" title="${b.justification.value.replace(/"/g,'&quot;')}">${trim(b.justification.value, 80)}</span>
        <span>${b.useCount.value}/${threshold}</span>
        <span>${ttlString(b.expiresAt.value)}</span>
        <span class="stage-actions">
          <button class="ok"  data-verb="approve">Approve</button>
          <button class="bad" data-verb="reject">Reject</button>
        </span>
      </div>
    `;
  }).join('');
  el.querySelectorAll('.stage-row').forEach(row => {
    row.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => handleStageAction(row, btn));
    });
  });
}

const PENDING_CONFIRM = new WeakMap();
async function handleStageAction(row, btn) {
  const verb = btn.dataset.verb;
  const id = row.dataset.id;
  if (!PENDING_CONFIRM.get(btn)) {
    btn.classList.add('confirm');
    btn.textContent = 'Confirm?';
    PENDING_CONFIRM.set(btn, true);
    setTimeout(() => {
      if (PENDING_CONFIRM.get(btn)) {
        btn.classList.remove('confirm');
        btn.textContent = verb === 'approve' ? 'Approve' : 'Reject';
        PENDING_CONFIRM.delete(btn);
      }
    }, 3000);
    return;
  }
  PENDING_CONFIRM.delete(btn);
  row.querySelectorAll('button').forEach(b => b.disabled = true);
  btn.textContent = '...';
  try {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verb, proposalId: id }),
    });
    const json = await r.json();
    if (json.ok) {
      row.remove();
    } else {
      const err = document.createElement('div');
      err.className = 'stage-err';
      err.textContent = `${verb} failed: ` + (json.stderr || json.error || `exit ${json.exitCode}`).slice(0, 200);
      row.appendChild(err);
      row.querySelectorAll('button').forEach(b => { b.disabled = false; });
      btn.textContent = verb === 'approve' ? 'Approve' : 'Reject';
      btn.classList.remove('confirm');
    }
  } catch (e) {
    row.querySelectorAll('button').forEach(b => { b.disabled = false; });
    btn.textContent = verb === 'approve' ? 'Approve' : 'Reject';
    btn.classList.remove('confirm');
  }
}
```

- [ ] **Step 6.4: Wire staging into the load cycle**

In `index.html`, in the `load()` function, add `await loadStaging();` after `await loadStats();`:

```javascript
async function load() {
  try {
    await loadStats();
    await loadStaging();
    await loadSessions();
    /* ... existing loadDerived calls ... */
  }
  /* ... */
}
```

Then update the SSE handler from Task 5: replace the `staging` reloader stub with the real call. Find this block from Task 5:

```javascript
  staging:  async () => { await loadStats(); /* staging card reload added in Task 6 */ },
```

and replace with:

```javascript
  staging:  async () => { await loadStaging(); await loadStats(); },
```

- [ ] **Step 6.5: Manual verification**

Run the dashboard, propose a fake schema item, and verify the row appears, an Approve click followed by Confirm? click removes it, and a Reject click followed by Confirm? click removes it. If validation rejects an Approve, verify the stderr appears inline.

`pnpm --filter predicate-cli build && node packages/predicate-cli/dist/src/index.js dashboard --no-open`

- [ ] **Step 6.6: Commit**

```bash
git add packages/predicate-skill/dashboard/index.html
git commit -m "feat(dashboard): schema staging card with approve/reject

Lists pending kg:tbox-staging proposals with kind, justification,
use-count/threshold, TTL. Approve/Reject buttons use a two-click
confirm pattern (3s revert window) and POST to /api/action.
Inline error display on validation failure."
```

---

## Task 7: Drill-down side panel for sessions/files/commands

The biggest UX win: every row in Recent Sessions / Hotspots / Flaky Commands / Active Files becomes click-to-drill. A right-side panel shows kind-specific detail. URL hash routing for bookmarkability.

**Files:**
- Modify: `packages/predicate-skill/dashboard/index.html`

- [ ] **Step 7.1: Add the panel HTML**

After the closing `</div>` of `<div class="grid">`, before the `<script>` tag, add:

```html
<div id="panel" class="panel" aria-hidden="true">
  <div class="panel-head">
    <span class="panel-kind" id="panel-kind"></span>
    <span class="panel-title" id="panel-title"></span>
    <button class="panel-close" id="panel-close" aria-label="Close">×</button>
  </div>
  <div class="panel-body" id="panel-body"></div>
</div>
<div id="panel-scrim" class="panel-scrim" aria-hidden="true"></div>
```

- [ ] **Step 7.2: Add the panel CSS**

Append to the `<style>` block:

```css
    .panel { position:fixed; top:0; right:0; bottom:0; width:40vw; min-width:480px; max-width:720px; background:#141417; border-left:1px solid #2a2a2e; padding:20px 24px; overflow-y:auto; transform:translateX(100%); transition:transform 200ms ease; z-index:10; }
    .panel.open { transform:translateX(0); }
    .panel-head { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
    .panel-kind { background:#2a2a2e; color:var(--accent); padding:2px 8px; border-radius:4px; font-size:11px; text-transform:uppercase; letter-spacing:.05em; }
    .panel-title { flex:1; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; word-break:break-all; }
    .panel-close { background:none; border:none; color:var(--fg); font-size:22px; cursor:pointer; padding:0 6px; }
    .panel-section { margin-bottom:20px; }
    .panel-section h3 { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; margin:0 0 6px; }
    .panel-section .empty { font-size:12px; }
    .panel-section table { font-size:12px; }
    .panel-scrim { position:fixed; inset:0; background:rgba(0,0,0,.4); opacity:0; pointer-events:none; transition:opacity 200ms ease; z-index:9; }
    .panel-scrim.open { opacity:1; pointer-events:auto; }
    tr.row-button { cursor:pointer; }
    tr.row-button:hover td { background:#22222a; }
```

- [ ] **Step 7.3: Make existing card rows clickable**

In `index.html`, modify `loadSessions`. Change the `rows.map` so each row carries `data-kind` and `data-id`:

```javascript
  const rows = (await ask(q)).map(b => ({
    kind: 'session',
    id: b.sid.value,
    cells: [
      trim(b.sid.value, 32),
      b.at.value.slice(0, 19).replace('T', ' '),
      b.nFiles.value,
      b.nOk.value,
      `<span class="${parseInt(b.nBad.value) > 0 ? 'bad' : ''}">${b.nBad.value}</span>`,
    ],
  }));
  document.getElementById('sessions').innerHTML = clickableTable(['session', 'at', 'files', 'ok', 'fail'], rows, { numCols: [2, 3, 4], empty: 'no sessions extracted yet' });
```

And in `loadDerived`, similarly:

```javascript
  const rows = bindings.map(b => {
    const v = b[varName].value;
    const display = klass === 'FlakyCommand' ? trim(v, 80) : shortFile(v);
    return { kind: klass === 'FlakyCommand' ? 'cmd' : 'file', id: v, cells: [display, b.n.value] };
  });
  document.getElementById(divId).innerHTML = clickableTable([label, 'n'], rows, { numCols: [1], empty });
```

Add a new helper `clickableTable` next to `tbl`:

```javascript
function clickableTable(headers, rows, opts = {}) {
  if (!rows.length) return '<div class="empty">' + (opts.empty || 'no data') + '</div>';
  return '<table><thead><tr>'
       + headers.map(h => '<th>' + h + '</th>').join('')
       + '</tr></thead><tbody>'
       + rows.map(r => `<tr class="row-button" tabindex="0" data-kind="${r.kind}" data-id="${r.id.replace(/"/g,'&quot;')}">`
           + r.cells.map((c, i) => '<td' + (opts.numCols && opts.numCols.includes(i) ? ' class="num"' : '') + '>' + c + '</td>').join('')
           + '</tr>').join('')
       + '</tbody></table>';
}
```

And attach click + keyboard handlers once on first load. Add this just before `load();` at the bottom:

```javascript
document.body.addEventListener('click', (e) => {
  const tr = e.target.closest('tr.row-button');
  if (!tr) return;
  openPanel(tr.dataset.kind, tr.dataset.id);
});
document.body.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const tr = e.target.closest('tr.row-button');
    if (tr) { e.preventDefault(); openPanel(tr.dataset.kind, tr.dataset.id); }
  }
  if (e.key === 'Escape') closePanel();
});
document.getElementById('panel-close').addEventListener('click', closePanel);
document.getElementById('panel-scrim').addEventListener('click', closePanel);
window.addEventListener('hashchange', loadFromHash);
```

- [ ] **Step 7.4: Implement panel open/close + per-kind loaders**

Append to the `<script>` block:

```javascript
function openPanel(kind, id) {
  const panel = document.getElementById('panel');
  const scrim = document.getElementById('panel-scrim');
  panel.classList.add('open');
  scrim.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  scrim.setAttribute('aria-hidden', 'false');
  document.getElementById('panel-kind').textContent = kind;
  document.getElementById('panel-title').textContent = id;
  document.getElementById('panel-body').innerHTML = '<div class="panel-section"><div class="empty">loading…</div></div>';
  location.hash = `#/${kind}/${encodeURIComponent(id)}`;
  if (kind === 'session') loadSessionPanel(id);
  else if (kind === 'file') loadFilePanel(id);
  else if (kind === 'cmd')  loadCommandPanel(id);
}

function closePanel() {
  const panel = document.getElementById('panel');
  const scrim = document.getElementById('panel-scrim');
  panel.classList.remove('open');
  scrim.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  scrim.setAttribute('aria-hidden', 'true');
  if (location.hash.startsWith('#/')) history.replaceState(null, '', location.pathname);
}

function loadFromHash() {
  const m = location.hash.match(/^#\/(session|file|cmd)\/(.+)$/);
  if (!m) { closePanel(); return; }
  openPanel(m[1], decodeURIComponent(m[2]));
}

async function loadSessionPanel(sid) {
  const filesQ = `
    PREFIX cb: <https://industriagents.com/predicate/codebase#>
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    SELECT ?file WHERE {
      GRAPH <kg:abox> { ?s a pred:Session ; pred:sessionId "${sid.replace(/"/g,'\\"')}" . ?file cb:modifiedIn ?s }
    } LIMIT 100
  `;
  const cmdsQ = `
    PREFIX cb: <https://industriagents.com/predicate/codebase#>
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    SELECT ?cmd ?text ?status WHERE {
      GRAPH <kg:abox> {
        ?s a pred:Session ; pred:sessionId "${sid.replace(/"/g,'\\"')}" .
        ?cmd a cb:Command ; cb:commandText ?text .
        { ?cmd cb:succeededIn ?s . BIND("ok" AS ?status) }
        UNION { ?cmd cb:failedIn ?s . BIND("fail" AS ?status) }
      }
    } LIMIT 100
  `;
  const [files, cmds] = await Promise.all([ask(filesQ).catch(() => []), ask(cmdsQ).catch(() => [])]);
  const filesRows = files.map(b => ({ kind: 'file', id: b.file.value, cells: [shortFile(b.file.value)] }));
  const cmdsRows  = cmds.map(b => ({
    kind: 'cmd', id: b.cmd.value,
    cells: [
      trim(b.text.value, 80),
      `<span class="${b.status.value === 'fail' ? 'bad' : ''}">${b.status.value}</span>`,
    ],
  }));
  document.getElementById('panel-body').innerHTML = `
    <div class="panel-section">
      <h3>Files modified (${filesRows.length})</h3>
      ${clickableTable(['file'], filesRows, { empty: 'none' })}
    </div>
    <div class="panel-section">
      <h3>Commands (${cmdsRows.length})</h3>
      ${clickableTable(['command', 'status'], cmdsRows, { empty: 'none' })}
    </div>
  `;
}

async function loadFilePanel(fileIri) {
  const q = `
    PREFIX cb: <https://industriagents.com/predicate/codebase#>
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    SELECT ?sid ?at WHERE {
      GRAPH <kg:abox> {
        <${fileIri}> cb:modifiedIn ?s .
        ?s pred:sessionId ?sid ; pred:at ?at .
      }
    } ORDER BY DESC(?at) LIMIT 50
  `;
  const klassQ = `
    PREFIX cb: <https://industriagents.com/predicate/codebase#>
    SELECT ?k WHERE { GRAPH <kg:inferred> { <${fileIri}> a ?k FILTER (?k IN (cb:Hotspot, cb:ActiveFile)) } }
  `;
  const [sessions, klasses] = await Promise.all([ask(q).catch(() => []), ask(klassQ).catch(() => [])]);
  const badges = klasses.map(b => `<span class="stage-kind">${b.k.value.split('#').pop()}</span>`).join(' ');
  const rows = sessions.map(b => ({
    kind: 'session', id: b.sid.value,
    cells: [trim(b.sid.value, 32), b.at.value.slice(0, 19).replace('T', ' ')],
  }));
  document.getElementById('panel-body').innerHTML = `
    <div class="panel-section">${badges || ''}</div>
    <div class="panel-section">
      <h3>Modified in (${rows.length} sessions)</h3>
      ${clickableTable(['session', 'at'], rows, { empty: 'none' })}
    </div>
  `;
}

async function loadCommandPanel(cmdIri) {
  const okQ = `
    PREFIX cb: <https://industriagents.com/predicate/codebase#>
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    SELECT ?sid ?at WHERE {
      GRAPH <kg:abox> {
        <${cmdIri}> cb:succeededIn ?s . ?s pred:sessionId ?sid ; pred:at ?at .
      }
    } ORDER BY DESC(?at) LIMIT 30
  `;
  const badQ = `
    PREFIX cb: <https://industriagents.com/predicate/codebase#>
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    SELECT ?sid ?at WHERE {
      GRAPH <kg:abox> {
        <${cmdIri}> cb:failedIn ?s . ?s pred:sessionId ?sid ; pred:at ?at .
      }
    } ORDER BY DESC(?at) LIMIT 30
  `;
  const flakyQ = `
    PREFIX cb: <https://industriagents.com/predicate/codebase#>
    ASK { GRAPH <kg:inferred> { <${cmdIri}> a cb:FlakyCommand } }
  `;
  const [oks, bads, flakyResp] = await Promise.all([
    ask(okQ).catch(() => []),
    ask(badQ).catch(() => []),
    fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'query=' + encodeURIComponent(flakyQ),
    }).then(r => r.json()).then(j => j.boolean === true).catch(() => false),
  ]);
  const okRows = oks.map(b => ({ kind: 'session', id: b.sid.value, cells: [trim(b.sid.value, 32), b.at.value.slice(0, 19).replace('T', ' ')] }));
  const badRows = bads.map(b => ({ kind: 'session', id: b.sid.value, cells: [trim(b.sid.value, 32), b.at.value.slice(0, 19).replace('T', ' ')] }));
  document.getElementById('panel-body').innerHTML = `
    <div class="panel-section">${flakyResp ? '<span class="stage-kind">FlakyCommand</span>' : ''}</div>
    <div class="panel-section">
      <h3>Succeeded in (${okRows.length})</h3>
      ${clickableTable(['session', 'at'], okRows, { empty: 'none' })}
    </div>
    <div class="panel-section">
      <h3>Failed in (${badRows.length})</h3>
      ${clickableTable(['session', 'at'], badRows, { empty: 'none' })}
    </div>
  `;
}
```

- [ ] **Step 7.5: Open panel from hash on initial load**

In the `load()` body, after the existing queries finish, append:

```javascript
    loadFromHash();
```

- [ ] **Step 7.6: Manual verification**

Build and run:

```bash
pnpm --filter predicate-cli build
node packages/predicate-cli/dist/src/index.js dashboard --no-open --port 4040
```

Open `http://127.0.0.1:4040`. Verify:
1. Click a session row → panel slides in, shows files + commands.
2. Click a file row inside the session panel → panel swaps to file view.
3. Esc closes the panel; URL hash clears.
4. Reload with `#/session/<id>` in the URL → panel auto-opens.
5. Click outside (scrim) closes the panel.

- [ ] **Step 7.7: Commit**

```bash
git add packages/predicate-skill/dashboard/index.html
git commit -m "feat(dashboard): drill-down side panel for sessions/files/commands

Every row in the four entity cards becomes clickable. A right-side
panel shows kind-specific detail (files+commands for a session,
sessions for a file, ok/fail sessions for a command), with badges
for Hotspot/ActiveFile/FlakyCommand classifications. URL-hash
routable; Esc and scrim-click close."
```

---

## Task 8: Full-suite verification

A single end-to-end pass that exercises everything together.

- [ ] **Step 8.1: Run the entire affected test surface**

```bash
pnpm --filter predicate-agent test
pnpm --filter predicate-cli test
```

Expected: all green. If anything fails, fix and re-run before continuing.

- [ ] **Step 8.2: Lint + typecheck**

```bash
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-cli typecheck
pnpm --filter predicate-cli lint
```

Expected: zero errors, zero warnings.

- [ ] **Step 8.3: Manual smoke test against a live Fuseki**

1. `predicate up` (or confirm a Fuseki is already running).
2. Build and start the dashboard: `pnpm --filter predicate-cli build && node packages/predicate-cli/dist/src/index.js dashboard --port 4040`.
3. Open `http://127.0.0.1:4040`. Confirm: live badge appears within 2s.
4. Trigger something that creates a session (run any Predicate-hooked command in a separate terminal). Confirm the new row appears within ~2s without manual refresh.
5. Click the new session row. Confirm the panel opens with files + commands.
6. Use the agent or MCP path to create a fake schema proposal. Confirm a row appears in the staging card within ~2s. Click Approve → Confirm? → row disappears.
7. Stop Fuseki. Confirm the live badge switches to "disconnected" within ~3s. Restart Fuseki; confirm the badge returns to live on the next change.

- [ ] **Step 8.4: Final commit (only if any fixes were applied during 8.1–8.3)**

If 8.1, 8.2, or 8.3 surfaced fixes, commit them as a single follow-up:

```bash
git add -A
git commit -m "chore(dashboard): post-integration fixes from full-suite verification"
```

Otherwise skip this step.

---

## Self-Review Notes

- **Spec coverage:** Spec sections A (drill-down), B (staging), C (SSE) → Tasks 7, 2+3+6, 4+5 respectively. Sub-elements covered: URL hash routing (7.4), validation parity (1.5), proposal-IRI regex (3.3), heartbeat (4.3), fallback polling (5.1), inline error display (6.3), `actor` event tagging (1.3, 2.3).
- **No placeholders:** every code block is complete; the one "stub" in Task 5 step 5.1 is immediately replaced in Task 6 step 6.4, which is explicit.
- **Type consistency:** `Digest`, `PromotionDecision`, `ProposalRow`, `actor`/`reason` option names match across Tasks 1, 2, 3, 4. The `/api/action` response shape `{ok, exitCode, stdout, stderr}` in Task 3.3 matches what the browser parses in Task 6.3.
- **Independence:** Tasks 1, 2, 3, 4, 5/6/7 can each be committed and shipped. If anything past Task 4 is reverted, the previously-shipped layers keep working.
