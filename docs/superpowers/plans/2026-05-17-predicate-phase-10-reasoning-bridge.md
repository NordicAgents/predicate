# Predicate Phase 10 — Reasoning Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 16-rule OWL reasoner actually fire on Phase 9's extracted action data. Add 3 new CONSTRUCT rules (R17 Hotspot, R18 FlakyCommand, R19 ActiveFile) plus 3 new TBox classes. Wire the fixpoint runner into `kgMaintain` so reasoning runs after every Stop-hook extraction. Tag v1.7.0-reasoning-bridge.

**Architecture:** Validation revealed `kg:inferred = 0` after extraction because the existing 16 rules target `imports`/`calls`/`declaredIn` and the extractor emits `modifiedIn`/`succeededIn`/`failedIn`. The two reasoning slices don't intersect. This phase bridges them: 3 new SPARQL INSERT-WHERE rules derive `Hotspot`/`FlakyCommand`/`ActiveFile` classes from action predicates, and `kgMaintain` invokes the fixpoint after archiving/promotion so `kg:inferred` reflects the current action graph.

**Tech Stack:** Existing predicate-reasoner package (TypeScript, SPARQL INSERT/CONSTRUCT). New rules live alongside R01-R16 in `packages/predicate-reasoner/src/rules/`.

---

## File Structure

**New files:**
- `packages/predicate-reasoner/src/rules/r17-hotspot.ts`
- `packages/predicate-reasoner/src/rules/r18-flaky-command.ts`
- `packages/predicate-reasoner/src/rules/r19-active-file.ts`
- `packages/predicate-reasoner/tests/rules/r17-r19.test.ts`

**Modified files:**
- `packages/predicate-reasoner/src/rules/index.ts` — append r17, r18, r19 to RULES array.
- `packages/predicate-ontology/tbox/codebase.ttl` — add Hotspot, FlakyCommand, ActiveFile classes.
- `packages/predicate-ontology/meta/version.json` — bump to 0.5.0.
- `packages/predicate-mcp/src/tools/kg-maintain.ts` — invoke `runFixpoint` after promotion sweep.
- `packages/predicate-mcp/tests/tools/kg-maintain.test.ts` — assert kg:inferred has content after maintain.
- `packages/predicate-skill/skills/predicate/SKILL.md` — document Hotspot/FlakyCommand/ActiveFile as queryable derived classes.
- `packages/predicate-skill/package.json` — bump 1.6.3 → 1.7.0.
- `packages/predicate-skill/.claude-plugin/plugin.json` — bump 1.6.3 → 1.7.0.
- `.claude-plugin/marketplace.json` — bump 1.6.3 → 1.7.0.
- `README.md` — Status section + Tools table.

---

### Task 1: TBox additions

Modify `packages/predicate-ontology/tbox/codebase.ttl`. After the existing `:Command` class declaration, append:

```turtle
:Hotspot      a owl:Class ; rdfs:subClassOf :File    ; rdfs:label "File modified in many sessions" .
:FlakyCommand a owl:Class ; rdfs:subClassOf :Command ; rdfs:label "Command that has failed in multiple sessions" .
:ActiveFile   a owl:Class ; rdfs:subClassOf :File    ; rdfs:label "File modified in the most recent session" .
```

Modify `packages/predicate-ontology/meta/version.json`: bump `"version": "0.4.0"` → `"version": "0.5.0"`.

Reload: `cd packages/predicate-server && bash scripts/bootstrap-graphs.sh`.

Verify: `curl http://localhost:3030/predicate/query --data-urlencode "query=PREFIX cb: <https://predicate.dev/codebase#> ASK { GRAPH <kg:tbox> { cb:Hotspot a <http://www.w3.org/2002/07/owl#Class> } }" --header "Accept: application/sparql-results+json" | jq -r .boolean` → `true`.

Commit: `feat(ontology): add Hotspot/FlakyCommand/ActiveFile classes`.

### Task 2: R17 Hotspot rule

Create `packages/predicate-reasoner/src/rules/r17-hotspot.ts`:

```typescript
import type { Rule, RuleConfig } from './types.js';

const HOTSPOT_THRESHOLD = 3;

export const r17: Rule = {
  id: 'r17-hotspot',
  name: 'codebase:Hotspot — file modified in ≥3 sessions',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX cb:  <https://predicate.dev/codebase#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?file rdf:type cb:Hotspot } }
    WHERE {
      {
        SELECT ?file (COUNT(DISTINCT ?session) AS ?n)
        WHERE { GRAPH <${cfg.aboxGraph}> { ?file cb:modifiedIn ?session } }
        GROUP BY ?file
        HAVING (?n >= ${HOTSPOT_THRESHOLD})
      }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?file rdf:type cb:Hotspot } }
    }
  `,
};
```

Note: backward-chaining (the `backward` property on other rules) is omitted — R17–R19 are derive-only rules; `kg_explain` doesn't need to trace their premises in v1.7.0.

### Task 3: R18 FlakyCommand rule

Create `packages/predicate-reasoner/src/rules/r18-flaky-command.ts`:

```typescript
import type { Rule, RuleConfig } from './types.js';

const FLAKY_THRESHOLD = 2;

export const r18: Rule = {
  id: 'r18-flaky-command',
  name: 'codebase:FlakyCommand — command failed in ≥2 sessions',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX cb:  <https://predicate.dev/codebase#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?cmd rdf:type cb:FlakyCommand } }
    WHERE {
      {
        SELECT ?cmd (COUNT(DISTINCT ?session) AS ?n)
        WHERE { GRAPH <${cfg.aboxGraph}> { ?cmd cb:failedIn ?session } }
        GROUP BY ?cmd
        HAVING (?n >= ${FLAKY_THRESHOLD})
      }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?cmd rdf:type cb:FlakyCommand } }
    }
  `,
};
```

### Task 4: R19 ActiveFile rule

Create `packages/predicate-reasoner/src/rules/r19-active-file.ts`:

```typescript
import type { Rule, RuleConfig } from './types.js';

export const r19: Rule = {
  id: 'r19-active-file',
  name: 'codebase:ActiveFile — file modified in the most recent session',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX cb:   <https://predicate.dev/codebase#>
    PREFIX pred: <https://predicate.dev/meta#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?file rdf:type cb:ActiveFile } }
    WHERE {
      {
        SELECT ?session
        WHERE {
          GRAPH <${cfg.aboxGraph}> { ?session rdf:type pred:Session ; pred:at ?at }
        }
        ORDER BY DESC(?at)
        LIMIT 1
      }
      GRAPH <${cfg.aboxGraph}> { ?file cb:modifiedIn ?session }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?file rdf:type cb:ActiveFile } }
    }
  `,
};
```

### Task 5: Register the 3 new rules

Modify `packages/predicate-reasoner/src/rules/index.ts`. Add the imports + extend RULES:

```typescript
import { r17 } from './r17-hotspot.js';
import { r18 } from './r18-flaky-command.js';
import { r19 } from './r19-active-file.js';

export const RULES: Rule[] = [
  r01, r02, r03, r04, r05, r06, r07, r08, r09, r10, r12, r13, r14, r15, r16,
  r17, r18, r19,
];
```

### Task 6: Test the new rules

Create `packages/predicate-reasoner/tests/rules/r17-r19.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { runFixpoint } from '../../src/fixpoint.js';
import { RULES } from '../../src/rules/index.js';

const client = new SparqlClient(loadConfig());
const cfg = { aboxGraph: 'kg:abox', tboxGraph: 'kg:tbox', inferredGraph: 'kg:inferred' };

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:abox>`);
  await client.update(`CREATE SILENT GRAPH <kg:abox>`);
}

async function inferredHas(query: string): Promise<boolean> {
  const r = await client.select(query);
  return r.results.bindings.length > 0;
}

describe('R17 hotspot', () => {
  beforeEach(reset);

  it('derives codebase:Hotspot for files modified in ≥3 distinct sessions', async () => {
    await client.update(`
      PREFIX cb: <https://predicate.dev/codebase#>
      INSERT DATA { GRAPH <kg:abox> {
        <file:///a.ts> cb:modifiedIn <urn:session:1> ; cb:modifiedIn <urn:session:2> ; cb:modifiedIn <urn:session:3> .
        <file:///b.ts> cb:modifiedIn <urn:session:1> ; cb:modifiedIn <urn:session:2> .
      } }
    `);
    await runFixpoint(client, RULES, cfg);
    expect(await inferredHas(`PREFIX cb: <https://predicate.dev/codebase#>
                              SELECT * WHERE { GRAPH <kg:inferred> { <file:///a.ts> a cb:Hotspot } }`)).toBe(true);
    expect(await inferredHas(`PREFIX cb: <https://predicate.dev/codebase#>
                              SELECT * WHERE { GRAPH <kg:inferred> { <file:///b.ts> a cb:Hotspot } }`)).toBe(false);
  });
});

