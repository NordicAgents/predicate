# Predicate v2.0 — Domain-Agnostic Bootstrap (Design Spec)

**Status:** Approved 2026-05-17. Ready for implementation planning.
**Replaces:** The "codebase TBox is always loaded" model that has been in place since v1.0.
**Targeted release:** Phase 17 / v2.0.

## Goal

Replace the hardcoded "codebase-intelligence" identity with a domain-agnostic bootstrap. On first run, users pick one of three initialization paths: install a bundled community ontology, upload their own, or start empty with a minimal upper vocabulary. Add a runtime-mutable schema-learning toggle so users (or the agent itself) can pause the autonomous proposer without locking the TBox.

## Non-Goals

- A community ontology marketplace fetched over the network. v2.0 ships a curated bundled catalog only; community submissions are a v2.x follow-up.
- Multi-ontology composition. Each install picks one ontology (community or uploaded). Loading `foaf + schema-org-lite + custom.ttl` simultaneously is out of scope.
- Schema versioning / migration tooling for the uploaded ontology path. Re-upload via `predicate init --force` is the only update mechanism.
- Per-project workspace isolation. The config lives in `kg:meta` of the single Fuseki dataset, not per-project.
- Auth / TLS on the new MCP tools.

## Architecture overview

Three new artifacts:

1. **`predicate init` CLI command** — interactive 3-way prompt + writes config to `kg:meta`. Also auto-invoked by `predicate up` on first run when stdin is a TTY.
2. **`packages/predicate-ontology/catalog/` directory** — five bundled `.ttl` files + a `catalog.json` registry index.
3. **`kg_config_set` / `kg_config_get` MCP tools** — agent-callable runtime config (10th + 11th MCP tools).

The config record lives at `<urn:predicate:config>` in `kg:meta`:

```turtle
<urn:predicate:config> a pred:Config ;
  pred:initMode "community" ;                   # "community" | "upload" | "empty"
  pred:initOntology "codebase" ;                # catalog name, "user", or "top"
  pred:schemaLearningEnabled true ;
  pred:initializedAt "2026-05-17T00:00:00Z"^^xsd:dateTime .
```

The sweeper + generalizer in `predicate-agent` read `pred:schemaLearningEnabled` from `kg:meta` before deciding to auto-propose. `kg_assert` and `kg_propose_schema` (the explicit MCP tools) are unaffected by the toggle — those are user/agent-initiated operations.

Backward compatibility: `bootstrap-graphs.sh` stops hardcoding `codebase.ttl`; it only creates the named graphs. Actual TBox loading happens inside `predicate init` (or its auto-migration path in `predicate up` for v1.13 users).

## Decisions matrix

| Topic | Decision |
|---|---|
| First-run default | Auto-run init interactively if TTY; fallback to start-empty + learning-on for non-TTY (CI) |
| "Off" semantics | Pause auto-proposer (Generalizer) only. `kg_propose_schema` (explicit) still works. Sweeper still promotes existing staging. |
| Empty mode contents | `predicate-meta.ttl` + tiny `top.ttl` (Thing, dependsOn, relatedTo) |
| Catalog scope | `top` + `codebase` + `foaf` + `schema-org-lite` + `fhir-core` (5 bundled) |
| v1.13 migration | Auto-adopt silently as "codebase community ontology selected" |
| Toggle mechanism | New MCP tool `kg_config_set` / `kg_config_get` (stores in `kg:meta`) |

## Components

### A. `packages/predicate-ontology/catalog/`

New directory. Renames `tbox/` to `catalog/` and adds 4 new ontology files.

```
catalog/
├── catalog.json            # registry index
├── top.ttl                 # ~3 triples (Thing, dependsOn, relatedTo)
├── codebase.ttl            # moved from tbox/codebase.ttl
├── codebase.shacl.ttl      # moved from shapes/codebase.shacl.ttl
├── foaf.ttl                # ~100 triples, CC0
├── schema-org-lite.ttl     # ~500 triples (trimmed slice of schema.org), CC-BY-4.0
└── fhir-core.ttl           # ~300 triples (HL7 permitted subset)
```

`catalog.json` shape:

```json
{
  "version": "1.0.0",
  "ontologies": [
    {
      "name": "top",
      "description": "Minimal upper ontology — Thing, dependsOn, relatedTo",
      "license": "CC0",
      "files": ["top.ttl"]
    },
    {
      "name": "codebase",
      "description": "Software code structure (files, symbols, calls, modifications)",
      "license": "Apache-2.0",
      "files": ["codebase.ttl"],
      "shapes": "codebase.shacl.ttl"
    },
    {
      "name": "foaf",
      "description": "Friend-of-a-friend — people and their relationships",
      "license": "CC0",
      "files": ["foaf.ttl"]
    },
    {
      "name": "schema-org-lite",
      "description": "Web entities — trimmed slice of schema.org",
      "license": "CC-BY-4.0",
      "files": ["schema-org-lite.ttl"]
    },
    {
      "name": "fhir-core",
      "description": "Healthcare resources — HL7 permitted subset",
      "license": "HL7",
      "files": ["fhir-core.ttl"]
    }
  ]
}
```

The schema.org and FHIR slices are MAINTAINED subsets. We define what's included in v2.0; growing them is a follow-up. Attribution lines in each `.ttl` header credit the upstream source.

### B. `packages/predicate-cli/src/commands/init.ts`

CLI surface:

```
predicate init [--mode community|upload|empty] [--ontology NAME] [--file PATH] [--force]
```

Modes:
- Interactive (no flags + TTY): prints prompt, reads stdin via `readline`. Default flow for human users.
- Non-interactive (flags provided): no prompts, validates and runs. For scripts and automation.
- `--force`: required when config already exists in `kg:meta`. Wipes kg:tbox + kg:tbox-staging + kg:abox + kg:inferred + kg:provenance + kg:goals + kg:usage and re-initializes.

The interactive prompt:

```
Welcome to Predicate. Choose how to initialize the knowledge graph:

  (1) Install a community ontology  — pick one of our bundled vocabularies
  (2) Upload your own ontology      — load a custom .ttl file
  (3) Start empty                   — meta vocab only, agent grows the rest

Your choice [1/2/3]:
```

If (1): sub-prompt lists ontologies from `catalog.json`. If (2): asks for filepath. If (3): proceeds directly.

After mode selection, init:
1. Drops `kg:tbox` (only if `--force`) and recreates it
2. Loads `predicate-meta.ttl` first
3. Loads the chosen ontology file(s) (none for upload-bad-state)
4. For community/upload: optionally loads the shapes file if defined
5. Runs the reasoner fixpoint once to verify no consistency violations
6. INSERTs the four config triples into `kg:meta`
7. Prints a one-line summary

### C. `packages/predicate-mcp/src/tools/kg-config.ts`

Two new MCP tools.

```typescript
// kg_config_get({ key?: string })
// Returns:
//   - if key given: { key, value }   or   { key, value: null } if absent
//   - if key omitted: { config: { initMode, initOntology, schemaLearningEnabled, initializedAt } }

// kg_config_set({ key: string, value: string | boolean })
// Validates key against allowlist: ["schema-learning", "init-mode", "init-ontology"]
// Returns: { ok: true, key, value } on success
//          { ok: false, error: "..." } on validation failure
```

Storage: triples under `<urn:predicate:config>` in `kg:meta`. The set operation is a DELETE + INSERT pair (idempotent overwrite).

The allowlist is a defensive measure — preventing arbitrary triples from being written into the config slot. `init-mode` and `init-ontology` are settable post-init for advanced use (e.g., "mark this as an upload-mode install after a manual TBox load"), but the canonical write path is via `predicate init`.

### D. Sweeper + Generalizer (modified `predicate-agent`)

Existing `PromotionSweeper` and `Generalizer` classes gain a precheck:

```typescript
private async isSchemaLearningEnabled(client: SparqlClient): Promise<boolean> {
  return client.ask(
    `PREFIX pred: <https://industriagents.com/predicate/meta#>
     ASK { GRAPH <kg:meta> { <urn:predicate:config> pred:schemaLearningEnabled true } }`,
  );
}
```

Behavior when disabled:

| Class | Behavior with `schemaLearningEnabled = false` |
|---|---|
| `Generalizer` | Skip autonomous proposal generation. Return `{ proposals: [], autoProposalsSkipped: true }`. |
| `PromotionSweeper` | Run normally. Promotes existing staged proposals (those came from explicit `kg_propose_schema` calls; not "learning"). |

Behavior when the config triple is **missing** (e.g., very fresh install before init): treated as `true` (default-on). Init writes the explicit `true` triple immediately.

### E. `bootstrap-graphs.sh` (simplified)

Reduced to graph-creation only. No TBox loading. New shape:

```bash
#!/usr/bin/env bash
set -euo pipefail
HOST="${FUSEKI_URL:-http://localhost:3030}"
DATASET="predicate"
ADMIN_PASSWORD="${PREDICATE_ADMIN_PASSWORD:-changeme}"

for g in kg:tbox kg:tbox-staging kg:abox kg:inferred kg:provenance kg:goals kg:usage kg:meta kg:peers; do
  curl -fsS -u "admin:${ADMIN_PASSWORD}" -X POST \
    --header "Content-Type: application/sparql-update" \
    --data "CREATE SILENT GRAPH <$g>" \
    "$HOST/$DATASET/update"
done
echo "graphs created (kg:tbox empty — run \`predicate init\` to load an ontology)"
```

### F. `packages/predicate-cli/src/commands/up.ts` (modified)

New sequence:

```typescript
export async function up(): Promise<number> {
  // 1. docker compose up + wait-for-fuseki (unchanged)
  // 2. Run bootstrap-graphs.sh (creates empty graphs)
  // 3. Check kg:meta for <urn:predicate:config> pred:initMode ?
  const configExists = await checkConfigExists();
  if (configExists) return 0;

  // 4. Sniff for v1.13 legacy state
  const isLegacy = await client.ask(
    `PREFIX cb: <https://industriagents.com/predicate/codebase#>
     PREFIX owl: <http://www.w3.org/2002/07/owl#>
     ASK { GRAPH <kg:tbox> { cb:File a owl:Class } }`,
  );
  if (isLegacy) {
    await writeLegacyConfig();  // mode=community, ontology=codebase, learning=true
    return 0;
  }

  // 5. Run init interactively if TTY
  if (process.stdin.isTTY) return init([]);

  // 6. Non-TTY fallback: default to empty + learning on
  console.error('predicate up: no init config and non-TTY stdin; defaulting to empty mode + learning on.');
  return init(['--mode', 'empty']);
}
```

## Data flows

### Scenario 1: First-time interactive install

```
$ predicate up
  → bootstrap creates 9 graphs
  → up.ts: no config in kg:meta, kg:tbox empty, stdin is TTY
  → invokes predicate init internally
    → prompts: (1) community (2) upload (3) empty
    → user picks (1) community → ontology: codebase
    → loads meta/predicate-meta.ttl + catalog/codebase.ttl into kg:tbox
    → loads catalog/codebase.shacl.ttl into kg:tbox (shapes graph optional)
    → writes config triples to kg:meta
    → prints "Predicate initialized with codebase ontology."
  → exits 0
```

### Scenario 2: v1.13 auto-migration

```
$ predicate up                     # user upgraded from v1.13; codebase.ttl already in kg:tbox
  → bootstrap creates graphs (CREATE SILENT is no-op when they exist)
  → up.ts checks kg:meta config: absent
  → up.ts ASK kg:tbox for codebase:File: returns true
  → recognized as legacy install
  → writes config (mode=community, ontology=codebase, learning=true)
  → no prompt, no migration-specific output
```

### Scenario 3: Agent toggles schema-learning off mid-session

```
Agent (during turn): kg_config_set({key: "schema-learning", value: false})
  → kg-config.ts validates key ∈ allowlist
  → DELETE { GRAPH <kg:meta> { <urn:predicate:config> pred:schemaLearningEnabled ?o } }
    INSERT { GRAPH <kg:meta> { <urn:predicate:config> pred:schemaLearningEnabled false } }
  → returns { ok: true, key: "schema-learning", value: false }

Next predicate maintain (or Stop hook):
  → Generalizer reads ASK kg:meta; returns false
  → Generalizer skips proposal generation
  → PromotionSweeper proceeds (promotes existing staging if 3-use gate met)
  → kgMaintain result includes { autoProposalsSkipped: true }
```

