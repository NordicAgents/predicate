# Eval Harness — Plan A (Deterministic Spine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic, key-free eval spine that measures multi-hop answer accuracy, the compounding-over-episodes curve, the inference-on/off reasoning-lift number, and boundedness — starting with the organizational domain end-to-end, then research-provenance and coding fixtures, plus a reasoner-soundness sidecar and an ASCII reporter.

**Architecture:** Extends `packages/predicate-eval`. Fixtures (`world.ttl` + `oracle.json` + `episodes/*.jsonl` + `questions.json`) are pure data; `oracle.ts`, `scorer.ts`, `episode-runner.ts`, `metrics.ts`, the Tier-1 rig, and `report.ts` are domain-independent code. Tier 1 runs vetted golden SPARQL against the in-memory Oxigraph store after materialization; the inference-off control reruns with materialization skipped to isolate reasoning lift.

**Tech Stack:** TypeScript (ESM), vitest, `predicate-mcp` storage adapter (`getAdapter()` = in-memory Oxigraph), `predicate-reasoner` `FusekiConstructAdapter`. No new runtime dependencies (questions stored as JSON, not YAML, to avoid a parser dep — the spec showed YAML illustratively).

**Scope note:** Tier 2 (host-model sampling) is **out of scope** for Plan A and lives in Plan B, gated on the MCP `sampling/createMessage` spike. Plan A is fully functional and CI-gating on its own.

---

## File structure

| File | Responsibility |
|---|---|
| `packages/predicate-eval/src/eval-types.ts` | Shared types: `Question`, `AnswerKey`, `Score`, `ScoreRow`, `Boundedness` |
| `packages/predicate-eval/src/oracle.ts` | Load `oracle.json`; derive answer keys (transitive closure, conflicts, paths) at a given episode cutoff |
| `packages/predicate-eval/src/questions.ts` | Load + validate `questions.json` for a domain |
| `packages/predicate-eval/src/scorer.ts` | `set` / `boolean` / `path` / `conflict` scorers → `Score` |
| `packages/predicate-eval/src/episode-runner.ts` | Apply episode N to `kg:abox`; (re)materialize or skip (control) |
| `packages/predicate-eval/src/metrics.ts` | Boundedness: triple counts, unused-concept ratio, materialize latency |
| `packages/predicate-eval/src/rigs/tier1-deterministic.ts` | Orchestrate Tier-1 run → `ScoreRow[]` |
| `packages/predicate-eval/src/report.ts` | Append `results/scoreboard.jsonl`; render ASCII curve |
| `packages/predicate-eval/src/soundness/closure-check.ts` | Random-graph closure check for standard OWL rules |
| `packages/predicate-eval/src/soundness/scaling-probe.ts` | Latency vs triple-count, record-only |
| `packages/predicate-eval/fixtures/org/` | Org domain: `world.ttl`, `oracle.json`, `episodes/*.jsonl`, `questions.json` |
| `packages/predicate-eval/fixtures/research/` | Research-provenance domain fixtures |
| `packages/predicate-eval/fixtures/coding/` | Coding seed domain (reuses demo-corpus IRIs) |
| `packages/predicate-eval/tests/*.test.ts` | One test file per src module + per-domain fixture-integrity tests |

**Test command convention** (run from repo root): `pnpm --filter predicate-eval test`. Single file: `pnpm --filter predicate-eval exec vitest run tests/<file>.test.ts`.

---

## Task 1: Shared types

**Files:**
- Create: `packages/predicate-eval/src/eval-types.ts`
- Test: `packages/predicate-eval/tests/eval-types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/eval-types.test.ts
import { describe, it, expect } from 'vitest';
import type { Question, ScoreRow } from '../src/eval-types.js';
import { isQuestion } from '../src/eval-types.js';

describe('eval-types', () => {
  it('isQuestion accepts a well-formed set question', () => {
    const q: Question = {
      id: 'org-q01', text: 'x', type: 'set',
      key: { derive: 'transitive', rel: 'reportsTo', from: 'person:dana' },
      needs_episode: 2, rule_under_test: ['r03'], reasoning_dependent: true,
      golden_sparql: 'SELECT ?p WHERE {}',
    };
    expect(isQuestion(q)).toBe(true);
  });

  it('isQuestion rejects a missing field', () => {
    expect(isQuestion({ id: 'x' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/eval-types.test.ts`
Expected: FAIL — cannot find module `../src/eval-types.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/eval-types.ts
export type ScoreType = 'set' | 'boolean' | 'path' | 'conflict';

export type KeySpec =
  | { derive: 'transitive'; rel: string; from: string }
  | { derive: 'direct'; rel: string; from: string }
  | { derive: 'boolean-conflict'; about: string }
  | { derive: 'conflict-ids'; about: string }
  | { derive: 'path'; edges: Array<[string, string, string]> };

export interface Question {
  id: string;
  text: string;
  type: ScoreType;
  key: KeySpec;
  needs_episode: number;
  rule_under_test: string[];
  reasoning_dependent: boolean;
  golden_sparql: string;
}

export type AnswerKey =
  | { kind: 'set'; values: Set<string> }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'conflict'; ids: Set<string> }
  | { kind: 'path'; edges: Array<[string, string, string]> };

export interface Score { f1: number; precision?: number; recall?: number; }

export interface Boundedness {
  triples: number;
  inferred: number;
  unusedConceptRatio: number;
  materializeMs: number;
}

export interface ScoreRow {
  runId: string;
  timestamp: string;
  domain: string;
  tier: 'tier1' | 'tier2';
  episode: number;
  inference: 'on' | 'off';
  accuracy: number;          // mean f1 across all questions
  lift?: number;             // set later when pairing on/off
  perQuestion: Record<string, number>;  // questionId -> f1
  boundedness: Boundedness;
  hostModel?: string;
}

export function isQuestion(x: unknown): x is Question {
  if (typeof x !== 'object' || x === null) return false;
  const q = x as Record<string, unknown>;
  return (
    typeof q.id === 'string' &&
    typeof q.text === 'string' &&
    typeof q.type === 'string' &&
    typeof q.key === 'object' && q.key !== null &&
    typeof q.needs_episode === 'number' &&
    Array.isArray(q.rule_under_test) &&
    typeof q.reasoning_dependent === 'boolean' &&
    typeof q.golden_sparql === 'string'
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/eval-types.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/eval-types.ts packages/predicate-eval/tests/eval-types.test.ts
git commit -m "feat(eval): shared eval types + Question guard"
```

---

## Task 2: Oracle loader + transitive-closure deriver

