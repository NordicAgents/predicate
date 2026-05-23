# Dashboard UX — drill-down, schema-staging queue, live updates

Date: 2026-05-19
Status: draft (pending user approval)
Scope: `packages/predicate-skill/dashboard/index.html` and the dashboard server in `packages/predicate-cli/src/commands/dashboard.ts`.

## Problem

The dashboard today is a 5-card status page (Stats, Recent Sessions, Hotspots, Flaky Commands, Active Files). It is read-only, polls every 30s, and surfaces ~5% of what Predicate actually stores. Three concrete gaps drive this spec:

1. Rows have no detail view. Clicking a session, file, or command does nothing. The user cannot see *what happened* in a session, only that one occurred.
2. The schema-staging loop — the safety story for the whole product — has no UI. Pending proposals in `kg:tbox-staging` are reviewable only by hand-rolling SPARQL.
3. Updates arrive on a 30s poll. After a Stop-hook fires, the user has to wait up to 30s to see the new session, and the dashboard burns a query cycle every 30s whether anything changed or not.

This spec covers exactly those three things. It does not cover graph visualization, a SPARQL playground, goals view, provenance peek, or any other Tier 2/3/4 item from the brainstorm. Those are deferred to follow-up specs.

## Non-goals

- Graph rendering (Cytoscape/D3) — deferred.
- SPARQL editor / playground — deferred.
- Authentication or multi-user concerns — dashboard remains localhost-only, single user.
- Mobile responsiveness beyond what the existing CSS grid gives us — desktop browser only.
- Changes to the Stop hook, extractor, or `predicate maintain` pipeline. The dashboard reads from Fuseki and triggers actions through existing CLI primitives.

## Approach summary

Three additions, each independently shippable:

- **A. Drill-down side panel.** Click any row in Recent Sessions / Hotspots / Flaky Commands / Active Files. A right-side panel slides in showing entity detail (files touched, commands run with stderr snippets, neighboring sessions, etc.) plus a Close button. URL hash updates so the view is bookmarkable.
- **B. Schema-staging queue card.** A new top-level card listing pending proposals in `kg:tbox-staging` with kind, justification, motivating goal, use-count vs. threshold, TTL remaining, and **Approve / Reject** buttons. Approve and Reject call two new CLI subcommands (`predicate schema approve <id>` and `predicate schema reject <id>`) via a new `/api/action` server endpoint. The CLI subcommands reuse `PromotionSweeper.promote()` / `rejectExpired()` so validation, git-tracked Turtle commits, and `kg:meta` event emission are unchanged.
- **C. Server-Sent Events for live updates.** Replace the browser-side 30s `setInterval` with a `/api/events` SSE endpoint. The dashboard server polls Fuseki once per second for a small **change digest** (count + max-timestamp per relevant graph) and emits an event only when the digest changes. The browser re-runs whichever queries are affected. No changes to the Stop hook are required.

## Architecture

```
┌────────────────────────────────────┐
│ browser: index.html (single page)  │
│  - cards + side panel              │
│  - EventSource('/api/events')      │
│  - POST /api/query  (SPARQL)       │
│  - POST /api/action (approve/reject)│
└────────────┬───────────────────────┘
             │ HTTP, localhost only
┌────────────▼───────────────────────┐
│ dashboard server (Node, in CLI)    │
│  - GET  /            → static HTML │
│  - POST /api/query   → Fuseki proxy│
│  - POST /api/action  → spawn CLI   │
│  - GET  /api/events  → SSE         │
│      • polls Fuseki @ 1Hz          │
│      • emits on digest change      │
└────────────┬───────────────────────┘
             │ SPARQL HTTP
        ┌────▼─────┐    ┌────────────┐
        │ Fuseki   │◄───┤ predicate  │
        │  /pred   │    │ CLI procs  │
        │          │    │ (approve / │
        │          │    │  reject)   │
        └──────────┘    └────────────┘
```

Component boundaries:

| Component | Responsibility | Inputs | Outputs |
|---|---|---|---|
| `dashboard/index.html` | All UI, no business logic | SPARQL JSON, SSE events | DOM, action POSTs |
| `dashboard.ts` server | Three small endpoints, SSE polling, child-process supervision | HTTP | SPARQL proxy, SSE stream, action results |
| `commands/schema.ts` (new) | Approve/reject CLI verbs that wrap `PromotionSweeper` | proposal id | exit code + JSON to stdout |
| `PromotionSweeper` (existing) | Validation, Turtle write, kg:meta event | proposal id | unchanged |

