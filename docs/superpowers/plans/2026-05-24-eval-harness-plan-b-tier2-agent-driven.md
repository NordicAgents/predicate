# Eval Harness — Plan B (Tier 2, Agent-Driven) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Tier-2 evaluation rig that measures whether a model can actually *drive* the knowledge graph — drafting SPARQL from a schema slice and a natural-language question — and quantify the Tier1↔Tier2 gap (the LLM-writes-SPARQL reliability number), running key-free inside a Claude Code session via an agent-driven loop.

**Architecture:** Tier 2 reuses Tier 1's fixtures, episodes, and answer keys. It splits into three pure, separately-testable phases: (1) **emit** — replay a domain to its final episode, materialize, and write one task per question (question text + the domain's `world.ttl` schema slice, *no golden SPARQL and no answer key leaked*) to a tasks file; (2) **draft** — an external driver answers each task with a SPARQL string (in Claude Code: a subagent-per-question loop using the real host model; the same answers file could later be produced by the existing `CompletionProvider` MCP-sampling or API-key paths without touching the rig); (3) **score** — execute each drafted query against the materialized graph, coerce results to the question's answer-key shape, score with the *same* `scorer.ts` Tier 1 uses, and record `sparql_valid` / `sparql_nonempty` / `f1`. A reporter prints Tier1-vs-Tier2 per question and the aggregate gap.

**Tech Stack:** TypeScript (ESM), vitest, `predicate-mcp` storage adapter (`getAdapter()`), `predicate-reasoner` `FusekiConstructAdapter`. No new runtime dependencies. No `ANTHROPIC_API_KEY`. Reuses Tier 1 modules: `oracle.ts`, `questions.ts`, `scorer.ts`, `episode-runner.ts`, `eval-types.ts`.