**Files:**
- Create: `packages/predicate-eval/src/oracle.ts`
- Test: `packages/predicate-eval/tests/oracle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/oracle.test.ts
import { describe, it, expect } from 'vitest';
import { transitiveClosure, deriveAnswerKey, type Oracle } from '../src/oracle.js';

const oracle: Oracle = {
  facts: [
    { s: 'person:dana', p: 'reportsTo', o: 'person:erin', episode: 1 },
    { s: 'person:erin', p: 'reportsTo', o: 'person:omar', episode: 2 },
    { s: 'person:omar', p: 'reportsTo', o: 'person:zoe',  episode: 3 },
  ],
  conflicts: [
    { id: 'c1', about: 'person:lee', predicate: 'reportsTo',
      values: ['person:omar', 'person:nadia'], episode: 4 },
  ],
  disjoint: [],
};

describe('transitiveClosure', () => {
  it('follows the relation only up to the episode cutoff', () => {
    expect([...transitiveClosure(oracle.facts, 'reportsTo', 'person:dana', 1)])
      .toEqual(['person:erin']);
    expect([...transitiveClosure(oracle.facts, 'reportsTo', 'person:dana', 3)].sort())
      .toEqual(['person:erin', 'person:omar', 'person:zoe']);
  });
});

describe('deriveAnswerKey', () => {
  it('derives a transitive set key', () => {
    const key = deriveAnswerKey(oracle,
      { derive: 'transitive', rel: 'reportsTo', from: 'person:dana' }, 'set', 2);
    expect(key).toEqual({ kind: 'set', values: new Set(['person:erin', 'person:omar']) });
  });

  it('derives conflict ids only after the conflict episode', () => {
    expect(deriveAnswerKey(oracle, { derive: 'conflict-ids', about: 'person:lee' }, 'conflict', 3))
      .toEqual({ kind: 'conflict', ids: new Set() });
    expect(deriveAnswerKey(oracle, { derive: 'conflict-ids', about: 'person:lee' }, 'conflict', 4))
      .toEqual({ kind: 'conflict', ids: new Set(['c1']) });
  });

  it('derives boolean-conflict', () => {
    expect(deriveAnswerKey(oracle, { derive: 'boolean-conflict', about: 'person:lee' }, 'boolean', 4))
      .toEqual({ kind: 'boolean', value: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/oracle.test.ts`
Expected: FAIL — cannot find module `../src/oracle.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/oracle.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnswerKey, KeySpec, ScoreType } from './eval-types.js';

export interface OracleFact { s: string; p: string; o: string; episode: number; }
export interface OracleConflict {
  id: string; about: string; predicate: string; values: string[]; episode: number;
}
export interface Oracle {
  facts: OracleFact[];
  conflicts: OracleConflict[];
  disjoint: Array<{ classes: string[] }>;
}

export function loadOracle(domainDir: string): Oracle {
  return JSON.parse(readFileSync(join(domainDir, 'oracle.json'), 'utf8')) as Oracle;
}

/** Nodes reachable from `from` via `rel`, using only facts with episode <= cutoff. */
export function transitiveClosure(
  facts: OracleFact[], rel: string, from: string, cutoff: number,
): Set<string> {
  const edges = facts.filter((f) => f.p === rel && f.episode <= cutoff);
  const out = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const e of edges) {
      if (e.s === cur && !out.has(e.o)) { out.add(e.o); stack.push(e.o); }
    }
  }
  return out;
}

function directSet(facts: OracleFact[], rel: string, from: string, cutoff: number): Set<string> {
  return new Set(
    facts.filter((f) => f.p === rel && f.s === from && f.episode <= cutoff).map((f) => f.o),
  );
}

export function deriveAnswerKey(
  oracle: Oracle, key: KeySpec, type: ScoreType, cutoff: number,
): AnswerKey {
  switch (key.derive) {
    case 'transitive':
      return { kind: 'set', values: transitiveClosure(oracle.facts, key.rel, key.from, cutoff) };
    case 'direct':
      return { kind: 'set', values: directSet(oracle.facts, key.rel, key.from, cutoff) };
    case 'conflict-ids':
      return {
        kind: 'conflict',
        ids: new Set(
          oracle.conflicts.filter((c) => c.about === key.about && c.episode <= cutoff).map((c) => c.id),
        ),
      };
    case 'boolean-conflict':
      return {
        kind: 'boolean',
        value: oracle.conflicts.some((c) => c.about === key.about && c.episode <= cutoff),
      };
    case 'path':
      return { kind: 'path', edges: key.edges };
    default: {
      const _exhaustive: never = key;
      throw new Error(`unknown key derive: ${JSON.stringify(_exhaustive)} (type=${type})`);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/oracle.test.ts`