This keeps the dashboard a thin client: every state-changing path goes through the same CLI/agent code that runs from `predicate maintain`, so the dashboard cannot drift from the canonical promotion semantics.

## Detail: A. Drill-down side panel

### UI

- A fixed-position right panel (40% viewport width, min 480px, max 720px), hidden by default.
- Each row in the four entity cards becomes `<tr role="button" tabindex="0">`. Click or Enter opens the panel for that row's entity.
- Panel header: entity kind + IRI (shortened) + close button (`×`, Esc also closes).
- Panel body: kind-specific sections (see below).
- URL hash is set to `#/<kind>/<id>` on open and cleared on close. On page load, the hash is parsed and the panel opens automatically — this enables deep-links from the Stop hook (future) and bookmarking.

### Panel content by kind

**Session (`#/session/<sid>`)**

- Header: session id, start time, end time (if recorded).
- "Files modified" table: `?file cb:modifiedIn :sid`. Each file is itself a row-button that swaps the panel to the file view.
- "Commands" table: `?cmd cb:succeededIn :sid` ∪ `?cmd cb:failedIn :sid`, with command text, exit status badge (ok/fail).
- "Entailments produced" count: `COUNT(*) WHERE { GRAPH <kg:inferred> { ?s ?p ?o } FILTER EXISTS { GRAPH <kg:meta> { ?ev pred:goal ?something ; pred:at ?at . FILTER (?at >= :sessionStart && ?at <= :sessionEnd) } } }`. Best-effort; if the inferred graph isn't time-stamped, omit the section.

**File (`#/file/<path>`)**

- Header: short file path.
- "Modified in" table: every session that has `cb:modifiedIn` for this file, newest first. Click to jump to session view.
- Classification badges: subclass-of (Hotspot? ActiveFile?) from `kg:inferred`.

**Command (`#/cmd/<id>`)**

- Header: command text (truncated).
- Success/fail counts.
- "Failed in" / "Succeeded in" session lists.
- FlakyCommand badge if applicable.

### SPARQL queries

All queries are issued from the browser via `/api/query`. They are added to `index.html` as `loadSessionDetail(sid)`, `loadFileDetail(path)`, `loadCommandDetail(id)`. Each function returns the section HTML; the panel renders sections sequentially with a per-section loading state.

### Failure handling

If a query fails, the section shows a one-line error and the rest of the panel still renders. No global error banner from a panel-local failure.

## Detail: B. Schema-staging queue card

### UI

- New card in the main grid, positioned after Stats. Title: "Schema staging".
- Subtitle counts: `N pending · M expiring in 24h`.
- Table columns: kind, label/IRI, justification (truncated to 80 chars with hover-full), use-count (`useCount / threshold`), TTL (e.g., "2d 4h"), actions.
- Two actions per row: **Approve** (primary, teal) and **Reject** (danger, red). Both show a confirm-step (button morphs to "Confirm?" on first click; second click within 3s submits). No modal dialogs.
- After action submit: row gets a "working…" spinner, then disappears on success, or shows an inline error on failure.

### SPARQL

```sparql
PREFIX pred: <https://industriagents.com/predicate/meta#>
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
LIMIT 50
```

The threshold for the use-count column comes from `kg:meta`:

```sparql
PREFIX pred: <https://industriagents.com/predicate/meta#>
SELECT ?n WHERE { GRAPH <kg:meta> { <urn:predicate:config> pred:promotionUseThreshold ?n } }
```

Default `3` if not present (matches `PromotionSweeper`).

### Actions

`POST /api/action` with `{ "verb": "approve" | "reject", "proposalId": "<iri>" }`. Server:

1. Validates `verb` and that `proposalId` is a syntactically valid IRI (no shell-injectable characters: `[A-Za-z0-9:/_\-.#]+`).
2. Spawns `predicate schema <verb> <proposalId>` as a child process with no shell.
3. Captures stdout + stderr (cap 64 KB).
4. Returns `{ ok, exitCode, stdout, stderr }` as JSON.

#### New CLI subcommands

`packages/predicate-cli/src/commands/schema.ts`:

- `predicate schema approve <proposalId>` — calls `PromotionSweeper.promote()` directly for that proposal regardless of use-count. Emits a `pred:SchemaPromoted` event with `pred:actor "user-approve"`.
- `predicate schema reject <proposalId>` — calls the same delete/event pipeline as `rejectExpired()` but tags the event payload with `{ reason: 'user-reject' }`.
- `predicate schema list` — JSON form of the staging query above, for testability without the browser.

These verbs are added to the dispatch in `packages/predicate-cli/src/index.ts` and registered in the help banner.

#### Validation parity

User-initiated approve must run the same `validateProposalInIsolation()` step that the sweeper runs. If validation fails, the CLI exits non-zero, prints the reason, and the dashboard shows it in the row's error slot. The proposal stays in staging.

### Failure handling

| Failure | UI behavior |
|---|---|
| Network/server 5xx | Row error: "approve failed: server error" |
| CLI non-zero (validation) | Row error showing first 200 chars of stderr |
| Concurrent approval (proposal already promoted) | Row disappears on next SSE refresh; no error |

## Detail: C. Server-Sent Events live updates

### Wire format

`GET /api/events` returns `text/event-stream`. The server keeps the connection open and emits:

```
event: digest
data: {"sessions":42,"sessionsMaxAt":"2026-05-19T10:23:11Z","staging":7,"inferred":1290,"stats":{...}}

```

A `digest` event carries the current digest. A `change` event carries the diff (which keys changed):

```
event: change
data: {"changed":["sessions","staging"]}
```

The browser subscribes once on load. On `change`, it re-runs only the affected card queries:

| changed key | re-runs |
|---|---|
| `sessions` | loadSessions, loadStats |
| `staging` | loadStaging, loadStats |
| `inferred` | loadDerived(hotspots/flaky/active), loadStats |
| `stats` (fallback) | everything |

### Server implementation

In `dashboard.ts`:

- A single `setInterval(1000ms)` poll computes the digest with one SPARQL query (UNION of small COUNT/MAX queries against `kg:abox`, `kg:tbox-staging`, `kg:inferred`, `kg:meta`).
- A `Set<ServerResponse>` of open SSE clients. On digest change, write to each. On `req.on('close')`, remove from the set.
- A heartbeat comment line (`: keep-alive\n\n`) every 25s so proxies/firewalls don't time out the connection. Localhost-only, but cheap insurance.
- On Fuseki error, emit `event: error\ndata: {...}` and keep polling. The browser shows a small "disconnected" badge but does not throw.

### Browser fallback

If `EventSource` errors (e.g., user opened the HTML file directly without the server), the browser falls back to the existing 30s `setInterval` so the dashboard still works in pure-static mode.

### Why this design (vs. alternatives)

- *Stop-hook writes a sentinel file*: requires modifying the hook, which we explicitly want to leave alone.
- *Fuseki webhooks*: Jena doesn't have native change-feeds. Would require a stored-procedure hack.
- *Poll inside the server at 1Hz*: localhost, tiny SPARQL, negligible cost. One internal poller funnels updates to N browser tabs.

## Data flow walkthrough (end-to-end)

1. User edits a file, an agent runs a command. Stop hook fires, runs `predicate extract --from-stdin`, then `predicate maintain`. New triples land in `kg:abox` and `kg:inferred`.
2. Dashboard server's 1Hz poller detects `sessions` count incremented and `sessionsMaxAt` advanced. Emits `change: ["sessions"]` to all connected browsers.
3. Browser re-runs `loadSessions` + `loadStats`. New row appears at the top.
4. User clicks the new session row. URL hash becomes `#/session/abc123`. Side panel opens, fires 3 SPARQL queries, renders sections.
5. Meanwhile, the agent has also called `kg-propose-schema` to suggest a new class. Triples land in `kg:tbox-staging`.
6. Poller detects `staging` count up. Emits `change: ["staging"]`. Browser re-runs `loadStaging`. New row in the Schema staging card.
7. User clicks **Approve**. Browser POSTs `/api/action`. Server spawns `predicate schema approve <id>`. CLI calls `PromotionSweeper.promote(id)` which validates, writes the Turtle file, emits the kg:meta event.
8. Next poll: `staging` count down, `inferred` up. Two changes broadcast. Browser re-renders.

## Testing

Three layers:

**Server-level (Vitest, `packages/predicate-cli/tests/dashboard.test.ts` extension):**