describe('R18 flaky command', () => {
  beforeEach(reset);

  it('derives codebase:FlakyCommand for commands that failed in ≥2 distinct sessions', async () => {
    await client.update(`
      PREFIX cb: <https://predicate.dev/codebase#>
      INSERT DATA { GRAPH <kg:abox> {
        <urn:bash:flaky> cb:failedIn <urn:session:1> ; cb:failedIn <urn:session:2> .
        <urn:bash:rare>  cb:failedIn <urn:session:1> .
      } }
    `);
    await runFixpoint(client, RULES, cfg);
    expect(await inferredHas(`PREFIX cb: <https://predicate.dev/codebase#>
                              SELECT * WHERE { GRAPH <kg:inferred> { <urn:bash:flaky> a cb:FlakyCommand } }`)).toBe(true);
    expect(await inferredHas(`PREFIX cb: <https://predicate.dev/codebase#>
                              SELECT * WHERE { GRAPH <kg:inferred> { <urn:bash:rare>  a cb:FlakyCommand } }`)).toBe(false);
  });
});

describe('R19 active file', () => {
  beforeEach(reset);

  it('derives codebase:ActiveFile only for files modified in the most-recent session', async () => {
    await client.update(`
      PREFIX cb:   <https://predicate.dev/codebase#>
      PREFIX pred: <https://predicate.dev/meta#>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA { GRAPH <kg:abox> {
        <urn:session:old>  a pred:Session ; pred:at "2026-01-01T00:00:00Z"^^xsd:dateTime .
        <urn:session:new>  a pred:Session ; pred:at "2026-05-17T00:00:00Z"^^xsd:dateTime .
        <file:///old.ts>   cb:modifiedIn <urn:session:old> .
        <file:///new.ts>   cb:modifiedIn <urn:session:new> .
      } }
    `);
    await runFixpoint(client, RULES, cfg);
    expect(await inferredHas(`PREFIX cb: <https://predicate.dev/codebase#>
                              SELECT * WHERE { GRAPH <kg:inferred> { <file:///new.ts> a cb:ActiveFile } }`)).toBe(true);
    expect(await inferredHas(`PREFIX cb: <https://predicate.dev/codebase#>
                              SELECT * WHERE { GRAPH <kg:inferred> { <file:///old.ts> a cb:ActiveFile } }`)).toBe(false);
  });
});
```

Run: `pnpm --filter predicate-reasoner test r17-r19`. Expected: 3 tests pass.

### Task 7: Wire fixpoint into kgMaintain

Modify `packages/predicate-mcp/src/tools/kg-maintain.ts`. Add the import + invoke `runFixpoint` after the existing sweeper call, before logging the MaintenanceRun event. Read the existing file first to confirm the exact insertion point.

```typescript
import { runFixpoint } from 'predicate-reasoner/src/fixpoint.js';
import { RULES } from 'predicate-reasoner/src/rules/index.js';