Expected: PASS (5 assertions across 4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/oracle.ts packages/predicate-eval/tests/oracle.test.ts
git commit -m "feat(eval): oracle loader + episode-cutoff answer-key derivation"
```

---

## Task 3: Scorers

**Files:**
- Create: `packages/predicate-eval/src/scorer.ts`
- Test: `packages/predicate-eval/tests/scorer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scorer.test.ts
import { describe, it, expect } from 'vitest';
import { scoreSet, scoreBoolean, scoreConflict, scorePath } from '../src/scorer.js';

describe('scoreSet', () => {
  it('exact match is f1 1', () => {
    expect(scoreSet(new Set(['a', 'b']), new Set(['a', 'b'])).f1).toBe(1);
  });
  it('partial overlap gives partial f1', () => {
    const s = scoreSet(new Set(['a', 'b']), new Set(['a', 'c']));
    expect(s.precision).toBeCloseTo(0.5);
    expect(s.recall).toBeCloseTo(0.5);
    expect(s.f1).toBeCloseTo(0.5);
  });
  it('two empty sets are a perfect (vacuous) match', () => {
    expect(scoreSet(new Set(), new Set()).f1).toBe(1);
  });
});

describe('scoreBoolean', () => {
  it('match is 1, mismatch is 0', () => {
    expect(scoreBoolean(true, true).f1).toBe(1);
    expect(scoreBoolean(true, false).f1).toBe(0);
  });
});

describe('scoreConflict', () => {
  it('penalizes inventing a conflict not in the oracle', () => {
    expect(scoreConflict(new Set(), new Set(['c1'])).f1).toBe(0);
  });
  it('rewards flagging the real conflict', () => {
    expect(scoreConflict(new Set(['c1']), new Set(['c1'])).f1).toBe(1);
  });
});

describe('scorePath', () => {
  it('is 1 when expected edge sequence is an ordered subsequence of the returned path', () => {
    const exp: Array<[string, string, string]> = [['a', 'p', 'b'], ['b', 'p', 'c']];
    const got: Array<[string, string, string]> = [['a', 'p', 'b'], ['x', 'q', 'y'], ['b', 'p', 'c']];
    expect(scorePath(exp, got).f1).toBe(1);
  });
  it('is 0 when order is broken', () => {
    const exp: Array<[string, string, string]> = [['a', 'p', 'b'], ['b', 'p', 'c']];
    const got: Array<[string, string, string]> = [['b', 'p', 'c'], ['a', 'p', 'b']];
    expect(scorePath(exp, got).f1).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/scorer.test.ts`
Expected: FAIL — cannot find module `../src/scorer.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/scorer.ts
import type { Score } from './eval-types.js';

export function scoreSet(expected: Set<string>, got: Set<string>): Score {
  if (expected.size === 0 && got.size === 0) return { f1: 1, precision: 1, recall: 1 };
  let tp = 0;
  for (const g of got) if (expected.has(g)) tp++;
  const precision = got.size === 0 ? 0 : tp / got.size;
  const recall = expected.size === 0 ? 0 : tp / expected.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { f1, precision, recall };
}

export function scoreBoolean(expected: boolean, got: boolean): Score {
  return { f1: expected === got ? 1 : 0 };
}

/** Conflict is a set-membership problem over conflict ids (false positives punished by precision). */
export function scoreConflict(expectedIds: Set<string>, flaggedIds: Set<string>): Score {
  return scoreSet(expectedIds, flaggedIds);
}

/** Ordered-subsequence match: every expected edge appears in `got` in the same relative order. */
export function scorePath(
  expected: Array<[string, string, string]>, got: Array<[string, string, string]>,
): Score {
  const eq = (a: [string, string, string], b: [string, string, string]) =>
    a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  let i = 0;
  for (const g of got) { if (i < expected.length && eq(expected[i]!, g)) i++; }
  return { f1: i === expected.length ? 1 : 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/scorer.test.ts`
Expected: PASS (9 assertions).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/scorer.ts packages/predicate-eval/tests/scorer.test.ts
git commit -m "feat(eval): set/boolean/conflict/path scorers"
```

---

## Task 4: Episode runner (apply + materialize/control)

**Files:**
- Create: `packages/predicate-eval/src/episode-runner.ts`
- Test: `packages/predicate-eval/tests/episode-runner.test.ts`

Episode files are JSONL; each line is `{"s":"<iri>","p":"<iri>","o":"<iri>"}` (objects are IRIs in the v1 domains). The runner converts a batch to N-Triples and bulk-loads into `kg:abox`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/episode-runner.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { applyEpisodeTriples, rematerialize } from '../src/episode-runner.js';

const client = getAdapter();

beforeEach(async () => {
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:inferred>');
  await client.update('CREATE SILENT GRAPH <kg:inferred>');
});

describe('applyEpisodeTriples', () => {
  it('loads triples into kg:abox', async () => {
    await applyEpisodeTriples(client, [
      { s: 'http://ex/dana', p: 'http://ex/reportsTo', o: 'http://ex/erin' },
    ]);
    const ok = await client.ask(
      'ASK { GRAPH <kg:abox> { <http://ex/dana> <http://ex/reportsTo> <http://ex/erin> } }');
    expect(ok).toBe(true);
  });
});

describe('rematerialize', () => {
  it('control (inference off) leaves kg:inferred empty', async () => {
    await rematerialize(client, false);
    const r = await client.select('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:inferred> { ?s ?p ?o } }');
    expect(Number(r.results.bindings[0]!.n!.value)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/episode-runner.test.ts`
Expected: FAIL — cannot find module `../src/episode-runner.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/episode-runner.ts
import { readFileSync } from 'node:fs';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';

export interface EpisodeTriple { s: string; p: string; o: string; }

export function readEpisode(path: string): EpisodeTriple[] {
  return readFileSync(path, 'utf8')
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => JSON.parse(l) as EpisodeTriple);
}

function toNTriples(triples: EpisodeTriple[]): string {
  return triples.map((t) => `<${t.s}> <${t.p}> <${t.o}> .`).join('\n');
}

export async function applyEpisodeTriples(
  client: StorageAdapter, triples: EpisodeTriple[],
): Promise<void> {
  if (triples.length === 0) return;
  await client.loadTurtle(toNTriples(triples), 'kg:abox');
}

/** Returns the materialize elapsed time in ms (0 for the control path). */
export async function rematerialize(client: StorageAdapter, inference: boolean): Promise<number> {
  if (!inference) {
    await client.update('DROP SILENT GRAPH <kg:inferred>');
    await client.update('CREATE SILENT GRAPH <kg:inferred>');
    return 0;
  }
  const res = await new FusekiConstructAdapter(client).materialize({
    tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5,
  });
  return res.elapsedMs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/episode-runner.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/episode-runner.ts packages/predicate-eval/tests/episode-runner.test.ts
git commit -m "feat(eval): episode runner with inference-off control path"
```

---

## Task 5: Boundedness metrics

**Files:**
- Create: `packages/predicate-eval/src/metrics.ts`
- Test: `packages/predicate-eval/tests/metrics.test.ts`

`unusedConceptRatio` = (TBox classes/properties with zero references in `kg:usage`) / (total TBox classes/properties). In Plan A `kg:usage` is empty (no live queries logged), so the ratio is 1.0 by definition unless a fixture pre-seeds usage; the test asserts the formula, not a magic value.

- [ ] **Step 1: Write the failing test**

```ts
// tests/metrics.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { countTriples, unusedConceptRatio, collectMetrics } from '../src/metrics.js';

const client = getAdapter();

beforeEach(async () => {
  for (const g of ['kg:abox', 'kg:inferred', 'kg:tbox', 'kg:usage']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
});

describe('countTriples', () => {
  it('counts triples in a named graph', async () => {
    await client.loadTurtle('<http://ex/a> <http://ex/p> <http://ex/b> .', 'kg:abox');
    expect(await countTriples(client, 'kg:abox')).toBe(1);
  });
});

describe('unusedConceptRatio', () => {
  it('is 1 when a class exists in tbox but is never referenced in usage', async () => {
    await client.loadTurtle(
      '<http://ex/C> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ' +
      '<http://www.w3.org/2002/07/owl#Class> .', 'kg:tbox');
    expect(await unusedConceptRatio(client)).toBe(1);
  });
  it('is 0 when there are no concepts (avoids divide-by-zero)', async () => {
    expect(await unusedConceptRatio(client)).toBe(0);
  });
});

describe('collectMetrics', () => {
  it('assembles a Boundedness record', async () => {
    const m = await collectMetrics(client, 42);
    expect(m).toEqual({ triples: 0, inferred: 0, unusedConceptRatio: 0, materializeMs: 42 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/metrics.test.ts`
Expected: FAIL — cannot find module `../src/metrics.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/metrics.ts
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import type { Boundedness } from './eval-types.js';

export async function countTriples(client: StorageAdapter, graph: string): Promise<number> {
  const r = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${graph}> { ?s ?p ?o } }`);
  return Number(r.results.bindings[0]?.n?.value ?? 0);
}

/** Fraction of declared TBox classes+properties never referenced by a logged usage query. */
export async function unusedConceptRatio(client: StorageAdapter): Promise<number> {
  const total = await client.select(`
    SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { GRAPH <kg:tbox> {
      ?c a ?t .
      FILTER(?t IN (
        <http://www.w3.org/2002/07/owl#Class>,
        <http://www.w3.org/2002/07/owl#ObjectProperty>,
        <http://www.w3.org/2002/07/owl#DatatypeProperty>)) } }`);
  const totalN = Number(total.results.bindings[0]?.n?.value ?? 0);
  if (totalN === 0) return 0;
  const used = await client.select(`
    SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
      GRAPH <kg:tbox> {
        ?c a ?t .
        FILTER(?t IN (
          <http://www.w3.org/2002/07/owl#Class>,
          <http://www.w3.org/2002/07/owl#ObjectProperty>,
          <http://www.w3.org/2002/07/owl#DatatypeProperty>)) }
      GRAPH <kg:usage> { ?u ?up ?sparql . FILTER(isLiteral(?sparql) && CONTAINS(STR(?sparql), STR(?c))) } }`);
  const usedN = Number(used.results.bindings[0]?.n?.value ?? 0);
  return (totalN - usedN) / totalN;
}

export async function collectMetrics(
  client: StorageAdapter, materializeMs: number,
): Promise<Boundedness> {
  return {
    triples: await countTriples(client, 'kg:abox'),
    inferred: await countTriples(client, 'kg:inferred'),
    unusedConceptRatio: await unusedConceptRatio(client),
    materializeMs,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/metrics.test.ts`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/metrics.ts packages/predicate-eval/tests/metrics.test.ts
git commit -m "feat(eval): boundedness metrics (triples, unused-concept ratio, latency)"
```

---

## Task 6: Organizational fixture (world, oracle, episodes, questions)

**Files:**
- Create: `packages/predicate-eval/fixtures/org/world.ttl`
- Create: `packages/predicate-eval/fixtures/org/oracle.json`
- Create: `packages/predicate-eval/fixtures/org/episodes/e01.jsonl` … `e04.jsonl`
- Create: `packages/predicate-eval/fixtures/org/questions.json`
- Test: `packages/predicate-eval/tests/fixture-org.test.ts`

Namespace: `http://ex/org#` for the TBox, `http://ex/org/` for individuals. Four episodes drip the reporting chain and a dual-manager conflict.

- [ ] **Step 1: Create `world.ttl` (TBox + disjointness + functional manager)**

```turtle
@prefix org:  <http://ex/org#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

org:Person     a owl:Class .
org:Team       a owl:Class .
org:Project    a owl:Class .
org:Contractor a owl:Class ; rdfs:subClassOf org:Person .
org:FullTime   a owl:Class ; rdfs:subClassOf org:Person .
org:Contractor owl:disjointWith org:FullTime .

org:reportsTo a owl:ObjectProperty, owl:TransitiveProperty ;
  rdfs:domain org:Person ; rdfs:range org:Person .
org:manages a owl:ObjectProperty ; owl:inverseOf org:reportsTo .
org:memberOf a owl:ObjectProperty ; rdfs:domain org:Person ; rdfs:range org:Team .
org:ownerOf  a owl:ObjectProperty, owl:FunctionalProperty ;
  rdfs:domain org:Project ; rdfs:range org:Person .
```

- [ ] **Step 2: Create `oracle.json`**

```json
{
  "facts": [
    { "s": "http://ex/org/dana", "p": "http://ex/org#reportsTo", "o": "http://ex/org/erin", "episode": 1 },
    { "s": "http://ex/org/erin", "p": "http://ex/org#reportsTo", "o": "http://ex/org/omar", "episode": 2 },
    { "s": "http://ex/org/omar", "p": "http://ex/org#reportsTo", "o": "http://ex/org/zoe",  "episode": 3 },
    { "s": "http://ex/org/dana", "p": "http://ex/org#memberOf",  "o": "http://ex/org/payments", "episode": 1 }
  ],
  "conflicts": [
    { "id": "c1", "about": "http://ex/org/lee", "predicate": "http://ex/org#reportsTo",
      "values": ["http://ex/org/omar", "http://ex/org/nadia"], "episode": 4 }
  ],
  "disjoint": [{ "classes": ["http://ex/org#Contractor", "http://ex/org#FullTime"] }]
}
```

- [ ] **Step 3: Create episodes** (each line a triple; mirror `oracle.json` so the fixture-integrity test passes)

`episodes/e01.jsonl`:
```
{"s":"http://ex/org/dana","p":"http://www.w3.org/1999/02/22-rdf-syntax-ns#type","o":"http://ex/org#Person"}
{"s":"http://ex/org/erin","p":"http://www.w3.org/1999/02/22-rdf-syntax-ns#type","o":"http://ex/org#Person"}
{"s":"http://ex/org/dana","p":"http://ex/org#reportsTo","o":"http://ex/org/erin"}
{"s":"http://ex/org/dana","p":"http://ex/org#memberOf","o":"http://ex/org/payments"}
```

`episodes/e02.jsonl`:
```
{"s":"http://ex/org/omar","p":"http://www.w3.org/1999/02/22-rdf-syntax-ns#type","o":"http://ex/org#Person"}
{"s":"http://ex/org/erin","p":"http://ex/org#reportsTo","o":"http://ex/org/omar"}
```

`episodes/e03.jsonl`:
```
{"s":"http://ex/org/zoe","p":"http://www.w3.org/1999/02/22-rdf-syntax-ns#type","o":"http://ex/org#Person"}
{"s":"http://ex/org/omar","p":"http://ex/org#reportsTo","o":"http://ex/org/zoe"}
```

`episodes/e04.jsonl`:
```
{"s":"http://ex/org/lee","p":"http://ex/org#reportsTo","o":"http://ex/org/omar"}
{"s":"http://ex/org/lee","p":"http://ex/org#reportsTo","o":"http://ex/org/nadia"}
```

- [ ] **Step 4: Create `questions.json`**

```json
[
  {
    "id": "org-q01",
    "text": "Who is in Dana's management chain?",
    "type": "set",
    "key": { "derive": "transitive", "rel": "http://ex/org#reportsTo", "from": "http://ex/org/dana" },
    "needs_episode": 1,
    "rule_under_test": ["r03"],
    "reasoning_dependent": true,
    "golden_sparql": "SELECT ?p WHERE { GRAPH <kg:inferred> { <http://ex/org/dana> <http://ex/org#reportsTo> ?p } }"
  },
  {
    "id": "org-q02",
    "text": "Does Lee have conflicting managers?",
    "type": "boolean",
    "key": { "derive": "boolean-conflict", "about": "http://ex/org/lee" },
    "needs_episode": 4,
    "rule_under_test": ["r08", "r21"],
    "reasoning_dependent": true,
    "golden_sparql": "ASK { GRAPH <kg:inferred> { ?c <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://industriagents.com/predicate/judgment#UnresolvedConflict> } UNION { GRAPH <kg:abox> { <http://ex/org/lee> <http://ex/org#reportsTo> ?a, ?b . FILTER(?a != ?b) } } }"
  }
]
```

> Note: `org-q01`'s golden query reads `kg:inferred`, so under the inference-OFF control it returns empty → f1 0, which is exactly the reasoning-lift signal. The transitive-property rule (r03) materializes `dana reportsTo {erin,omar,zoe}` into `kg:inferred`.

- [ ] **Step 5: Write the fixture-integrity test**

```ts
// tests/fixture-org.test.ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadOracle, deriveAnswerKey } from '../src/oracle.js';
import { loadQuestions } from '../src/questions.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('org fixture integrity', () => {
  const oracle = loadOracle(DIR);
  const questions = loadQuestions(DIR);

  it('every question is unanswerable before needs_episode and answerable at/after it', () => {
    for (const q of questions) {
      const before = deriveAnswerKey(oracle, q.key, q.type, q.needs_episode - 1);
      const at = deriveAnswerKey(oracle, q.key, q.type, q.needs_episode);
      if (q.type === 'set') {
        expect((before as { values: Set<string> }).values.size)
          .toBeLessThan((at as { values: Set<string> }).values.size);
      } else if (q.type === 'boolean') {
        expect((before as { value: boolean }).value).toBe(false);
        expect((at as { value: boolean }).value).toBe(true);
      }
    }
  });
});
```

(Depends on Task 7's `loadQuestions`; if executing strictly in order, write Task 7 first or stub the import — recommended order is Task 7 then 6's test, but the fixture files in steps 1–4 have no code dependency.)

- [ ] **Step 6: Run the integrity test to verify it passes** (after Task 7 lands)

Run: `pnpm --filter predicate-eval exec vitest run tests/fixture-org.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-eval/fixtures/org packages/predicate-eval/tests/fixture-org.test.ts
git commit -m "feat(eval): organizational fixture world + oracle + episodes + questions"
```

---

## Task 7: Questions loader

**Files:**
- Create: `packages/predicate-eval/src/questions.ts`
- Test: `packages/predicate-eval/tests/questions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/questions.test.ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadQuestions } from '../src/questions.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('loadQuestions', () => {
  it('loads and validates org questions', () => {
    const qs = loadQuestions(DIR);
    expect(qs.length).toBeGreaterThanOrEqual(2);
    expect(qs.find((q) => q.id === 'org-q01')?.type).toBe('set');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/questions.test.ts`
Expected: FAIL — cannot find module `../src/questions.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/questions.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Question, isQuestion } from './eval-types.js';

export function loadQuestions(domainDir: string): Question[] {
  const raw = JSON.parse(readFileSync(join(domainDir, 'questions.json'), 'utf8'));
  if (!Array.isArray(raw)) throw new Error('questions.json must be an array');
  for (const q of raw) {
    if (!isQuestion(q)) throw new Error(`invalid question: ${JSON.stringify(q)}`);
  }
  return raw as Question[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/questions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/questions.ts packages/predicate-eval/tests/questions.test.ts
git commit -m "feat(eval): questions.json loader + validation"
```

---

## Task 8: Tier-1 deterministic rig (executes golden SPARQL, scores, pairs on/off lift)

**Files:**
- Create: `packages/predicate-eval/src/rigs/tier1-deterministic.ts`
- Test: `packages/predicate-eval/tests/tier1-org.test.ts`

The rig: load `world.ttl` into `kg:tbox`; reset `kg:abox`/`kg:inferred`; for each episode 1..N, for each `inference ∈ {on, off}`, replay episodes 1..N, materialize/skip, run each question's `golden_sparql`, derive the matching answer key at cutoff N, score, then collect metrics. Returns one `ScoreRow` per `(episode, inference)`, with `lift` filled on the `on` rows.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tier1-org.test.ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runTier1 } from '../src/rigs/tier1-deterministic.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('tier1 org run', () => {
  it('accuracy rises across episodes and reasoning lift is positive', async () => {
    const rows = await runTier1(getAdapter(), 'org', DIR, 4);
    const on = rows.filter((r) => r.inference === 'on').sort((a, b) => a.episode - b.episode);
    expect(on[0]!.accuracy).toBeLessThan(on[on.length - 1]!.accuracy);  // compounding
    const finalOn = on[on.length - 1]!;
    expect(finalOn.lift!).toBeGreaterThan(0);                            // reasoning earns its keep
    expect(finalOn.accuracy).toBeGreaterThan(0.5);
  }, 30_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier1-org.test.ts`
Expected: FAIL — cannot find module `../src/rigs/tier1-deterministic.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/rigs/tier1-deterministic.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadOracle, deriveAnswerKey } from '../oracle.js';
import { loadQuestions } from '../questions.js';
import { readEpisode, applyEpisodeTriples, rematerialize } from '../episode-runner.js';
import { collectMetrics } from '../metrics.js';
import { scoreSet, scoreBoolean, scoreConflict } from '../scorer.js';
import type { Question, ScoreRow, AnswerKey } from '../eval-types.js';

function episodePaths(domainDir: string): string[] {
  return readdirSync(join(domainDir, 'episodes'))
    .filter((f) => f.endsWith('.jsonl')).sort()
    .map((f) => join(domainDir, 'episodes', f));
}

async function runGolden(client: StorageAdapter, q: Question): Promise<AnswerKey> {
  if (q.type === 'boolean') return { kind: 'boolean', value: await client.ask(q.golden_sparql) };
  if (q.type === 'conflict') {
    const r = await client.select(q.golden_sparql);
    return { kind: 'conflict', ids: new Set(r.results.bindings.map((b) => Object.values(b)[0]!.value)) };
  }
  const r = await client.select(q.golden_sparql);
  const vals = r.results.bindings.map((b) => Object.values(b)[0]!.value);
  return { kind: 'set', values: new Set(vals) };
}

function score(expected: AnswerKey, got: AnswerKey): number {
  if (expected.kind === 'set' && got.kind === 'set') return scoreSet(expected.values, got.values).f1;
  if (expected.kind === 'boolean' && got.kind === 'boolean') return scoreBoolean(expected.value, got.value).f1;
  if (expected.kind === 'conflict' && got.kind === 'conflict') return scoreConflict(expected.ids, got.ids).f1;
  return 0;
}

export async function runTier1(
  client: StorageAdapter, domain: string, domainDir: string, episodes: number,
): Promise<ScoreRow[]> {
  const oracle = loadOracle(domainDir);
  const questions = loadQuestions(domainDir);
  const world = readFileSync(join(domainDir, 'world.ttl'), 'utf8');
  const paths = episodePaths(domainDir);
  const runId = `${domain}-${Date.now()}`;
  const rows: ScoreRow[] = [];

  for (let ep = 1; ep <= episodes; ep++) {
    const accByInference: Record<'on' | 'off', number> = { on: 0, off: 0 };
    for (const inference of ['on', 'off'] as const) {
      // Fresh world, replay episodes 1..ep
      for (const g of ['kg:tbox', 'kg:abox', 'kg:inferred', 'kg:usage']) {
        await client.update(`DROP SILENT GRAPH <${g}>`);
        await client.update(`CREATE SILENT GRAPH <${g}>`);
      }
      await client.loadTurtle(world, 'kg:tbox');
      for (let i = 0; i < ep; i++) await applyEpisodeTriples(client, readEpisode(paths[i]!));
      const ms = await rematerialize(client, inference === 'on');

      const perQuestion: Record<string, number> = {};
      let sum = 0;
      for (const q of questions) {
        const expected = deriveAnswerKey(oracle, q.key, q.type, ep);
        const got = await runGolden(client, q);
        const f1 = score(expected, got);
        perQuestion[q.id] = f1;
        sum += f1;
      }
      const accuracy = questions.length ? sum / questions.length : 0;
      accByInference[inference] = accuracy;
      rows.push({
        runId, timestamp: new Date().toISOString(), domain, tier: 'tier1',
        episode: ep, inference, accuracy, perQuestion,
        boundedness: await collectMetrics(client, ms),
      });
    }
    // fill lift on the matching 'on' row
    const onRow = rows.find((r) => r.episode === ep && r.inference === 'on')!;
    onRow.lift = accByInference.on - accByInference.off;
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier1-org.test.ts`
Expected: PASS. If `org-q01` returns 0 even with inference on, verify r03 (transitive property) materializes into `kg:inferred` — check the rule fires for `org:reportsTo a owl:TransitiveProperty`.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/rigs/tier1-deterministic.ts packages/predicate-eval/tests/tier1-org.test.ts
git commit -m "feat(eval): tier-1 deterministic rig with compounding curve + reasoning lift"
```

---

## Task 9: Reporter (scoreboard JSONL + ASCII curve)

**Files:**
- Create: `packages/predicate-eval/src/report.ts`
- Test: `packages/predicate-eval/tests/report.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/report.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendScoreboard, renderCurve } from '../src/report.js';
import type { ScoreRow } from '../src/eval-types.js';

function row(ep: number, acc: number): ScoreRow {
  return {
    runId: 'r1', timestamp: 't', domain: 'org', tier: 'tier1', episode: ep,
    inference: 'on', accuracy: acc, lift: acc, perQuestion: {},
    boundedness: { triples: 0, inferred: 0, unusedConceptRatio: 0, materializeMs: 0 },
  };
}

describe('report', () => {
  it('appends one JSONL line per row', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-'));
    const file = join(dir, 'scoreboard.jsonl');
    appendScoreboard([row(1, 0.2), row(2, 0.8)], file);
    expect(readFileSync(file, 'utf8').trim().split('\n').length).toBe(2);
  });

  it('renders an ascii curve containing the domain and episode markers', () => {
    const out = renderCurve([row(1, 0.2), row(2, 0.8)]);
    expect(out).toContain('org');
    expect(out).toMatch(/e1|e2/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/report.test.ts`
Expected: FAIL — cannot find module `../src/report.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/report.ts
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ScoreRow } from './eval-types.js';

const DEFAULT_FILE = join(import.meta.dirname, '..', 'results', 'scoreboard.jsonl');

export function appendScoreboard(rows: ScoreRow[], file: string = DEFAULT_FILE): void {
  mkdirSync(dirname(file), { recursive: true });
  for (const r of rows) appendFileSync(file, JSON.stringify(r) + '\n');
}

/** ASCII curve of accuracy (and lift) vs episode, for the inference-on rows. */
export function renderCurve(rows: ScoreRow[]): string {
  const on = rows.filter((r) => r.inference === 'on').sort((a, b) => a.episode - b.episode);
  if (on.length === 0) return '(no rows)';
  const domain = on[0]!.domain;
  const lines = [`domain: ${domain}  (accuracy ●  lift ·)`];
  for (const r of on) {
    const acc = Math.round(r.accuracy * 20);
    const lift = Math.round((r.lift ?? 0) * 20);
    const bar = Array.from({ length: 20 }, (_, i) =>
      i < acc ? '●' : i < lift ? '·' : ' ').join('');
    lines.push(`e${r.episode} |${bar}| acc=${r.accuracy.toFixed(2)} lift=${(r.lift ?? 0).toFixed(2)}`);
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/report.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/report.ts packages/predicate-eval/tests/report.test.ts
git commit -m "feat(eval): scoreboard JSONL writer + ascii compounding-curve renderer"
```

---

## Task 10: `eval` CLI entrypoint + npm script

**Files:**
- Create: `packages/predicate-eval/src/eval.ts`
- Modify: `packages/predicate-eval/package.json` (add `"eval": "tsx src/eval.ts"` to scripts)
- Test: `packages/predicate-eval/tests/eval-cli.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/eval-cli.test.ts
import { describe, it, expect } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runEval } from '../src/eval.js';

describe('runEval', () => {
  it('runs the org domain and returns rows with a printable curve', async () => {
    const { rows, curve } = await runEval(getAdapter(), 'org', { episodes: 4, write: false });
    expect(rows.length).toBe(8);          // 4 episodes x {on, off}
    expect(curve).toContain('org');
  }, 30_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/eval-cli.test.ts`
Expected: FAIL — cannot find module `../src/eval.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/eval.ts
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runTier1 } from './rigs/tier1-deterministic.js';
import { appendScoreboard, renderCurve } from './report.js';
import type { ScoreRow } from './eval-types.js';

const DOMAINS: Record<string, { episodes: number }> = {
  org: { episodes: 4 },
  research: { episodes: 4 },
  coding: { episodes: 3 },
};

export async function runEval(
  client: StorageAdapter, domain: string, opts: { episodes?: number; write?: boolean } = {},
): Promise<{ rows: ScoreRow[]; curve: string }> {
  const cfg = DOMAINS[domain];
  if (!cfg) throw new Error(`unknown domain: ${domain}`);
  const dir = join(import.meta.dirname, '..', 'fixtures', domain);
  const rows = await runTier1(client, domain, dir, opts.episodes ?? cfg.episodes);
  if (opts.write !== false) appendScoreboard(rows);
  return { rows, curve: renderCurve(rows) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const domain = process.argv[2] ?? 'org';
  runEval(getAdapter(), domain).then(({ curve }) => { console.log(curve); })
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: Add the npm script**

In `packages/predicate-eval/package.json` `"scripts"`, add:
```json
    "eval": "tsx src/eval.ts",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/eval-cli.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-eval/src/eval.ts packages/predicate-eval/package.json packages/predicate-eval/tests/eval-cli.test.ts
git commit -m "feat(eval): runEval entrypoint + 'pnpm --filter predicate-eval eval <domain>'"
```

---

## Task 11: Research-provenance fixture

**Files:**
- Create: `packages/predicate-eval/fixtures/research/world.ttl`
- Create: `packages/predicate-eval/fixtures/research/oracle.json`
- Create: `packages/predicate-eval/fixtures/research/episodes/e01..e04.jsonl`
- Create: `packages/predicate-eval/fixtures/research/questions.json`
- Test: `packages/predicate-eval/tests/fixture-research.test.ts`

Namespace `http://ex/res#` (TBox) / `http://ex/res/` (individuals). Models citation chains (transitive `influencedBy`), inverse `cites`/`citedBy`, and a superseded finding.

- [ ] **Step 1: Create `world.ttl`**

```turtle
@prefix res:  <http://ex/res#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

res:Paper   a owl:Class .
res:Claim   a owl:Class .
res:cites        a owl:ObjectProperty ; rdfs:domain res:Paper ; rdfs:range res:Paper .
res:citedBy      a owl:ObjectProperty ; owl:inverseOf res:cites .
res:influencedBy a owl:ObjectProperty, owl:TransitiveProperty ;
  rdfs:domain res:Paper ; rdfs:range res:Paper .
res:supersededBy a owl:ObjectProperty ; rdfs:domain res:Claim ; rdfs:range res:Claim .
res:about        a owl:ObjectProperty .
```

- [ ] **Step 2: Create `oracle.json`** (transitive influence chain p1→p2→p3→p4; one superseded claim)

```json
{
  "facts": [
    { "s": "http://ex/res/p1", "p": "http://ex/res#influencedBy", "o": "http://ex/res/p2", "episode": 1 },
    { "s": "http://ex/res/p2", "p": "http://ex/res#influencedBy", "o": "http://ex/res/p3", "episode": 2 },
    { "s": "http://ex/res/p3", "p": "http://ex/res#influencedBy", "o": "http://ex/res/p4", "episode": 3 },
    { "s": "http://ex/res/p1", "p": "http://ex/res#cites", "o": "http://ex/res/p2", "episode": 1 }
  ],
  "conflicts": [
    { "id": "rc1", "about": "http://ex/res/mortalityClaim", "predicate": "http://ex/res#value",
      "values": ["reduces", "increases"], "episode": 4 }
  ],
  "disjoint": []
}
```

- [ ] **Step 3: Create episodes** mirroring oracle facts (one `.jsonl` per episode, same triple shape as Task 6; episode 4 introduces two contradictory `value` literals — note these are literals, so emit them as N-Triples with quoted objects; see the literal handling note below).

`episodes/e04.jsonl`:
```
{"s":"http://ex/res/claimA","p":"http://ex/res#about","o":"http://ex/res/mortalityClaim"}
{"s":"http://ex/res/claimB","p":"http://ex/res#about","o":"http://ex/res/mortalityClaim"}
```

> **Literal handling:** `episode-runner` currently emits objects as IRIs. For the contradictory *values* in this domain, model them as distinct claim resources both `res:about` the same subject (as above) rather than literals, so no runner change is needed. The conflict question keys off two claims about one subject. If literal objects become necessary for another domain later, extend `EpisodeTriple` with an optional `lit: boolean` and branch in `toNTriples` — out of scope here.

- [ ] **Step 4: Create `questions.json`** with at least: a transitive `influencedBy` set question (`needs_episode` 1, reasoning_dependent true, golden query against `kg:inferred`) and a conflict question (`needs_episode` 4). Follow the exact shape from Task 6 step 4.

```json
[
  {
    "id": "res-q01",
    "text": "What papers influenced p1 (transitively)?",
    "type": "set",
    "key": { "derive": "transitive", "rel": "http://ex/res#influencedBy", "from": "http://ex/res/p1" },
    "needs_episode": 1,
    "rule_under_test": ["r03"],
    "reasoning_dependent": true,
    "golden_sparql": "SELECT ?p WHERE { GRAPH <kg:inferred> { <http://ex/res/p1> <http://ex/res#influencedBy> ?p } }"
  },
  {
    "id": "res-q02",
    "text": "Are there contradictory claims about the mortality finding?",
    "type": "boolean",
    "key": { "derive": "boolean-conflict", "about": "http://ex/res/mortalityClaim" },
    "needs_episode": 4,
    "rule_under_test": ["r21"],
    "reasoning_dependent": false,
    "golden_sparql": "ASK { GRAPH <kg:abox> { ?a <http://ex/res#about> <http://ex/res/mortalityClaim> . ?b <http://ex/res#about> <http://ex/res/mortalityClaim> . FILTER(?a != ?b) } }"
  }
]
```

- [ ] **Step 5: Write `tests/fixture-research.test.ts`** — copy the structure of `tests/fixture-org.test.ts` (Task 6 step 5) but point `DIR` at `fixtures/research`. (Repeat the full test body; do not import from the org test.)

```ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadOracle, deriveAnswerKey } from '../src/oracle.js';
import { loadQuestions } from '../src/questions.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'research');

describe('research fixture integrity', () => {
  const oracle = loadOracle(DIR);
  const questions = loadQuestions(DIR);
  it('every question is unanswerable before needs_episode and answerable at/after it', () => {
    for (const q of questions) {
      const before = deriveAnswerKey(oracle, q.key, q.type, q.needs_episode - 1);
      const at = deriveAnswerKey(oracle, q.key, q.type, q.needs_episode);
      if (q.type === 'set') {
        expect((before as { values: Set<string> }).values.size)
          .toBeLessThan((at as { values: Set<string> }).values.size);
      } else if (q.type === 'boolean') {
        expect((before as { value: boolean }).value).toBe(false);
        expect((at as { value: boolean }).value).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 6: Run** `pnpm --filter predicate-eval exec vitest run tests/fixture-research.test.ts` → Expected PASS. Then `pnpm --filter predicate-eval exec vitest run tests/eval-cli.test.ts` after adding a research case (already in `DOMAINS`).

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-eval/fixtures/research packages/predicate-eval/tests/fixture-research.test.ts
git commit -m "feat(eval): research-provenance fixture (citation chains + contradiction)"
```

---

## Task 12: Coding seed fixture (pluggability proof)

**Files:**
- Create: `packages/predicate-eval/fixtures/coding/world.ttl` (reuse the codebase TBox: copy `packages/predicate-ontology/catalog/codebase.ttl` content, or load it in the rig — see step note)
- Create: `packages/predicate-eval/fixtures/coding/oracle.json`
- Create: `packages/predicate-eval/fixtures/coding/episodes/e01..e03.jsonl`
- Create: `packages/predicate-eval/fixtures/coding/questions.json`
- Test: `packages/predicate-eval/tests/fixture-coding.test.ts`

Use codebase namespace `https://industriagents.com/predicate/codebase#` (predicate `imports` is transitive-capable via the existing TBox). Episodes drip an import chain `auth.ts → jwt.ts → crypto.ts`.

- [ ] **Step 1: Create `world.ttl`** by copying the codebase TBox so the fixture is self-contained:

```bash
cp packages/predicate-ontology/catalog/codebase.ttl packages/predicate-eval/fixtures/coding/world.ttl
```

> If `imports` is not declared `owl:TransitiveProperty` in `codebase.ttl`, the transitive question must instead target an existing transitive predicate (e.g. `dependsOn`). Verify by grepping `codebase.ttl` for `TransitiveProperty`; pick a predicate that is transitive for the transitive question, and use `imports` only for a `direct` question.

- [ ] **Step 2–4: Create `oracle.json`, `episodes/*.jsonl`, `questions.json`** following the exact shapes from Task 6 steps 2–4, using codebase IRIs. Include one transitive dependency question (reasoning_dependent true) and one direct `imports` question (reasoning_dependent false, queries `kg:abox` directly).

- [ ] **Step 5: Write `tests/fixture-coding.test.ts`** — copy the body from Task 11 step 5, `DIR` → `fixtures/coding`.

- [ ] **Step 6: Run** `pnpm --filter predicate-eval exec vitest run tests/fixture-coding.test.ts` and `runEval(getAdapter(),'coding',{episodes:3,write:false})` via the eval-cli test pattern → Expected PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-eval/fixtures/coding packages/predicate-eval/tests/fixture-coding.test.ts
git commit -m "feat(eval): coding seed fixture proving domain pluggability"
```

---

## Task 13: Reasoner-soundness sidecar — closure check

**Files:**
- Create: `packages/predicate-eval/src/soundness/closure-check.ts`
- Test: `packages/predicate-eval/tests/closure-check.test.ts`

Verifies the reasoner's transitive-property materialization equals an independently computed closure on a generated chain.

- [ ] **Step 1: Write the failing test**

```ts
// tests/closure-check.test.ts
import { describe, it, expect } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { checkTransitiveClosure } from '../src/soundness/closure-check.js';

describe('closure-check', () => {
  it('reasoner transitive closure matches the reference on a length-5 chain', async () => {
    const res = await checkTransitiveClosure(getAdapter(), 5);
    expect(res.missing).toEqual([]);
    expect(res.extra).toEqual([]);
  }, 20_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/closure-check.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/soundness/closure-check.ts
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';

const NS = 'http://ex/sound#';
const P = `${NS}rel`;

export interface ClosureResult { missing: string[]; extra: string[]; }

/** Build a chain n0->n1->...->nk over a transitive property, materialize, diff against the reference closure. */
export async function checkTransitiveClosure(
  client: StorageAdapter, k: number,
): Promise<ClosureResult> {
  for (const g of ['kg:tbox', 'kg:abox', 'kg:inferred']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  await client.loadTurtle(
    `<${P}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#TransitiveProperty> .`,
    'kg:tbox');
  const lines: string[] = [];
  for (let i = 0; i < k; i++) lines.push(`<${NS}n${i}> <${P}> <${NS}n${i + 1}> .`);
  await client.loadTurtle(lines.join('\n'), 'kg:abox');

  await new FusekiConstructAdapter(client).materialize({
    tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5,
  });

  // Reference closure: n_i -> n_j for all j > i
  const reference = new Set<string>();
  for (let i = 0; i <= k; i++) for (let j = i + 1; j <= k; j++) reference.add(`${i}->${j}`);

  const r = await client.select(
    `SELECT ?s ?o WHERE { { GRAPH <kg:abox> { ?s <${P}> ?o } } UNION { GRAPH <kg:inferred> { ?s <${P}> ?o } } }`);
  const got = new Set<string>();
  for (const b of r.results.bindings) {
    const s = b.s!.value.replace(`${NS}n`, ''); const o = b.o!.value.replace(`${NS}n`, '');
    got.add(`${s}->${o}`);
  }
  const missing = [...reference].filter((x) => !got.has(x));
  const extra = [...got].filter((x) => !reference.has(x));
  return { missing, extra };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/closure-check.test.ts`
Expected: PASS. (If `extra` is non-empty, the reasoner is materializing unsound edges — a real finding; record it before adjusting the test.)

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/soundness/closure-check.ts packages/predicate-eval/tests/closure-check.test.ts
git commit -m "feat(eval): reasoner soundness — transitive closure check"
```

---

## Task 14: Reasoner-soundness sidecar — scaling probe (record-only)

**Files:**
- Create: `packages/predicate-eval/src/soundness/scaling-probe.ts`
- Test: `packages/predicate-eval/tests/scaling-probe.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scaling-probe.test.ts
import { describe, it, expect } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { probeScaling } from '../src/soundness/scaling-probe.js';

describe('scaling-probe', () => {
  it('records latency + iterations at each size (no threshold)', async () => {
    const rows = await probeScaling(getAdapter(), [100, 500]);
    expect(rows.map((r) => r.triples)).toEqual([100, 500]);
    for (const r of rows) {
      expect(r.materializeMs).toBeGreaterThanOrEqual(0);
      expect(r.iterations).toBeGreaterThanOrEqual(1);
    }
  }, 30_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/scaling-probe.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/soundness/scaling-probe.ts
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';

const NS = 'http://ex/scale#';
const SUB = `${NS}subClassOf`;

export interface ScalingRow { triples: number; materializeMs: number; iterations: number; }

/** Build a subclass chain of `size` triples, materialize, record latency + iterations. Record-only. */
export async function probeScaling(
  client: StorageAdapter, sizes: number[],
): Promise<ScalingRow[]> {
  const rows: ScalingRow[] = [];
  for (const size of sizes) {
    for (const g of ['kg:tbox', 'kg:abox', 'kg:inferred']) {
      await client.update(`DROP SILENT GRAPH <${g}>`);
      await client.update(`CREATE SILENT GRAPH <${g}>`);
    }
    const lines: string[] = [];
    for (let i = 0; i < size; i++) {
      lines.push(`<${NS}c${i}> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <${NS}c${i + 1}> .`);
    }
    await client.loadTurtle(lines.join('\n'), 'kg:tbox');
    void SUB;
    const res = await new FusekiConstructAdapter(client).materialize({
      tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5,
    });
    rows.push({ triples: size, materializeMs: res.elapsedMs, iterations: res.iterations });
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/scaling-probe.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/soundness/scaling-probe.ts packages/predicate-eval/tests/scaling-probe.test.ts
git commit -m "feat(eval): reasoner soundness — record-only scaling probe"
```

---

## Task 15: Full-suite green + README + CI note

**Files:**
- Modify: `packages/predicate-eval/README.md`
- Test: whole package

- [ ] **Step 1: Run the whole eval package suite**

Run: `pnpm --filter predicate-eval test`
Expected: PASS (all new + pre-existing tests). Fix any regressions before continuing.

- [ ] **Step 2: Run typecheck + lint**

Run: `pnpm --filter predicate-eval typecheck && pnpm --filter predicate-eval lint`
Expected: clean. Fix type/lint errors inline.

- [ ] **Step 3: Document the harness in `README.md`** — add a section covering: what Tier 1 measures, how to run (`pnpm --filter predicate-eval eval org`), how to read the curve (accuracy ● / lift ·), where the scoreboard lives (`results/scoreboard.jsonl`), and an explicit note that Tier 1 green ≠ "the product works" (that is Tier 2, Plan B).

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-eval/README.md
git commit -m "docs(eval): document the deterministic eval harness + how to read the curve"
```

---

## Self-review notes (addressed)

- **Spec coverage:** §6 oracle → Task 2; §7 questions/scoring → Tasks 1,3,7; §8 compounding curve + lift → Task 8; §9 boundedness → Task 5; §10 Tier 1 → Task 8 (Tier 2 deferred to Plan B per spec); §11 soundness sidecar → Tasks 13–14; §12 reporting → Task 9; §13 harness tests → every task is TDD; §4 three domains → Tasks 6, 11, 12. Tier 2 (§10) and the MCP-sampling spike are intentionally out of Plan A scope.
- **Type consistency:** `runTier1(client, domain, domainDir, episodes)` signature used identically in Tasks 8 and 10; `ScoreRow`, `Boundedness`, `AnswerKey`, `Question` defined once in Task 1 and imported everywhere; `rematerialize(client, inference: boolean)` and `applyEpisodeTriples(client, triples)` consistent across Tasks 4, 8, 13, 14.
- **Placeholder scan:** Tasks 11–12 reuse the fixture-integrity test *body* (repeated in full in Task 11 step 5) rather than cross-importing; coding fixture flags the `imports`-transitivity verification step rather than assuming it.
- **Known risk to watch during execution:** if `org:reportsTo`/`res:influencedBy` transitive materialization does not land in `kg:inferred`, Task 8's lift assertion fails — that is the reasoner behaving differently than the README claims and should be recorded as a finding (per systematic-debugging), not worked around by relaxing the test.
```