- `/api/query` proxy still works.
- `/api/action` rejects malformed IRIs (`../../etc/passwd`, IRIs with `;`, `&`, backticks).
- `/api/action` spawns a child with no shell (`spawn` without `{ shell: true }`) — verified by passing a stub spawn fn and asserting argv.
- `/api/events` opens, emits initial digest, emits `change` when digest mutates, drops client on close.

**CLI-level (new `packages/predicate-cli/tests/schema.test.ts`):**

- `predicate schema list` returns JSON shape from staging fixtures.
- `predicate schema approve <id>` calls `PromotionSweeper.promote()` and emits a `SchemaPromoted` event with `actor: 'user-approve'`.
- `predicate schema approve` on a proposal that fails validation exits non-zero and leaves the proposal in place.
- `predicate schema reject <id>` deletes the proposal triples and emits a `SchemaRejected` event.

**Browser-level (Playwright, optional — only if a Playwright harness already exists in the repo; if not, defer):**

- Click session row → panel opens, hash updates.
- Click Approve → row disappears after server returns ok.
- Disconnect SSE → "disconnected" badge appears; reconnect clears it.

The Playwright layer is the only optional one. If we don't have Playwright wired up, we ship A/B/C with server + CLI tests only and verify the UI manually before merge.

## Security & safety

- Server already binds to `127.0.0.1`. Keep it that way; reject any flag to change the host.
- `/api/action` whitelists exactly two verbs and validates the proposal IRI with a strict regex before passing to `spawn`. No shell. No environment passthrough beyond what the parent has.
- No CSRF protection needed (localhost, same-origin, no cookies). If we ever expose the dashboard beyond localhost, this section needs revisiting.
- SSE endpoint has no auth — same trust boundary.

## Performance budget

- SSE poll query target: <50ms per cycle on a typical local Fuseki. The digest query is 4 small COUNT/MAX subqueries, no joins.
- Side panel queries: <200ms total. If a query is slow, the section shows a spinner; the rest of the panel renders without it.
- Browser memory: panel innerHTML replaced (not appended) on each open. No leaks.

## Rollout

Single PR, three commits:

1. SSE: server endpoint + browser `EventSource` consumer + fallback to existing polling. Ships invisible improvement.
2. Drill-down panel: HTML/CSS/JS only, no server changes beyond what step 1 added. Each card's rows become click-targets.
3. Schema staging: new CLI subcommands + `/api/action` endpoint + new card + tests.

Each commit leaves the dashboard fully working. If commit 3 is reverted, the drill-down and SSE improvements remain.

## Open questions (resolved inline, recorded here)

- **Q: Should Approve bypass the use-count gate?** *A: Yes.* User-approve is an explicit override; the validation gate still runs. Logged with `actor: 'user-approve'` so audits can distinguish user-driven from sweeper-driven promotions.
- **Q: Should Reject be immediate or marked-for-rejection?** *A: Immediate.* Same semantics as `rejectExpired()`, just with a different reason in the event payload.
- **Q: What about proposals that are mid-validation when the user clicks Approve?** *A: The CLI subcommand acquires no lock; it just runs the same validate-then-promote path. Worst case is a duplicate `SchemaPromoted` event, which the sweeper already tolerates (the second `promote` finds the triples already gone from staging and is a no-op).* Document this in `schema.ts` rather than adding distributed locking.
- **Q: What if Fuseki goes down while the dashboard is open?** *A:* SSE emits `event: error`, browser shows a "disconnected" badge in the header, queries keep failing visibly per-card until Fuseki returns. No silent retry storm.

## Files touched

| File | Change |
|---|---|
| `packages/predicate-skill/dashboard/index.html` | New side panel, new staging card, EventSource, fallback polling |
| `packages/predicate-cli/src/commands/dashboard.ts` | `/api/action`, `/api/events`, internal 1Hz poller |
| `packages/predicate-cli/src/commands/schema.ts` | **new** — approve/reject/list verbs |
| `packages/predicate-cli/src/index.ts` | Register `schema` dispatch + help line |
| `packages/predicate-cli/tests/dashboard.test.ts` | Cover new endpoints |
| `packages/predicate-cli/tests/schema.test.ts` | **new** — verb-level tests |

No changes to: ontology, `predicate-agent`, `predicate-mcp`, Stop hook, `predicate maintain`, Fuseki config.