**Spec reference:** `docs/superpowers/specs/2026-05-23-eval-harness-design.md` §10 (Tier 2). **Spike resolved (2026-05-24):** Claude Code does not implement MCP `sampling/createMessage` (issue #1785), so Tier 2's model path is agent-driven (file-based), not MCP sampling. The `CompletionProvider` seam in `predicate-agent/src/completion-provider.ts` remains the integration point for MCP-sampling / API-key drivers if a future host supports them.

**Scope note:** This plan delivers Tier 2 scoring at the **final-episode state** of each domain (Tier 1 already measures the per-episode compounding curve; Tier 2 measures SPARQL-synthesis quality, which is an end-state property). Per-episode Tier 2 is an explicit non-goal. The live agent-drafting run (dispatching subagents to answer the tasks) is a controller step performed during execution, documented in Task 7 — the rig itself is fully unit-tested with synthetic answers so it never depends on a live model to be correct.

---

## File structure

| File | Responsibility |
|---|---|
| `packages/predicate-eval/src/tier2-types.ts` | `Tier2Task`, `Tier2Answer`, `Tier2Row` types |
| `packages/predicate-eval/src/tier2-prompt.ts` | Build the per-question drafting prompt (schema slice + question + output contract) |
| `packages/predicate-eval/src/rigs/tier2-tasks.ts` | `buildTier2Tasks(client, domain, dir, episodes)` — replay→materialize→emit tasks (no leakage) |
| `packages/predicate-eval/src/rigs/tier2-score.ts` | `scoreTier2(client, domain, dir, episodes, answers)` — run drafted SPARQL, score → `Tier2Row[]` |
| `packages/predicate-eval/src/tier2.ts` | CLI: `emit <domain>` and `score <domain> <answersFile>`; appends rows + prints gap |
| `packages/predicate-eval/src/tier2-report.ts` | `tier1VsTier2(rows)` — per-question + aggregate Tier1−Tier2 gap table |
| `packages/predicate-eval/tests/*.test.ts` | One test file per module (synthetic answers; no live model) |
| `packages/predicate-eval/DRIVING-TIER2.md` | How a controller runs the agent-driven loop end to end |

**Test command:** `pnpm --filter predicate-eval exec vitest run tests/<file>.test.ts` (repo root). Full: `pnpm --filter predicate-eval test`.

**Reused Tier 1 APIs (already on `main`):**
- `loadOracle(dir)`, `deriveAnswerKey(oracle, key, type, cutoff)` — `src/oracle.ts`
- `loadQuestions(dir): Question[]` — `src/questions.ts`; `Question` has `id, text, type, key, golden_sparql, reasoning_dependent`
- `readEpisode(path)`, `applyEpisodeTriples(client, triples)`, `rematerialize(client, inference)` — `src/episode-runner.ts`
- `seedProvenance(client)` — `src/provenance.ts`
- `scoreSet`, `scoreBoolean`, `scoreConflict` — `src/scorer.ts`
- `AnswerKey`, `Question` — `src/eval-types.ts`
- Episode directory layout: `fixtures/<domain>/episodes/e*.jsonl`, schema at `fixtures/<domain>/world.ttl`

---

## Task 1: Tier 2 types

**Files:**
- Create: `packages/predicate-eval/src/tier2-types.ts`
- Test: `packages/predicate-eval/tests/tier2-types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/tier2-types.test.ts
import { describe, it, expect } from 'vitest';
import { isTier2Answer } from '../src/tier2-types.js';

describe('tier2-types', () => {
  it('isTier2Answer accepts a well-formed answer', () => {
    expect(isTier2Answer({ id: 'org-q01', sparql: 'ASK {}' })).toBe(true);
  });
  it('isTier2Answer rejects a missing/empty sparql', () => {
    expect(isTier2Answer({ id: 'org-q01' })).toBe(false);
    expect(isTier2Answer({ id: 'org-q01', sparql: '' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier2-types.test.ts`
Expected: FAIL — cannot find module `../src/tier2-types.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/tier2-types.ts
import type { ScoreType } from './eval-types.js';

/** Emitted per question; carries NO golden SPARQL and NO answer key. */
export interface Tier2Task {
  id: string;
  domain: string;
  questionText: string;
  type: ScoreType;
  schema: string;        // the domain world.ttl, as the predicate vocabulary
  graphsHint: string;    // which named graphs are queryable
}

/** The model's drafted query for a task. */
export interface Tier2Answer {
  id: string;
  sparql: string;
}

/** One scored row for a Tier 2 question at the final episode state. */
export interface Tier2Row {
  runId: string;
  timestamp: string;
  domain: string;
  questionId: string;
  sparqlValid: boolean;     // executed without throwing
  sparqlNonEmpty: boolean;  // returned at least one binding / true
  f1: number;               // scored vs the final answer key
  hostModel?: string;
}

export function isTier2Answer(x: unknown): x is Tier2Answer {
  if (typeof x !== 'object' || x === null) return false;
  const a = x as Record<string, unknown>;
  return typeof a.id === 'string' && typeof a.sparql === 'string' && a.sparql.length > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier2-types.test.ts`
Expected: PASS (3 assertions).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/tier2-types.ts packages/predicate-eval/tests/tier2-types.test.ts
git commit -m "feat(eval): tier-2 types + answer guard"
```

---

## Task 2: Drafting prompt builder

**Files:**
- Create: `packages/predicate-eval/src/tier2-prompt.ts`
- Test: `packages/predicate-eval/tests/tier2-prompt.test.ts`

The prompt must give the model the schema and question, demand exactly one SPARQL query as output, allow querying both `kg:abox` and `kg:inferred`, and must NOT contain the golden query or the answer.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tier2-prompt.test.ts
import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../src/tier2-prompt.js';
import type { Tier2Task } from '../src/tier2-types.js';

const task: Tier2Task = {
  id: 'org-q01', domain: 'org', questionText: "Who is in Dana's management chain?",
  type: 'set', schema: 'org:reportsTo a owl:TransitiveProperty .', graphsHint: 'kg:abox, kg:inferred',
};

describe('buildPrompt', () => {
  it('includes schema, question, and the output contract', () => {
    const p = buildPrompt(task);
    expect(p).toContain('org:reportsTo');
    expect(p).toContain("Who is in Dana's management chain?");
    expect(p).toContain('kg:abox');
    expect(p).toContain('kg:inferred');
    expect(p.toLowerCase()).toContain('sparql');
  });
  it('does not leak an answer or golden query', () => {
    // The task type carries no golden_sparql/key, so the prompt cannot contain them.
    const p = buildPrompt(task);
    expect(p).not.toContain('golden');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier2-prompt.test.ts`
Expected: FAIL — cannot find module `../src/tier2-prompt.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/tier2-prompt.ts
import type { Tier2Task } from './tier2-types.js';

export const TIER2_SYSTEM =
  'You translate a natural-language question about a knowledge graph into ONE SPARQL query. ' +
  'You are given the ontology (TBox) as Turtle. The data lives in named graphs: query ' +
  'kg:abox (asserted facts) and kg:inferred (entailments) — union them when a relation may be ' +
  'transitive or inferred. Output ONLY the SPARQL query, no prose, no code fences, no explanation. ' +
  'Use a SELECT for "which/what/who" questions and an ASK for yes/no questions.';

export function buildPrompt(task: Tier2Task): string {
  return [
    TIER2_SYSTEM,
    '',
    '<ontology>',
    task.schema,
    '</ontology>',
    '',
    `Queryable named graphs: ${task.graphsHint}`,
    '',
    `Question (${task.type}): ${task.questionText}`,
    '',
    'SPARQL:',
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier2-prompt.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/tier2-prompt.ts packages/predicate-eval/tests/tier2-prompt.test.ts
git commit -m "feat(eval): tier-2 drafting prompt builder"
```

---

## Task 3: Emit tasks (build phase)

**Files:**
- Create: `packages/predicate-eval/src/rigs/tier2-tasks.ts`
- Test: `packages/predicate-eval/tests/tier2-tasks.test.ts`

Replays the domain to its final episode, materializes, and emits one `Tier2Task` per question. Loads the schema from `world.ttl`. Must NOT include `golden_sparql` or any answer key.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tier2-tasks.test.ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { buildTier2Tasks } from '../src/rigs/tier2-tasks.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('buildTier2Tasks', () => {
  it('emits one task per question with schema and no leaked golden/key', async () => {
    const tasks = await buildTier2Tasks(getAdapter(), 'org', DIR, 8);
    expect(tasks.length).toBe(8);
    const q01 = tasks.find((t) => t.id === 'org-q01')!;
    expect(q01.schema).toContain('reportsTo');
    expect(q01.questionText.length).toBeGreaterThan(0);
    // No leakage: the serialized task must not contain a golden_sparql field.
    expect(JSON.stringify(tasks)).not.toContain('golden_sparql');
    expect(JSON.stringify(tasks)).not.toContain('kg:inferred }');  // golden query body shape
  }, 30_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier2-tasks.test.ts`
Expected: FAIL — cannot find module `../src/rigs/tier2-tasks.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/rigs/tier2-tasks.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadQuestions } from '../questions.js';
import { readEpisode, applyEpisodeTriples, rematerialize } from '../episode-runner.js';
import { seedProvenance } from '../provenance.js';
import type { Tier2Task } from '../tier2-types.js';

function episodePaths(dir: string): string[] {
  return readdirSync(join(dir, 'episodes'))
    .filter((f) => f.endsWith('.jsonl')).sort()
    .map((f) => join(dir, 'episodes', f));
}

/** Replay all episodes, materialize, and emit one drafting task per question. */
export async function buildTier2Tasks(
  client: StorageAdapter, domain: string, dir: string, episodes: number,
): Promise<Tier2Task[]> {
  const questions = loadQuestions(dir);
  const schema = readFileSync(join(dir, 'world.ttl'), 'utf8');
  // Materialize the final state so an emitter could (optionally) sanity-check; not strictly
  // required to emit tasks, but keeps the build path identical to the scoring path.
  for (const g of ['kg:tbox', 'kg:abox', 'kg:inferred', 'kg:usage', 'kg:provenance']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  await client.loadTurtle(schema, 'kg:tbox');
  const paths = episodePaths(dir);
  for (let i = 0; i < Math.min(episodes, paths.length); i++) {
    await applyEpisodeTriples(client, readEpisode(paths[i]!));
  }
  await seedProvenance(client);
  await rematerialize(client, true);

  return questions.map((q) => ({
    id: q.id,
    domain,
    questionText: q.text,
    type: q.type,
    schema,
    graphsHint: 'kg:abox, kg:inferred',
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier2-tasks.test.ts`
Expected: PASS. (The `kg:inferred }` check guards that no golden-query body leaked; tasks only carry `graphsHint: 'kg:abox, kg:inferred'` which has a comma, not `}`.)

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/rigs/tier2-tasks.ts packages/predicate-eval/tests/tier2-tasks.test.ts
git commit -m "feat(eval): tier-2 task emitter (no golden/key leakage)"
```

---

## Task 4: Score drafted SPARQL (score phase)

**Files:**
- Create: `packages/predicate-eval/src/rigs/tier2-score.ts`
- Test: `packages/predicate-eval/tests/tier2-score.test.ts`

Replays to final state + materializes, then for each question runs the model's drafted SPARQL (guarding errors), coerces results to the question's `AnswerKey` shape, and scores against the final answer key with the same scorers Tier 1 uses.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tier2-score.test.ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadQuestions } from '../src/questions.js';
import { scoreTier2 } from '../src/rigs/tier2-score.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('scoreTier2', () => {
  it('a perfect answer (the golden query) scores f1=1 and valid', async () => {
    // Feed each question its own golden_sparql as the "drafted" answer → upper bound.
    const golden = new Map(loadQuestions(DIR).map((q) => [q.id, q.golden_sparql]));
    const rows = await scoreTier2(getAdapter(), 'org', DIR, 8, golden);
    expect(rows.length).toBe(8);
    for (const r of rows) {
      expect(r.sparqlValid).toBe(true);
      expect(r.f1).toBe(1);
    }
  }, 30_000);

  it('a broken query is recorded as invalid with f1=0, not thrown', async () => {
    const answers = new Map([['org-q01', 'SELECT ?p WHERE { THIS IS NOT SPARQL']]);
    const rows = await scoreTier2(getAdapter(), 'org', DIR, 8, answers);
    const r = rows.find((x) => x.questionId === 'org-q01')!;
    expect(r.sparqlValid).toBe(false);
    expect(r.f1).toBe(0);
  }, 30_000);

  it('a question with no provided answer is scored as f1=0 invalid', async () => {
    const rows = await scoreTier2(getAdapter(), 'org', DIR, 8, new Map());
    expect(rows.every((r) => r.f1 === 0 && !r.sparqlValid)).toBe(true);
  }, 30_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier2-score.test.ts`
Expected: FAIL — cannot find module `../src/rigs/tier2-score.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/rigs/tier2-score.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadOracle, deriveAnswerKey } from '../oracle.js';
import { loadQuestions } from '../questions.js';
import { readEpisode, applyEpisodeTriples, rematerialize } from '../episode-runner.js';
import { seedProvenance } from '../provenance.js';
import { scoreSet, scoreBoolean, scoreConflict } from '../scorer.js';
import type { AnswerKey, Question } from '../eval-types.js';
import type { Tier2Row } from '../tier2-types.js';

function episodePaths(dir: string): string[] {
  return readdirSync(join(dir, 'episodes'))
    .filter((f) => f.endsWith('.jsonl')).sort()
    .map((f) => join(dir, 'episodes', f));
}

interface RunResult { key: AnswerKey; valid: boolean; nonEmpty: boolean; }

async function runDrafted(client: StorageAdapter, q: Question, sparql: string): Promise<RunResult> {
  try {
    if (q.type === 'boolean') {
      const v = await client.ask(sparql);
      return { key: { kind: 'boolean', value: v }, valid: true, nonEmpty: v };
    }
    const r = await client.select(sparql);
    const vals = r.results.bindings.map((b) => Object.values(b)[0]!.value);
    const nonEmpty = vals.length > 0;
    if (q.type === 'conflict') return { key: { kind: 'conflict', ids: new Set(vals) }, valid: true, nonEmpty };
    return { key: { kind: 'set', values: new Set(vals) }, valid: true, nonEmpty };
  } catch {
    // Invalid SPARQL or execution error → not valid. Use the empty shape for the type.
    if (q.type === 'boolean') return { key: { kind: 'boolean', value: false }, valid: false, nonEmpty: false };
    if (q.type === 'conflict') return { key: { kind: 'conflict', ids: new Set() }, valid: false, nonEmpty: false };
    return { key: { kind: 'set', values: new Set() }, valid: false, nonEmpty: false };
  }
}

function score(expected: AnswerKey, got: AnswerKey): number {
  if (expected.kind === 'set' && got.kind === 'set') return scoreSet(expected.values, got.values).f1;
  if (expected.kind === 'boolean' && got.kind === 'boolean') return scoreBoolean(expected.value, got.value).f1;
  if (expected.kind === 'conflict' && got.kind === 'conflict') return scoreConflict(expected.ids, got.ids).f1;
  return 0;
}

export async function scoreTier2(
  client: StorageAdapter, domain: string, dir: string, episodes: number,
  answers: Map<string, string>,
): Promise<Tier2Row[]> {
  const oracle = loadOracle(dir);
  const questions = loadQuestions(dir);
  const schema = readFileSync(join(dir, 'world.ttl'), 'utf8');
  for (const g of ['kg:tbox', 'kg:abox', 'kg:inferred', 'kg:usage', 'kg:provenance']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  await client.loadTurtle(schema, 'kg:tbox');
  const paths = episodePaths(dir);
  for (let i = 0; i < Math.min(episodes, paths.length); i++) {
    await applyEpisodeTriples(client, readEpisode(paths[i]!));
  }
  await seedProvenance(client);
  await rematerialize(client, true);

  const runId = `${domain}-tier2-${Date.now()}`;
  const rows: Tier2Row[] = [];
  for (const q of questions) {
    const expected = deriveAnswerKey(oracle, q.key, q.type, episodes);
    const sparql = answers.get(q.id);
    if (!sparql) {
      rows.push({
        runId, timestamp: new Date().toISOString(), domain, questionId: q.id,
        sparqlValid: false, sparqlNonEmpty: false, f1: 0,
      });
      continue;
    }
    const { key: got, valid, nonEmpty } = await runDrafted(client, q, sparql);
    rows.push({
      runId, timestamp: new Date().toISOString(), domain, questionId: q.id,
      sparqlValid: valid, sparqlNonEmpty: nonEmpty, f1: valid ? score(expected, got) : 0,
    });
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier2-score.test.ts`
Expected: PASS. The golden-as-answer case proves the scoring path reaches f1=1 (Tier 2's upper bound equals Tier 1); the broken-query and missing-answer cases prove graceful failure.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/rigs/tier2-score.ts packages/predicate-eval/tests/tier2-score.test.ts
git commit -m "feat(eval): tier-2 scorer for drafted SPARQL (valid/empty/f1, error-safe)"
```

---

## Task 5: Tier1-vs-Tier2 gap report

**Files:**
- Create: `packages/predicate-eval/src/tier2-report.ts`
- Test: `packages/predicate-eval/tests/tier2-report.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/tier2-report.test.ts
import { describe, it, expect } from 'vitest';
import { tier1VsTier2 } from '../src/tier2-report.js';
import type { Tier2Row } from '../src/tier2-types.js';

const t2: Tier2Row[] = [
  { runId: 'r', timestamp: 't', domain: 'org', questionId: 'q1', sparqlValid: true, sparqlNonEmpty: true, f1: 1 },
  { runId: 'r', timestamp: 't', domain: 'org', questionId: 'q2', sparqlValid: true, sparqlNonEmpty: false, f1: 0 },
];
const tier1Final = new Map([['q1', 1], ['q2', 1]]);

describe('tier1VsTier2', () => {
  it('reports per-question gap and aggregate', () => {
    const out = tier1VsTier2('org', t2, tier1Final);
    expect(out).toContain('q1');
    expect(out).toContain('q2');
    expect(out).toContain('gap');
    // aggregate gap = mean(tier1) - mean(tier2) = 1.0 - 0.5 = 0.50
    expect(out).toContain('0.50');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier2-report.test.ts`
Expected: FAIL — cannot find module `../src/tier2-report.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/tier2-report.ts
import type { Tier2Row } from './tier2-types.js';

/** Per-question and aggregate Tier1−Tier2 gap (how much the model's SPARQL underperforms golden). */
export function tier1VsTier2(
  domain: string, t2: Tier2Row[], tier1Final: Map<string, number>,
): string {
  const lines = [`Tier1 vs Tier2 — ${domain}`, 'question            t1    t2    gap   valid'];
  let sumT1 = 0; let sumT2 = 0;
  for (const r of t2) {
    const t1 = tier1Final.get(r.questionId) ?? 0;
    sumT1 += t1; sumT2 += r.f1;
    lines.push(
      `${r.questionId.padEnd(18)} ${t1.toFixed(2)}  ${r.f1.toFixed(2)}  ${(t1 - r.f1).toFixed(2)}  ${r.sparqlValid ? 'ok' : 'INVALID'}`,
    );
  }
  const n = t2.length || 1;
  const gap = sumT1 / n - sumT2 / n;
  const validRate = t2.filter((r) => r.sparqlValid).length / n;
  lines.push(`aggregate: t1=${(sumT1 / n).toFixed(2)} t2=${(sumT2 / n).toFixed(2)} gap=${gap.toFixed(2)} sparql_valid_rate=${validRate.toFixed(2)}`);
  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier2-report.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/tier2-report.ts packages/predicate-eval/tests/tier2-report.test.ts
git commit -m "feat(eval): tier1-vs-tier2 gap report"
```

---

## Task 6: Tier 2 CLI (emit / score)

**Files:**
- Create: `packages/predicate-eval/src/tier2.ts`
- Modify: `packages/predicate-eval/package.json` (add `"tier2": "tsx src/tier2.ts"`)
- Test: `packages/predicate-eval/tests/tier2-cli.test.ts`

`emit <domain>` writes tasks to `results/tier2-tasks.<domain>.jsonl`. `score <domain> <answersFile>` reads a JSONL of `{id,sparql}`, scores, appends rows to `results/tier2-scoreboard.jsonl`, prints the gap (needs Tier 1 final f1; recomputed via `runTier1`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/tier2-cli.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { emitTasks, scoreAnswers } from '../src/tier2.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('tier2 cli functions', () => {
  it('emitTasks writes one JSONL line per question', async () => {
    const dir = mkdtempSync(join(tmpdir(), 't2-'));
    const file = join(dir, 'tasks.jsonl');
    const n = await emitTasks(getAdapter(), 'org', DIR, 8, file);
    expect(n).toBe(8);
    expect(readFileSync(file, 'utf8').trim().split('\n').length).toBe(8);
  }, 30_000);

  it('scoreAnswers scores golden answers to a zero gap', async () => {
    const dir = mkdtempSync(join(tmpdir(), 't2-'));
    // Build an answers file from the golden queries (upper bound → gap 0).
    const { loadQuestions } = await import('../src/questions.js');
    const answersFile = join(dir, 'answers.jsonl');
    writeFileSync(answersFile, loadQuestions(DIR)
      .map((q) => JSON.stringify({ id: q.id, sparql: q.golden_sparql })).join('\n'));
    const { gap, summary } = await scoreAnswers(getAdapter(), 'org', DIR, 8, answersFile,
      join(dir, 'scoreboard.jsonl'));
    expect(gap).toBeCloseTo(0, 5);
    expect(summary).toContain('aggregate');
  }, 60_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier2-cli.test.ts`
Expected: FAIL — cannot find module `../src/tier2.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/tier2.ts
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { buildTier2Tasks } from './rigs/tier2-tasks.js';
import { scoreTier2 } from './rigs/tier2-score.js';
import { runTier1 } from './rigs/tier1-deterministic.js';
import { tier1VsTier2 } from './tier2-report.js';
import { isTier2Answer } from './tier2-types.js';

const DOMAINS: Record<string, { episodes: number }> = {
  org: { episodes: 8 }, research: { episodes: 8 }, coding: { episodes: 3 },
};

function dirFor(domain: string): string {
  return join(import.meta.dirname, '..', 'fixtures', domain);
}

export async function emitTasks(
  client: StorageAdapter, domain: string, dir: string, episodes: number, outFile: string,
): Promise<number> {
  const tasks = await buildTier2Tasks(client, domain, dir, episodes);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, tasks.map((t) => JSON.stringify(t)).join('\n') + '\n');
  return tasks.length;
}

export async function scoreAnswers(
  client: StorageAdapter, domain: string, dir: string, episodes: number,
  answersFile: string, scoreboardFile: string,
): Promise<{ gap: number; summary: string }> {
  const answers = new Map<string, string>();
  for (const line of readFileSync(answersFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)) {
    const obj = JSON.parse(line);
    if (isTier2Answer(obj)) answers.set(obj.id, obj.sparql);
  }
  const rows = await scoreTier2(client, domain, dir, episodes, answers);

  // Tier 1 final-episode f1 per question, for the gap.
  const t1rows = await runTier1(client, domain, dir, episodes);
  const t1final = t1rows.filter((r) => r.inference === 'on' && r.episode === episodes)[0]!;
  const tier1Final = new Map(Object.entries(t1final.perQuestion));

  mkdirSync(dirname(scoreboardFile), { recursive: true });
  for (const r of rows) appendFileSync(scoreboardFile, JSON.stringify(r) + '\n');

  const summary = tier1VsTier2(domain, rows, tier1Final);
  const n = rows.length || 1;
  const gap = [...tier1Final.values()].reduce((a, b) => a + b, 0) / n
    - rows.reduce((a, r) => a + r.f1, 0) / n;
  return { gap, summary };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, domain, file] = process.argv.slice(2);
  const cfg = DOMAINS[domain ?? ''];
  if (!cmd || !cfg) { console.error('usage: tier2 emit <domain> | tier2 score <domain> <answersFile>'); process.exit(1); }
  const dir = dirFor(domain!);
  if (cmd === 'emit') {
    const out = join(import.meta.dirname, '..', 'results', `tier2-tasks.${domain}.jsonl`);
    emitTasks(getAdapter(), domain!, dir, cfg.episodes, out)
      .then((n) => console.log(`wrote ${n} tasks to ${out}`))
      .catch((e) => { console.error(e); process.exit(1); });
  } else if (cmd === 'score') {
    if (!file) { console.error('score needs an answers file'); process.exit(1); }
    const sb = join(import.meta.dirname, '..', 'results', 'tier2-scoreboard.jsonl');
    scoreAnswers(getAdapter(), domain!, dir, cfg.episodes, file, sb)
      .then(({ summary }) => console.log(summary))
      .catch((e) => { console.error(e); process.exit(1); });
  } else { console.error(`unknown command: ${cmd}`); process.exit(1); }
}
```

- [ ] **Step 4: Add the npm script**

In `packages/predicate-eval/package.json` `"scripts"`, add:
```json
    "tier2": "tsx src/tier2.ts",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter predicate-eval exec vitest run tests/tier2-cli.test.ts`
Expected: PASS (golden answers → gap ≈ 0).

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-eval/src/tier2.ts packages/predicate-eval/package.json packages/predicate-eval/tests/tier2-cli.test.ts
git commit -m "feat(eval): tier-2 CLI (emit tasks / score answers) + gap output"
```

---

## Task 7: Driving doc + a real agent-driven run

**Files:**
- Create: `packages/predicate-eval/DRIVING-TIER2.md`
- (Run artifacts) `packages/predicate-eval/results/tier2-answers.<domain>.jsonl`, `results/tier2-scoreboard.jsonl`

This task is the **controller-performed** live run. It is not a unit test (the rig is already fully tested with synthetic answers in Tasks 3–6). The controller produces real drafted SPARQL using the host model and records the resulting gap.

- [ ] **Step 1: Write `DRIVING-TIER2.md`** documenting the exact loop:

````markdown
# Driving Tier 2 (agent-driven, no API key)

Tier 2 measures whether the host model can draft SPARQL that answers each question,
versus Tier 1's vetted golden queries. Claude Code does not support MCP sampling
(issue #1785), so the model is driven in-session by the agent.

## Steps
1. Emit tasks:  `pnpm --filter predicate-eval tier2 emit org`
   → writes `results/tier2-tasks.org.jsonl` (one `{id,domain,questionText,type,schema,graphsHint}` per line).
2. For each task line, the controller asks the host model to draft ONE SPARQL query
   using `buildPrompt(task)` (src/tier2-prompt.ts) as the instruction. Dispatch one
   subagent per task (or batch) whose entire job is: read the prompt, output only the
   SPARQL. Collect `{id, sparql}` lines into `results/tier2-answers.org.jsonl`.
   The drafting agent must NOT be given the golden query or the answer key.
3. Score:  `pnpm --filter predicate-eval tier2 score org results/tier2-answers.org.jsonl`
   → appends to `results/tier2-scoreboard.jsonl` and prints the Tier1-vs-Tier2 gap.

## Interpreting the gap
- `gap ≈ 0`: the model drafts SPARQL as good as the vetted golden queries.
- `gap > 0`: the model underperforms — inspect `sparql_valid_rate` (syntax failures) vs
  valid-but-wrong (semantic misses). This is the LLM-writes-SPARQL reliability number.
- A high `gap` with high `sparql_valid_rate` means the queries run but retrieve the wrong
  thing (schema misuse); a low `sparql_valid_rate` means syntactic/SPARQL-star failures.
````

- [ ] **Step 2: Emit org tasks**

Run: `pnpm --filter predicate-eval tier2 emit org`
Expected: `wrote 8 tasks to .../results/tier2-tasks.org.jsonl`.

- [ ] **Step 3: Draft answers with the host model**

For each of the 8 tasks, the controller dispatches a drafting subagent given exactly the
`buildPrompt(task)` text and nothing else (no golden, no key), collecting one `{id, sparql}`
JSON line per task into `results/tier2-answers.org.jsonl`. (8 lines.)

- [ ] **Step 4: Score and record the gap**

Run: `pnpm --filter predicate-eval tier2 score org results/tier2-answers.org.jsonl`
Expected: prints the per-question table + `aggregate: t1=… t2=… gap=… sparql_valid_rate=…`.
Record the printed gap in the run notes. There is no pass/fail threshold — this is the
first measurement of the Tier1↔Tier2 reliability gap.

- [ ] **Step 5: Commit the driving doc + baseline run**

```bash
git add packages/predicate-eval/DRIVING-TIER2.md packages/predicate-eval/results/tier2-scoreboard.jsonl
git commit -m "docs(eval): tier-2 driving guide + first agent-driven org gap baseline"
```

---

## Task 8: Full-suite green + README

**Files:**
- Modify: `packages/predicate-eval/README.md`

- [ ] **Step 1: Run the whole suite**

Run: `pnpm --filter predicate-eval test`
Expected: all pass (Tier 1 tests + new Tier 2 unit tests). Fix regressions before continuing.

- [ ] **Step 2: typecheck + lint**

Run: `pnpm --filter predicate-eval typecheck && pnpm --filter predicate-eval lint`
Expected: clean. No `eslint-disable`.

- [ ] **Step 3: Add a "Tier 2" section to `README.md`** documenting: what Tier 2 measures (can the model draft SPARQL; the Tier1↔Tier2 gap), the agent-driven mechanism and *why* (Claude Code lacks MCP sampling, issue #1785), how to run it (`tier2 emit` → draft via host model per `DRIVING-TIER2.md` → `tier2 score`), and that the `CompletionProvider` seam lets MCP-sampling / API-key drivers drop in for unattended runs on hosts that support them.

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-eval/README.md
git commit -m "docs(eval): document tier-2 agent-driven rig and the tier1-vs-tier2 gap"
```

---

## Self-review notes (addressed)

- **Spec coverage (design §10 Tier 2):** model-drives-the-loop → Tasks 2,3,7; drafts SPARQL from a freshly-read schema → Task 2 (schema slice) + Task 3 (no leakage); executes + scores against the same answer key → Task 4 (reuses `scorer.ts` + `deriveAnswerKey`); SPARQL-synthesis-success + accuracy metrics → `Tier2Row.sparqlValid/sparqlNonEmpty/f1` (Task 1) and the gap report (Task 5); host-sampling-without-key → resolved to agent-driven (spike), with the `CompletionProvider` seam preserved for future MCP-sampling/API-key drivers (documented Tasks 7–8). Per-episode Tier 2 and unattended/nightly runs are explicit non-goals.
- **Type consistency:** `Tier2Task`/`Tier2Answer`/`Tier2Row` defined once (Task 1), imported in Tasks 2–6; `buildTier2Tasks(client, domain, dir, episodes)` and `scoreTier2(client, domain, dir, episodes, answers)` signatures used identically in Tasks 3/4 and the CLI (Task 6); `tier1VsTier2(domain, rows, tier1Final)` consistent Tasks 5/6; reuses `runTier1` (returns rows with `perQuestion` + `inference` + `episode`, as built in Plan A) for the gap baseline.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code; the only non-coded task (Task 7) is explicitly a controller-run with exact commands, and the rig it exercises is fully unit-tested in Tasks 3–6 so correctness never depends on the live model.
- **Leakage guard:** `Tier2Task` deliberately omits `golden_sparql` and the answer key; Task 3's test asserts the serialized tasks contain neither; the drafting agent in Task 7 receives only `buildPrompt(task)`.
- **Known property to expect during the run:** the golden-query upper bound gives Tier2 = Tier1 (gap 0) by construction (Task 4/6 tests); a real host-model run will show gap ≥ 0 — that non-zero gap is the deliverable, not a failure.