### Scenario 4: Upload your own ontology

```
$ predicate init --mode upload --file ./my-domain.ttl
  → reads file (rejects if > 10 MB)
  → parse-validates via N3.js
  → ASK uploaded triples for pred:* namespace usage; reject if found
  → loads meta + my-domain.ttl into kg:tbox
  → runs reasoner fixpoint once (verifies no disjoint-class violations)
  → if consistent: writes config (mode=upload, ontology=user, learning=true), exits 0
  → if inconsistent: DROP kg:tbox; CREATE kg:tbox; reload meta only; exit 1 with violation details
```

### Scenario 5: Start empty (minimal seed)

```
$ predicate init --mode empty
  → loads meta/predicate-meta.ttl + catalog/top.ttl into kg:tbox
  → writes config (mode=empty, ontology=top, learning=true)
  → prints: "Predicate initialized with minimal vocabulary. Agent will propose new predicates as needed; sweeper promotes after 3 uses."
```

## Cross-cutting reads

- **`predicate sessionstart` banner** reads `kg:meta` for `initOntology` and adds it to the existing line: *"Predicate ready: N active goals, M TBox classes (codebase ontology), K prior sessions in kg:abox. …"*
- **`predicate sessions` / `predicate captures` / `predicate recall`** unchanged — they query `kg:abox` / `kg:usage` only.
- **Dashboard** adds a small badge in the header showing current ontology name + learning state.
- **`predicate doctor`** adds two new checks: "config exists in kg:meta" and "TBox contains > meta vocab" (the latter detects partial inits).
- **`SKILL.md`** gains a new section explaining the toggle: when the agent should consider calling `kg_config_set("schema-learning", false)` (e.g., user explicitly says "stop adding new predicates").

## Error handling

### `predicate init` failures

| Condition | Behavior |
|---|---|
| Config already exists in `kg:meta`, no `--force` | Exit 2: *"Predicate is already initialized as `community/codebase`. Use `predicate init --force` to reset (destructive). Or `kg_config_set(...)` to toggle settings."* |
| `--mode community --ontology X` where X isn't in catalog | Exit 2 + print available names from `catalog.json` |
| `--file PATH` doesn't exist | Exit 1 + filesystem error |
| Uploaded `.ttl` parse fails | Exit 1 + the N3.js error line/column; `kg:tbox` left empty (transactional load) |
| Uploaded `.ttl` uses `pred:` namespace | Exit 1: *"Uploaded ontology uses the reserved `pred:` namespace at line N. Rename or remove those triples."* |
| Uploaded `.ttl` causes reasoner inconsistency | Roll back kg:tbox to meta-only, exit 1, print the inconsistent triples |
| Fuseki unreachable | Exit 1: *"Fuseki not running. Try `predicate up` first."* |
| `predicate up` invokes init but stdin is non-TTY (CI) | Skip prompt, default to empty mode + learning on, print warning to stderr |

### `kg_config_set` failures

| Condition | Behavior |
|---|---|
| Unknown key (not in allowlist) | Returns `{ ok: false, error: "unknown key 'X'. Valid keys: schema-learning, init-mode, init-ontology" }` |
| Value type wrong (e.g. boolean expected, string given) | Returns `{ ok: false, error: "schema-learning expects boolean, got string" }` |
| Fuseki unreachable | Throws; caller's MCP error handler reports |
| Init not yet run | Allows the write; config triples just live as orphans in `kg:meta` until init completes. Documented behavior: harmless. |

### Sweeper / Generalizer when learning is off

- Read `kg:meta` once at start of each `predicate maintain` run; cached for the duration of that pass.
- If `schemaLearningEnabled = false`: skip generalizer entirely.
- Result object reports `autoProposalsSkipped: true`.
- Never crashes; missing toggle treated as default-on.

### Migration sniff false-positives

The v1.13 detection `ASK { <https://industriagents.com/predicate/codebase#File> a owl:Class }` could match someone who *uploaded* an ontology that happened to declare that IRI. Mitigation: check that `<urn:predicate:config>` is also absent before treating it as legacy. The failure mode is benign (mode marked as codebase instead of upload; user can `init --force` to fix).