// ...inside kgMaintain(), after `const sweeper = await new PromotionSweeper(...)`:
const fixpoint = await runFixpoint(client, RULES, {
  aboxGraph: 'kg:abox',
  tboxGraph: 'kg:tbox',
  inferredGraph: 'kg:inferred',
});
```

Update `MaintainResult` to include the fixpoint result:

```typescript
export interface MaintainResult {
  archivedCount: number;
  elapsedMs: number;
  eventId: string;
  sweeper?: SweeperResult;
  generalizer?: GeneralizerResult;
  fixpoint?: { iterations: number; inferredCount: number };  // <-- new
}
```

And in the returned object: `return { archivedCount, elapsedMs, eventId, sweeper, generalizer, fixpoint };`.

Also update `predicate-cli/src/commands/maintain.ts` to print the new `inferred` count alongside the existing summary line.

### Task 8: Test the maintain → kg:inferred flow

Modify `packages/predicate-mcp/tests/tools/kg-maintain.test.ts` to add a test verifying that after kgMaintain, kg:inferred has content if action data is present:

```typescript
it('runs the OWL fixpoint after sweep — derives Hotspot/FlakyCommand/ActiveFile from action data', async () => {
  await client.update(`DROP SILENT GRAPH <kg:abox>`);
  await client.update(`CREATE SILENT GRAPH <kg:abox>`);
  await client.update(`
    PREFIX cb:   <https://predicate.dev/codebase#>
    PREFIX pred: <https://predicate.dev/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:abox> {
      <urn:session:t1> a pred:Session ; pred:at "2026-05-17T00:00:00Z"^^xsd:dateTime .
      <urn:session:t2> a pred:Session ; pred:at "2026-05-17T01:00:00Z"^^xsd:dateTime .
      <urn:session:t3> a pred:Session ; pred:at "2026-05-17T02:00:00Z"^^xsd:dateTime .
      <file:///hot.ts> cb:modifiedIn <urn:session:t1> ; cb:modifiedIn <urn:session:t2> ; cb:modifiedIn <urn:session:t3> .
    } }
  `);
  const result = await kgMaintain(client, {});
  expect(result.fixpoint).toBeDefined();
  expect(result.fixpoint!.inferredCount).toBeGreaterThan(0);
  const hotspot = await client.select(
    `PREFIX cb: <https://predicate.dev/codebase#>
     ASK { GRAPH <kg:inferred> { <file:///hot.ts> a cb:Hotspot } }`,
  );
  expect((hotspot as unknown as { boolean: boolean }).boolean).toBe(true);
});
```

NOTE: `client.select` doesn't natively run ASK — use `client.ask` if it exists, else convert to SELECT with EXISTS. Adapt to whatever the existing test patterns use.

### Task 9: Update SKILL.md to mention the new derived classes

Modify `packages/predicate-skill/skills/predicate/SKILL.md`. Add to worked example 4 (session history) a paragraph about the derived classes:

```markdown
The reasoner derives additional classes on top of the raw action data
(refreshed by every `predicate maintain` run):

| Derived class | Means |
|---|---|
| `codebase:Hotspot` | File modified in ≥ 3 sessions — likely active work-in-progress |
| `codebase:FlakyCommand` | Command that has failed in ≥ 2 sessions — suspect debug target |
| `codebase:ActiveFile` | File modified in the single most-recent session |

Query them directly via `kg:inferred`:

\`\`\`sparql
PREFIX cb: <https://predicate.dev/codebase#>
SELECT ?file WHERE { GRAPH <kg:inferred> { ?file a cb:Hotspot } }
\`\`\`
```

### Task 10: Version bumps, bundle rebuild, commit, tag, push

- Bump `packages/predicate-skill/package.json` 1.6.3 → 1.7.0
- Bump `packages/predicate-skill/.claude-plugin/plugin.json` 1.6.3 → 1.7.0
- Bump `.claude-plugin/marketplace.json` (both occurrences) 1.6.3 → 1.7.0
- Update top-level README Status section + Tools table to mention the 3 derived classes
- Run full test suite, expect all green
- `pnpm --filter predicate-skill run bundle`
- Commit with message:

```
feat(reasoner,mcp): v1.7.0 — reasoning bridge for action data

Adds R17 (Hotspot), R18 (FlakyCommand), R19 (ActiveFile) to derive
useful classes from Phase 9's extracted modifiedIn/failedIn/at data.
kgMaintain now invokes the fixpoint runner so kg:inferred reflects
the current action graph after every Stop-hook extraction +
maintenance pass.

Closes the validation gap surfaced in the v1.6 reasoning audit:
kg:inferred was always 0 because the 16 OWL rules targeted the
imports/calls/declaredIn domain while extraction emits action
predicates. Now they're bridged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

- Tag `v1.7.0-reasoning-bridge`
- Merge to main
- `git push origin main --follow-tags`