## Testing strategy

### New tests

| File | Cases |
|---|---|
| `packages/predicate-cli/tests/init.test.ts` | (1) `--mode community --ontology codebase` loads codebase.ttl + meta; (2) `--mode upload --file good.ttl` succeeds; (3) `--mode upload --file bad-prefix.ttl` rejects pred: namespace; (4) `--mode upload --file inconsistent.ttl` rolls back; (5) `--mode empty` loads meta + top only; (6) `--force` on existing config wipes + reinits; (7) refuses re-init without `--force`; (8) `--help` prints usage. |
| `packages/predicate-mcp/tests/tools/kg-config.test.ts` | (1) set then get round-trip; (2) unknown key rejected; (3) wrong type rejected; (4) get with no key returns all; (5) get of absent key returns null. |
| `packages/predicate-cli/tests/up.test.ts` (extend) | (1) v1.13 codebase-sniff auto-migration writes config; (2) non-TTY first-run defaults to empty + warning; (3) existing config skips init prompt. |
| `packages/predicate-mcp/tests/tools/kg-maintain.test.ts` (extend) | (1) Generalizer skipped when `schemaLearningEnabled=false`; (2) sweeper still promotes existing staging when learning is off; (3) result includes `autoProposalsSkipped` flag. |
| `packages/predicate-ontology/tests/catalog.test.ts` (new) | Each bundled .ttl parses as valid Turtle (N3.js) and loads into a fresh kg:tbox without reasoner inconsistencies. 5 tests (one per ontology). |

### Existing-test impact

- `bootstrap-graphs.sh` smoke tests need updating: bootstrap no longer pre-loads codebase TBox. Tests that depended on those triples must call `predicate init --mode community --ontology codebase` first.
- `kg-research-goal.test.ts` and reasoner rule tests likely assume codebase predicates exist. They'll need a `beforeAll` that runs the codebase init.
- Possibly a small refactor: a shared `tests/fixtures/with-codebase-tbox.ts` helper that does the init for tests that need codebase vocab.

### Total estimated test count delta

~22 new tests (8 init + 5 kg-config + 3 up + 3 kg-maintain + 5 catalog smoke). Expected total after Phase 17: ~268 (246 current + 22 new). May lose a few that become unnecessary once the codebase-default-load is gone.

## Migration / backward compatibility

- **v1.13.0 → v2.0**: Auto-adopt path described in Scenario 2. No user action required.
- **npm-installed predicate-skill@1.x → 2.0**: First `predicate up` after upgrade triggers the legacy sniff. Same migration path.
- **CI / scripted installs**: Stdin is non-TTY, so init falls through to empty mode + learning-on with a warning. If they need codebase behavior, they should add `predicate init --mode community --ontology codebase` to their setup script.
- **Rollback**: A user on v2.0 wanting to go back to v1.13 behavior: `predicate init --force --mode community --ontology codebase`. State is recoverable.

## Future work (deferred)

- Network-fetched community ontologies (registry beyond bundled five).
- Multi-ontology composition (load FOAF + schema.org simultaneously, with namespace disambiguation).
- Per-project workspaces (multiple datasets in Fuseki, one per project; separate kg:meta configs).
- Schema versioning for uploaded ontologies (track changes over time, not just `--force` overwrite).
- A `predicate config` CLI surface for human-facing config edits (today only `kg_config_set` via MCP).
- TBox export: dump current kg:tbox as a Turtle file for backup/transfer.
- Per-ontology shapes auto-loading (some ontologies in catalog will have SHACL shapes; the catalog.json already declares them).

## Open assumptions

- N3.js is already a dev-dep (used elsewhere in the reasoner). If not, this design adds it as a runtime dep of predicate-cli for upload parse-validation.
- The reasoner fixpoint runner currently mutates kg:inferred. Running it against the freshly loaded TBox during init may seed kg:inferred with derived classes. Acceptable; init can DROP kg:inferred and CREATE it before/after if the inferred-counts should start at 0.
- 10 MB upload size cap is arbitrary. Real-world domain ontologies (schema.org full = 3 MB) usually fit; if someone wants 50 MB FHIR-full, raise to env var.
