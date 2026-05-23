# Predicate Phase 3b — Research Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the agent loop by giving `kg_research_goal` the ability to actually run research, extract triples, and assert them. `ResearchSource` becomes a pluggable interface; `DocsResearchSource` walks a directory and returns file artifacts; deterministic regex `Extractor`s map (artifact, `SubQuestionIntent`) → calibrated-confidence triples; the orchestrator wires source → extractor → `kg_assert`. After Phase 3b, a goal like *"what depends on auth.ts"* against the demo corpus materially adds triples to `kg:abox`.

**Architecture:** Three new modules in `predicate-agent`: `research-source.ts` (interface + `DocsResearchSource`), `extractor.ts` (interface + three concrete extractors — `ImportExtractor`, `FunctionDeclExtractor`, `EnvVarExtractor`), and an extension to `research-goal.ts` that takes an `executeResearch` flag. When the flag is true, the orchestrator iterates each answerable sub-question, fetches artifacts via registered sources, runs supporting extractors, and asserts candidate triples through the existing `kg_assert` path (which already enforces TBox membership per Phase-2 P2). LLM-driven extraction is a Phase 4 upgrade; v1 is fully deterministic and unit-testable.

**Tech Stack:** Node 20+, TypeScript 5.x, pnpm workspaces, Vitest. No new runtime deps — directory walking uses `node:fs` recursively.

**Spec reference:** [`docs/superpowers/specs/2026-05-16-predicate-design.md`](../specs/2026-05-16-predicate-design.md) §§ 4.2 (assertion lifecycle), 6 (kg_research_goal / kg_assert), 17 (research-source open questions), 18 (intentionally-replaceable: rule subset + ReasonerAdapter; analogously, the extractor set is replaceable).

**Phase exit criteria:**
- `DocsResearchSource` walks a directory and returns one `ResearchArtifact` per matching file.
- Three extractors handle these intents: `find-dependencies` (imports), `find-symbol-in-file` (function decls), `find-readers-of` (env-var reads). Each emits triples with calibrated, source-specific confidence.
- `kg_research_goal(goal, executeResearch=true)` against the demo corpus produces at least 8 new triples in `kg:abox` from a `find-dependencies` goal (3 file declarations + 1 imports edge + 2 function decls + 2 env-var edges, give or take based on the regex matches).
- `kg_research_goal(goal, executeResearch=false)` returns the same `GoalPlan` shape as Phase 3a — no triples written. (Backward compatibility.)
- All previously asserted invariants hold: `kg_assert` rejects undeclared predicates, RDF-star provenance lands per triple, the `kg:meta` event log gets `GoalCreated` per goal.
- Phase tag `v0.3b.0-research-execution` set at the final commit.

---

## File structure (created or modified in Phase 3b)

```
predicate/
├── packages/
│   ├── predicate-agent/                                (modified)
│   │   ├── src/
│   │   │   ├── types.ts                                ← extended
│   │   │   ├── research-source.ts                      ← new
│   │   │   ├── extractor.ts                            ← new
│   │   │   ├── research-goal.ts                        ← extended (executeResearch flag)
│   │   │   └── index.ts                                ← extended re-exports
│   │   └── tests/
│   │       ├── research-source.test.ts                 ← new
│   │       ├── extractor.test.ts                       ← new
│   │       └── research-goal.test.ts                   ← extended
│   ├── predicate-mcp/                                  (modified)
│   │   ├── src/tools/kg-research-goal.ts               ← extended
│   │   ├── src/tools/registry.ts                       ← extended schema
│   │   └── tests/tools/kg-research-goal.test.ts        ← extended
│   └── predicate-eval/                                 (modified)
│       └── tests/research-loop.test.ts                 ← extended with execute-research case
└── README.md                                            ← Phase 3b status
```

---

## Task 1: Extend types with research-related shapes

**Files:**
- Modify: `packages/predicate-agent/src/types.ts`
- Create: `packages/predicate-agent/tests/research-types.test.ts`

- [ ] **Step 1: Append to `packages/predicate-agent/src/types.ts`**

Read the current file. After the existing `GoalPlan` interface, append:

```typescript
// --- Phase 3b: research execution -------------------------------------

export interface ResearchArtifact {
  source: string;                           // source name (e.g. "docs")
  uri: string;                              // file path or URL
  content: string;
  metadata: Record<string, string>;
}

export interface ResearchQuery {
  intent: SubQuestionIntent;
  symbols?: string[];                       // optional hint
  paths?: string[];                         // optional hint
}

export interface CandidateTriple {
  subject: string;
  predicate: string;
  object: { type: 'uri' | 'literal'; value: string };
  source: string;                           // e.g. "file:///repo/auth.ts:3"
  confidence: number;                       // [0, 1]
  method: string;                           // e.g. "regex-import"
}

export interface ResearchStats {
  subQuestionId: string;
  artifactsFetched: number;
  candidatesExtracted: number;
  assertedCount: number;
  rejectedCount: number;                    // failed TBox check or other validation
  errors: string[];                         // human-readable failure messages
}

/**
 * GoalPlan with an optional execution report. The `stats` field is populated
 * when `researchGoal({ executeResearch: true })` is called.
 */
export interface GoalPlanWithStats extends GoalPlan {
  stats?: ResearchStats[];
}
```

- [ ] **Step 2: Write the failing test `packages/predicate-agent/tests/research-types.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import type {
  ResearchArtifact, ResearchQuery, CandidateTriple, ResearchStats, GoalPlanWithStats,
} from '../src/index.js';

describe('research types', () => {
  it('ResearchArtifact has source/uri/content/metadata', () => {
    const a: ResearchArtifact = {
      source: 'docs', uri: 'file:///x.ts', content: 'x', metadata: { lang: 'ts' },
    };
    expect(a.uri).toBe('file:///x.ts');
  });

  it('CandidateTriple has source + confidence + method', () => {
    const t: CandidateTriple = {
      subject: 'urn:s', predicate: 'urn:p',
      object: { type: 'uri', value: 'urn:o' },
      source: 'file:///x', confidence: 0.95, method: 'regex-import',
    };
    expect(t.confidence).toBe(0.95);
  });

  it('GoalPlanWithStats can carry per-sub-question stats', () => {
    const p: GoalPlanWithStats = {
      goalId: 'urn:g', subQuestions: [], gaps: [],
      stats: [{
        subQuestionId: 'SQ-1', artifactsFetched: 3, candidatesExtracted: 5,
        assertedCount: 4, rejectedCount: 1, errors: ['one rejected'],
      }],
    };
    expect(p.stats?.[0]?.assertedCount).toBe(4);
  });

  it('ResearchQuery accepts optional symbols + paths hints', () => {
    const q: ResearchQuery = {
      intent: { kind: 'find-dependencies', payload: { symbol: 'x', transitive: true } },
      symbols: ['x'],
      paths: ['auth.ts'],
    };
    expect(q.symbols).toEqual(['x']);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter predicate-agent test tests/research-types.test.ts
```

Expected: 4 passed.

- [ ] **Step 4: Full workspace test + typecheck + lint**

```bash
pnpm test
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-agent lint
```

Expected: 91 (existing) + 4 (new) = 95 total. typecheck + lint clean.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-agent/src/types.ts \
        packages/predicate-agent/tests/research-types.test.ts
git commit -m "feat(agent): types for ResearchArtifact, CandidateTriple, ResearchStats"
```

---

## Task 2: `ResearchSource` interface + `DocsResearchSource`

`DocsResearchSource` walks a configured root directory recursively, yields one `ResearchArtifact` per file. Filtering by extension is supported. The query is currently ignored (v1: return all files; intent-aware filtering is a Phase-4 upgrade).

**Files:**
- Create: `packages/predicate-agent/src/research-source.ts`
- Create: `packages/predicate-agent/tests/research-source.test.ts`

- [ ] **Step 1: Write the failing test `packages/predicate-agent/tests/research-source.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocsResearchSource } from '../src/research-source.js';

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'predicate-docs-test-'));
  writeFileSync(join(root, 'a.ts'), 'export function a() { return 1 }');
  mkdirSync(join(root, 'nested'));
  writeFileSync(join(root, 'nested', 'b.ts'), 'export function b() { return 2 }');
  writeFileSync(join(root, 'c.md'), '# notes');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('DocsResearchSource', () => {
  it('returns one ResearchArtifact per .ts file by default', async () => {
    const src = new DocsResearchSource({ root, extensions: ['.ts'] });
    const artifacts = await src.fetch({
      intent: { kind: 'find-dependencies', payload: { symbol: 'x', transitive: false } },
    });
    expect(artifacts).toHaveLength(2);
    const uris = artifacts.map((a) => a.uri).sort();
    expect(uris[0]!.endsWith('a.ts')).toBe(true);
    expect(uris[1]!.endsWith('nested/b.ts')).toBe(true);
  });

  it('includes the file content', async () => {
    const src = new DocsResearchSource({ root, extensions: ['.ts'] });
    const artifacts = await src.fetch({
      intent: { kind: 'find-symbol-in-file', payload: { symbol: 'a' } },
    });
    const a = artifacts.find((a) => a.uri.endsWith('a.ts'))!;
    expect(a.content).toContain('export function a()');
  });

  it('respects the extensions filter', async () => {
    const src = new DocsResearchSource({ root, extensions: ['.md'] });
    const artifacts = await src.fetch({
      intent: { kind: 'unknown', payload: { raw: 'x' } },
    });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.uri.endsWith('c.md')).toBe(true);
  });

  it('returns artifacts with source name set to "docs"', async () => {
    const src = new DocsResearchSource({ root, extensions: ['.ts'] });
    const [first] = await src.fetch({
      intent: { kind: 'unknown', payload: { raw: 'x' } },
    });
    expect(first!.source).toBe('docs');
  });

  it('name property identifies the source', () => {
    const src = new DocsResearchSource({ root, extensions: ['.ts'] });
    expect(src.name).toBe('docs');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-agent test tests/research-source.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-agent/src/research-source.ts`**

```typescript
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { ResearchArtifact, ResearchQuery } from './types.js';

export interface ResearchSource {
  readonly name: string;
  fetch(query: ResearchQuery): Promise<ResearchArtifact[]>;
}

export interface DocsResearchSourceOptions {
  root: string;
  /** File extensions to include (with leading dot), e.g. ['.ts', '.md']. */
  extensions: string[];
}

/**
 * Walks a directory recursively and returns one ResearchArtifact per file
 * whose extension is in the configured allow-list. The query is currently
 * ignored — v1 returns all files; intent-aware filtering is a Phase-4
 * upgrade.
 */
export class DocsResearchSource implements ResearchSource {
  readonly name = 'docs';
  private readonly root: string;
  private readonly extensions: Set<string>;

  constructor(opts: DocsResearchSourceOptions) {
    this.root = opts.root;
    this.extensions = new Set(opts.extensions);
  }

  async fetch(_query: ResearchQuery): Promise<ResearchArtifact[]> {
    const out: ResearchArtifact[] = [];
    this.walk(this.root, out);
    return out;
  }

  private walk(dir: string, out: ResearchArtifact[]): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        this.walk(full, out);
        continue;
      }
      if (!this.extensions.has(extname(entry))) continue;
      const content = readFileSync(full, 'utf8');
      out.push({
        source: this.name,
        uri: `file://${full}`,
        content,
        metadata: { extension: extname(entry) },
      });
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter predicate-agent test tests/research-source.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Re-export**

```typescript
// packages/predicate-agent/src/index.ts
// Append after existing exports:
export * from './research-source.js';
```

- [ ] **Step 6: typecheck + lint**

```bash
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-agent lint
```

Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-agent/src/research-source.ts \
        packages/predicate-agent/src/index.ts \
        packages/predicate-agent/tests/research-source.test.ts
git commit -m "feat(agent): ResearchSource interface + DocsResearchSource (recursive dir walk)"
```

---

## Task 3: `Extractor` interface + three concrete extractors

Each extractor:
- Declares which `SubQuestionIntent.kind`s it supports.
- Runs a regex over the artifact's content.
- Emits `CandidateTriple`s with calibrated confidence and a stable `method` label.

The three extractors:

| Extractor | Intent kinds | Triples produced | Confidence |
|---|---|---|---|
| `ImportExtractor` | `find-dependencies` | `<file> rdf:type :File`, `<file> :path "name"`, `<file> :imports <other>` | 1.0 / 1.0 / 0.95 |
| `FunctionDeclExtractor` | `find-symbol-in-file`, `find-dependencies` | `<sym> rdf:type :Function`, `<sym> :declaredIn <file>` | 1.0 / 1.0 |
| `EnvVarExtractor` | `find-readers-of`, `find-dependencies` | `<env> rdf:type :EnvVar`, `<fn> :reads <env>` | 1.0 / 0.6 (heuristic association) |

The IRI scheme matches what Phase 1 used in `predicate-eval/src/load-corpus.ts`:
- `https://industriagents.com/predicate/codebase/<fileBasename>` for file IRIs
- `https://industriagents.com/predicate/codebase/<fileBasename>#<sym>` for symbol IRIs
- `https://industriagents.com/predicate/codebase/env/<NAME>` for env-var IRIs

**Files:**
- Create: `packages/predicate-agent/src/extractor.ts`
- Create: `packages/predicate-agent/tests/extractor.test.ts`

- [ ] **Step 1: Write the failing test `packages/predicate-agent/tests/extractor.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  ImportExtractor, FunctionDeclExtractor, EnvVarExtractor,
} from '../src/extractor.js';
import type { ResearchArtifact, SubQuestionIntent } from '../src/index.js';

function artifact(uri: string, content: string): ResearchArtifact {
  return { source: 'docs', uri, content, metadata: {} };
}

const C = 'https://industriagents.com/predicate/codebase';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

describe('ImportExtractor', () => {
  const e = new ImportExtractor();
  const intent: SubQuestionIntent = {
    kind: 'find-dependencies', payload: { symbol: 'x', transitive: true },
  };

  it('supports find-dependencies', () => {
    expect(e.supports(intent.kind)).toBe(true);
  });
  it('does NOT support find-callers', () => {
    expect(e.supports('find-callers')).toBe(false);
  });

  it('extracts :imports triples from "import {…} from \'./other\';"', () => {
    const a = artifact(
      'file:///root/auth.ts',
      "import { verifyJwt } from './jwt';\nexport function login() {}",
    );
    const ts = e.extract(a, intent);
    const importTriples = ts.filter((t) => t.predicate === `${C}#imports`);
    expect(importTriples).toHaveLength(1);
    expect(importTriples[0]!.subject).toBe(`${C}/auth.ts`);
    expect((importTriples[0]!.object as { value: string }).value).toBe(`${C}/jwt.ts`);
    expect(importTriples[0]!.confidence).toBe(0.95);
    expect(importTriples[0]!.method).toBe('regex-import');
  });

  it('also emits one :File rdf:type and one :path per file', () => {
    const a = artifact('file:///root/auth.ts', "import { x } from './y';");
    const ts = e.extract(a, intent);
    const types = ts.filter((t) => t.predicate === RDF_TYPE);
    const paths = ts.filter((t) => t.predicate === `${C}#path`);
    expect(types).toHaveLength(1);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.object).toEqual({ type: 'literal', value: 'auth.ts' });
  });
});

describe('FunctionDeclExtractor', () => {
  const e = new FunctionDeclExtractor();
  const intent: SubQuestionIntent = {
    kind: 'find-symbol-in-file', payload: { symbol: 'login' },
  };

  it('supports find-symbol-in-file and find-dependencies', () => {
    expect(e.supports('find-symbol-in-file')).toBe(true);
    expect(e.supports('find-dependencies')).toBe(true);
    expect(e.supports('unknown')).toBe(false);
  });

  it('emits rdf:type :Function and :declaredIn per exported function', () => {
    const a = artifact(
      'file:///root/auth.ts',
      'export function login() {}\nexport function logout() {}',
    );
    const ts = e.extract(a, intent);
    const fnIris = new Set(ts
      .filter((t) => t.predicate === RDF_TYPE)
      .map((t) => t.subject));
    expect(fnIris).toEqual(new Set([`${C}/auth.ts#login`, `${C}/auth.ts#logout`]));
    const declared = ts.filter((t) => t.predicate === `${C}#declaredIn`);
    expect(declared).toHaveLength(2);
    expect(ts.every((t) => t.confidence === 1)).toBe(true);
  });
});

describe('EnvVarExtractor', () => {
  const e = new EnvVarExtractor();
  const intent: SubQuestionIntent = {
    kind: 'find-readers-of', payload: { envVar: 'JWT_SECRET' },
  };

  it('supports find-readers-of and find-dependencies', () => {
    expect(e.supports('find-readers-of')).toBe(true);
    expect(e.supports('find-dependencies')).toBe(true);
  });

  it('emits rdf:type :EnvVar for each env var seen', () => {
    const a = artifact(
      'file:///root/jwt.ts',
      'export function verifyJwt() { return process.env.JWT_SECRET }',
    );
    const ts = e.extract(a, intent);
    const envIris = ts
      .filter((t) => t.predicate === RDF_TYPE
        && typeof t.object === 'object' && t.object.value === `${C}#EnvVar`)
      .map((t) => t.subject);
    expect(envIris).toContain(`${C}/env/JWT_SECRET`);
  });

  it('emits :reads from each exported function to env vars in the same file (heuristic, conf 0.6)', () => {
    const a = artifact(
      'file:///root/jwt.ts',
      'export function verifyJwt() { return process.env.JWT_SECRET }',
    );
    const ts = e.extract(a, intent);
    const reads = ts.filter((t) => t.predicate === `${C}#reads`);
    expect(reads).toHaveLength(1);
    expect(reads[0]!.subject).toBe(`${C}/jwt.ts#verifyJwt`);
    expect((reads[0]!.object as { value: string }).value).toBe(`${C}/env/JWT_SECRET`);
    expect(reads[0]!.confidence).toBe(0.6);
    expect(reads[0]!.method).toBe('regex-env-near-fn');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-agent test tests/extractor.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-agent/src/extractor.ts`**

```typescript
import { basename } from 'node:path';
import type { CandidateTriple, ResearchArtifact, SubQuestionIntent } from './types.js';

const C = 'https://industriagents.com/predicate/codebase';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

function fileIri(uri: string): { iri: string; basename: string } {
  // uri looks like "file:///some/path/auth.ts"
  const path = uri.replace(/^file:\/\//, '');
  const name = basename(path);
  return { iri: `${C}/${name}`, basename: name };
}

function fnIri(fileUri: string, sym: string): string {
  const { iri } = fileIri(fileUri);
  return `${iri}#${sym}`;
}

function envIri(name: string): string {
  return `${C}/env/${name}`;
}

export interface Extractor {
  readonly name: string;
  supports(kind: SubQuestionIntent['kind']): boolean;
  extract(artifact: ResearchArtifact, intent: SubQuestionIntent): CandidateTriple[];
}

const IMPORT_RE = /import\s+\{[^}]*\}\s+from\s+['"]\.\/([\w-]+)['"]/g;
const FN_RE     = /export\s+function\s+(\w+)\s*\(/g;
const ENV_RE    = /process\.env\.([A-Z0-9_]+)/g;

export class ImportExtractor implements Extractor {
  readonly name = 'ImportExtractor';
  supports(kind: SubQuestionIntent['kind']): boolean {
    return kind === 'find-dependencies';
  }
  extract(artifact: ResearchArtifact, _intent: SubQuestionIntent): CandidateTriple[] {
    const { iri: fIri, basename: bn } = fileIri(artifact.uri);
    const out: CandidateTriple[] = [
      {
        subject: fIri, predicate: RDF_TYPE,
        object: { type: 'uri', value: `${C}#File` },
        source: artifact.uri, confidence: 1, method: 'fs-read',
      },
      {
        subject: fIri, predicate: `${C}#path`,
        object: { type: 'literal', value: bn },
        source: artifact.uri, confidence: 1, method: 'fs-read',
      },
    ];
    for (const m of artifact.content.matchAll(IMPORT_RE)) {
      const target = `${C}/${m[1]!}.ts`;
      out.push({
        subject: fIri, predicate: `${C}#imports`,
        object: { type: 'uri', value: target },
        source: artifact.uri, confidence: 0.95, method: 'regex-import',
      });
    }
    return out;
  }
}

export class FunctionDeclExtractor implements Extractor {
  readonly name = 'FunctionDeclExtractor';
  supports(kind: SubQuestionIntent['kind']): boolean {
    return kind === 'find-symbol-in-file' || kind === 'find-dependencies';
  }
  extract(artifact: ResearchArtifact, _intent: SubQuestionIntent): CandidateTriple[] {
    const { iri: fIri } = fileIri(artifact.uri);
    const out: CandidateTriple[] = [];
    for (const m of artifact.content.matchAll(FN_RE)) {
      const sym = m[1]!;
      const symIri = fnIri(artifact.uri, sym);
      out.push({
        subject: symIri, predicate: RDF_TYPE,
        object: { type: 'uri', value: `${C}#Function` },
        source: artifact.uri, confidence: 1, method: 'regex-fn',
      });
      out.push({
        subject: symIri, predicate: `${C}#declaredIn`,
        object: { type: 'uri', value: fIri },
        source: artifact.uri, confidence: 1, method: 'regex-fn',
      });
    }
    return out;
  }
}

export class EnvVarExtractor implements Extractor {
  readonly name = 'EnvVarExtractor';
  supports(kind: SubQuestionIntent['kind']): boolean {
    return kind === 'find-readers-of' || kind === 'find-dependencies';
  }
  extract(artifact: ResearchArtifact, _intent: SubQuestionIntent): CandidateTriple[] {
    const out: CandidateTriple[] = [];
    const fns: string[] = [];
    for (const m of artifact.content.matchAll(FN_RE)) fns.push(m[1]!);
    const envs: string[] = [];
    for (const m of artifact.content.matchAll(ENV_RE)) envs.push(m[1]!);
    for (const env of envs) {
      out.push({
        subject: envIri(env), predicate: RDF_TYPE,
        object: { type: 'uri', value: `${C}#EnvVar` },
        source: artifact.uri, confidence: 1, method: 'regex-env',
      });
      for (const fn of fns) {
        out.push({
          subject: fnIri(artifact.uri, fn), predicate: `${C}#reads`,
          object: { type: 'uri', value: envIri(env) },
          source: artifact.uri, confidence: 0.6, method: 'regex-env-near-fn',
        });
      }
    }
    return out;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter predicate-agent test tests/extractor.test.ts
```

Expected: 8 passed.

- [ ] **Step 5: Re-export**

```typescript
// packages/predicate-agent/src/index.ts
// Append:
export * from './extractor.js';
```

- [ ] **Step 6: typecheck + lint**

```bash
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-agent lint
```

Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-agent/src/extractor.ts \
        packages/predicate-agent/src/index.ts \
        packages/predicate-agent/tests/extractor.test.ts
git commit -m "feat(agent): three regex extractors (imports, function decls, env-vars)"
```

---

## Task 4: Extend `researchGoal` with `executeResearch` flag

When `executeResearch: true`, after computing the plan, the orchestrator:
1. For each answerable sub-question, calls each registered source.
2. For each artifact + each extractor that supports the intent, gathers candidate triples.
3. Asserts each candidate via `kgAssert`. Catches per-triple errors and counts them as rejected (the TBox-membership check from Phase-2 P2 will reject undeclared predicates).
4. Returns a `GoalPlanWithStats`.

When `executeResearch: false` (default), behavior is identical to Phase 3a.

**Files:**
- Modify: `packages/predicate-agent/src/research-goal.ts`
- Modify: `packages/predicate-agent/tests/research-goal.test.ts`

- [ ] **Step 1: Read the current `research-goal.ts` from Phase 3a**

It exports `researchGoal(client, input): GoalPlan` and an `ResearchGoalInput` interface. Phase 3b extends both.

- [ ] **Step 2: Write the failing test (append to `tests/research-goal.test.ts`)**

Read the file. After the existing `describe('researchGoal', …)` block, append:

```typescript
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocsResearchSource } from '../src/research-source.js';
import { ImportExtractor, FunctionDeclExtractor, EnvVarExtractor } from '../src/extractor.js';

describe('researchGoal with executeResearch=true', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'predicate-research-exec-'));
    writeFileSync(join(root, 'auth.ts'),
      "import { verifyJwt } from './jwt';\nexport function login() { return verifyJwt('') }");
    writeFileSync(join(root, 'jwt.ts'),
      "export function verifyJwt(t: string) { return process.env.JWT_SECRET !== undefined }");
  });

  it('asserts triples to kg:abox and populates stats', async () => {
    const plan = await researchGoal(client, {
      goal: 'what depends on auth.ts transitively',
      source: 'user',
      executeResearch: true,
      sources: [new DocsResearchSource({ root, extensions: ['.ts'] })],
      extractors: [new ImportExtractor(), new FunctionDeclExtractor(), new EnvVarExtractor()],
    });
    expect(plan.stats).toBeDefined();
    const total = plan.stats!.reduce((n, s) => n + s.assertedCount, 0);
    expect(total).toBeGreaterThanOrEqual(6);

    const ok = await client.ask(`
      PREFIX c: <https://industriagents.com/predicate/codebase#>
      ASK { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/auth.ts> c:imports <https://industriagents.com/predicate/codebase/jwt.ts>
      } }
    `);
    expect(ok).toBe(true);
  });

  it('writes nothing when executeResearch is omitted (backward compatibility)', async () => {
    // Reset kg:abox first
    await client.update('DROP SILENT GRAPH <kg:abox>');
    await client.update('CREATE SILENT GRAPH <kg:abox>');
    const plan = await researchGoal(client, {
      goal: 'what depends on auth.ts transitively',
      source: 'user',
    });
    expect((plan as { stats?: unknown }).stats).toBeUndefined();
    const r = await client.select('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }');
    expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(0);
  });

  it('cleanup temp dir', () => {
    rmSync(root, { recursive: true, force: true });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm --filter predicate-agent test tests/research-goal.test.ts
```

Expected: the two new tests fail (current `researchGoal` doesn't accept `executeResearch`, `sources`, or `extractors`).

- [ ] **Step 4: Implement the extended `researchGoal`**

Replace the file `packages/predicate-agent/src/research-goal.ts` with:

```typescript
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { kgAssert, type Triple } from 'predicate-mcp/src/tools/kg-assert.js';
import { GoalStore } from './goal-store.js';
import { Decomposer } from './decomposer.js';
import { GapDetector } from './gap-detector.js';
import type {
  CandidateTriple, GoalPlan, GoalPlanWithStats,
  ResearchStats, SubQuestion,
} from './types.js';
import type { ResearchSource } from './research-source.js';
import type { Extractor } from './extractor.js';

export interface ResearchGoalInput {
  goal: string;
  source: 'user' | 'inferred';
  parentGoal?: string;
  /** When true, execute the research loop and assert candidate triples. */
  executeResearch?: boolean;
  /** Required when executeResearch is true. */
  sources?: ResearchSource[];
  /** Required when executeResearch is true. */
  extractors?: Extractor[];
}

export async function researchGoal(
  client: SparqlClient,
  input: ResearchGoalInput,
): Promise<GoalPlan | GoalPlanWithStats> {
  const store = new GoalStore(client);
  const decomposer = new Decomposer();
  const detector = new GapDetector(client);

  const goal = await store.create({
    statement: input.goal,
    source: input.source,
    parentGoal: input.parentGoal,
  });

  const subQuestions = decomposer.decompose(input.goal);
  const gaps = await Promise.all(subQuestions.map((sq) => detector.detect(sq)));

  const base: GoalPlan = { goalId: goal.id, subQuestions, gaps };
  if (!input.executeResearch) return base;

  const sources = input.sources ?? [];
  const extractors = input.extractors ?? [];
  const stats: ResearchStats[] = [];

  for (let i = 0; i < subQuestions.length; i++) {
    const sq = subQuestions[i]!;
    const gap = gaps[i]!;
    const stat: ResearchStats = {
      subQuestionId: sq.id,
      artifactsFetched: 0,
      candidatesExtracted: 0,
      assertedCount: 0,
      rejectedCount: 0,
      errors: [],
    };
    if (!gap.answerable) {
      stats.push(stat);
      continue;
    }
    for (const src of sources) {
      const artifacts = await src.fetch({ intent: sq.intent });
      stat.artifactsFetched += artifacts.length;
      for (const artifact of artifacts) {
        for (const extr of extractors) {
          if (!extr.supports(sq.intent.kind)) continue;
          const candidates = extr.extract(artifact, sq.intent);
          stat.candidatesExtracted += candidates.length;
          for (const c of candidates) {
            try {
              await assertCandidate(client, c);
              stat.assertedCount += 1;
            } catch (e) {
              stat.rejectedCount += 1;
              stat.errors.push((e as Error).message);
            }
          }
        }
      }
    }
    stats.push(stat);
  }
  return { ...base, stats };
}

async function assertCandidate(client: SparqlClient, c: CandidateTriple): Promise<void> {
  const t: Triple = {
    subject: c.subject,
    predicate: c.predicate,
    object: c.object,
    source: c.source,
    confidence: c.confidence,
    method: c.method,
  };
  await kgAssert(client, t);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter predicate-agent test tests/research-goal.test.ts
```

Expected: 5 passed (3 existing + 2 new + 1 cleanup placeholder). The cleanup `it('cleanup temp dir', …)` simply runs `rmSync` and `expect(true).toBe(true)` implicitly — if you'd rather move it to `afterAll`, that's fine too; the plan accepts either form.

Note: the existing Phase-3a test "creates a goal, decomposes it, returns sub-questions + gaps" should still pass — it calls `researchGoal` without `executeResearch`, so behavior is unchanged.

- [ ] **Step 6: Full workspace test + typecheck + lint**

```bash
pnpm test
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-agent lint
```

Expected:
- `predicate-agent`: 21 (Phase 3a) + 4 (research-types) + 5 (research-source) + 8 (extractor) + 2 (research-goal Phase 3b) = 40
- `predicate-mcp`: 34
- `predicate-reasoner`: 29
- `predicate-eval`: 7
- **Total: 110**

typecheck + lint clean.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-agent/src/research-goal.ts \
        packages/predicate-agent/tests/research-goal.test.ts
git commit -m "feat(agent): researchGoal executes loop when executeResearch=true"
```

---

## Task 5: Wire `executeResearch` through the MCP tool

The MCP `kg_research_goal` tool needs:
- A new `executeResearch` boolean input (defaults to `false` for backward compatibility).
- A default `sources` and `extractors` configuration when the flag is true — the tool can't accept JS class instances over the MCP wire.

Decision: when `executeResearch: true`, the MCP wrapper uses **a default toolkit**:
- One `DocsResearchSource` rooted at an explicit `corpusRoot` path passed in the input.
- All three extractors: `ImportExtractor`, `FunctionDeclExtractor`, `EnvVarExtractor`.

The input also requires `corpusRoot: string` when `executeResearch: true`. Validation: zod refines.

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-research-goal.ts`
- Modify: `packages/predicate-mcp/src/tools/registry.ts`
- Modify: `packages/predicate-mcp/tests/tools/kg-research-goal.test.ts`

- [ ] **Step 1: Modify `packages/predicate-mcp/src/tools/kg-research-goal.ts`**

Read the current file. Replace its contents with:

```typescript
import { SparqlClient } from '../sparql/client.js';
import {
  researchGoal,
  DocsResearchSource,
  ImportExtractor, FunctionDeclExtractor, EnvVarExtractor,
} from 'predicate-agent/src/index.js';

export interface ResearchGoalToolInput {
  goal: string;
  source?: 'user' | 'inferred';
  parentGoal?: string;
  executeResearch?: boolean;
  corpusRoot?: string;
}

export async function kgResearchGoal(
  client: SparqlClient,
  input: ResearchGoalToolInput,
): Promise<unknown> {
  const baseInput = {
    goal: input.goal,
    source: input.source ?? ('user' as const),
    parentGoal: input.parentGoal,
  };
  if (!input.executeResearch) {
    return researchGoal(client, baseInput);
  }
  if (!input.corpusRoot) {
    throw new Error(
      'executeResearch=true requires a corpusRoot path to a directory of .ts files',
    );
  }
  return researchGoal(client, {
    ...baseInput,
    executeResearch: true,
    sources: [new DocsResearchSource({
      root: input.corpusRoot,
      extensions: ['.ts'],
    })],
    extractors: [
      new ImportExtractor(),
      new FunctionDeclExtractor(),
      new EnvVarExtractor(),
    ],
  });
}
```

- [ ] **Step 2: Update the zod schema in `packages/predicate-mcp/src/tools/registry.ts`**

Read the file. Find the `kg_research_goal` entry. Update its `inputSchema` and the `handler`'s parse schema:

```typescript
{
  name: 'kg_research_goal',
  description: 'Decompose a goal and report which predicates the live TBox can/cannot answer. When executeResearch=true and corpusRoot is provided, also fetch artifacts from that directory, extract candidate triples, and assert them via kg_assert.',
  inputSchema: z.object({
    goal: z.string().min(1),
    source: z.enum(['user', 'inferred']).optional(),
    parentGoal: z.string().optional(),
    executeResearch: z.boolean().optional(),
    corpusRoot: z.string().optional(),
  }),
  handler: async (raw): Promise<unknown> => {
    const args = z.object({
      goal: z.string(),
      source: z.enum(['user', 'inferred']).optional(),
      parentGoal: z.string().optional(),
      executeResearch: z.boolean().optional(),
      corpusRoot: z.string().optional(),
    }).parse(raw);
    return kgResearchGoal(client, args);
  },
},
```

- [ ] **Step 3: Append a new test to `packages/predicate-mcp/tests/tools/kg-research-goal.test.ts`**

```typescript
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('kg_research_goal with executeResearch=true', () => {
  let root: string;
  const tools = buildTools(client);
  const tool = tools.find((t) => t.name === 'kg_research_goal')!;

  beforeEach(async () => {
    for (const g of ['kg:abox', 'kg:provenance']) {
      await client.update(`DROP SILENT GRAPH <${g}>`);
      await client.update(`CREATE SILENT GRAPH <${g}>`);
    }
    root = mkdtempSync(join(tmpdir(), 'predicate-mcp-test-'));
    writeFileSync(join(root, 'a.ts'),
      "import { b } from './b';\nexport function a() { return b() }");
    writeFileSync(join(root, 'b.ts'),
      'export function b() { return process.env.SECRET }');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('rejects executeResearch=true without corpusRoot', async () => {
    await expect(
      tool.handler({
        goal: 'what depends on a.ts transitively',
        executeResearch: true,
      }),
    ).rejects.toThrow(/corpusRoot/);
  });

  it('asserts triples when given a corpusRoot', async () => {
    const result = (await tool.handler({
      goal: 'what depends on a.ts transitively',
      executeResearch: true,
      corpusRoot: root,
    })) as { stats?: Array<{ assertedCount: number }> };
    expect(result.stats).toBeDefined();
    const total = result.stats!.reduce((n, s) => n + s.assertedCount, 0);
    expect(total).toBeGreaterThan(0);

    const ok = await client.ask(`
      PREFIX c: <https://industriagents.com/predicate/codebase#>
      ASK { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/a.ts> c:imports <https://industriagents.com/predicate/codebase/b.ts>
      } }
    `);
    expect(ok).toBe(true);
  });
});
```

The existing "is no longer a stub" test stays.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter predicate-mcp test tests/tools/kg-research-goal.test.ts
```

Expected: 3 passed (1 existing + 2 new).

- [ ] **Step 5: Full workspace test + typecheck + lint**

```bash
pnpm test
pnpm --filter predicate-mcp typecheck
pnpm --filter predicate-mcp lint
```

Expected: predicate-mcp 36 (34 + 2 new). Grand total: 112.

typecheck + lint clean.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-research-goal.ts \
        packages/predicate-mcp/src/tools/registry.ts \
        packages/predicate-mcp/tests/tools/kg-research-goal.test.ts
git commit -m "feat(mcp): kg_research_goal accepts executeResearch + corpusRoot"
```

---

## Task 6: End-to-end eval — research loop adds triples to the demo corpus

**Files:**
- Modify: `packages/predicate-eval/tests/research-loop.test.ts`

- [ ] **Step 1: Append a new test to `packages/predicate-eval/tests/research-loop.test.ts`**

Read the current file. After the existing `describe('research loop over the 5 starter questions', …)` block, append:

```typescript
import { resolve as resolvePath } from 'node:path';

describe('research loop end-to-end against the demo corpus', () => {
  beforeEach(async () => {
    for (const g of ['kg:abox', 'kg:provenance']) {
      await reset(g);
    }
  });

  it('a find-dependencies goal adds :imports edges from the demo corpus', async () => {
    const corpusRoot = resolvePath(
      import.meta.dirname, '..', 'fixtures', 'demo-corpus',
    );
    const { researchGoal, DocsResearchSource, ImportExtractor, FunctionDeclExtractor, EnvVarExtractor } =
      await import('predicate-agent/src/index.js');

    const plan = await researchGoal(client, {
      goal: 'what depends on auth.ts transitively',
      source: 'user',
      executeResearch: true,
      sources: [new DocsResearchSource({ root: corpusRoot, extensions: ['.ts'] })],
      extractors: [new ImportExtractor(), new FunctionDeclExtractor(), new EnvVarExtractor()],
    }) as { stats: Array<{ assertedCount: number }> };

    const total = plan.stats.reduce((n, s) => n + s.assertedCount, 0);
    expect(total).toBeGreaterThanOrEqual(6);

    const importOk = await client.ask(`
      PREFIX c: <https://industriagents.com/predicate/codebase#>
      ASK { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/auth.ts> c:imports <https://industriagents.com/predicate/codebase/jwt.ts>
      } }
    `);
    expect(importOk).toBe(true);

    const envReadOk = await client.ask(`
      PREFIX c: <https://industriagents.com/predicate/codebase#>
      ASK { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/jwt.ts#verifyJwt> c:reads <https://industriagents.com/predicate/codebase/env/JWT_SECRET>
      } }
    `);
    expect(envReadOk).toBe(true);
  });
});
```

The existing "research loop over the 5 starter questions" describe block still runs without changes (calls `researchGoal` without `executeResearch`).

- [ ] **Step 2: Run the test**

```bash
pnpm --filter predicate-eval test tests/research-loop.test.ts
```

Expected: 6 passed (5 plan-only + 1 new end-to-end).

- [ ] **Step 3: Full workspace test**

```bash
pnpm test
```

Expected: 113 (mcp 36 + reasoner 29 + agent 40 + eval 8).

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-eval/tests/research-loop.test.ts
git commit -m "test(eval): research loop end-to-end adds triples from demo corpus"
```

---

## Task 7: Phase 3b exit — README + tag

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update root `README.md` Status block**

Read the current README. Replace the Status section with:

```markdown
## Status

Phase 3b (Research Execution) complete: `predicate-agent` now executes the
research loop end-to-end via `ResearchSource` interface + `DocsResearchSource` +
three regex `Extractor`s. `kg_research_goal(goal, executeResearch=true,
corpusRoot=…)` fetches files, extracts candidate triples, and asserts them
through `kg_assert` (which already enforces TBox membership). Phase 3c
(schema-evolution loop — real `kg_propose_schema` + `PromotionSweeper`) is
next; outline at the bottom of
`docs/superpowers/plans/2026-05-16-predicate-phase-3a-goals-and-gaps.md`.
```

Update the package table's `predicate-agent` row description to reflect the new responsibilities:

```markdown
| `predicate-agent` | Goal store, decomposer, gap detector, research sources + extractors, orchestrator |
```

And the `predicate-mcp` row should still say "8 tools (6 implemented, 2 stubs)".

- [ ] **Step 2: Run the full suite**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Expected: all green. 113 tests.

- [ ] **Step 3: Commit and tag**

```bash
git add README.md
git commit -m "docs: README + Phase 3b status; tag v0.3b.0-research-execution"
git tag v0.3b.0-research-execution
```

- [ ] **Step 4: Confirm final state**

```bash
git log --oneline -15
git tag --list 'v*'
```

Expected tags: `v0.1.0-foundation`, `v0.2.0-discipline`, `v0.3a.0-goals-and-gaps`, `v0.3b.0-research-execution`.

---

## Self-review

- **Spec coverage:** §4.2 (assertion lifecycle: extractor flows through `kg_assert`, which is the only ABox writer per the resolution in the audit fixes) — implemented via Task 4. §6 (kg_research_goal contract) — extended in Task 5. §17 (research-source open questions) — partially addressed: `ResearchSource` interface ships; web/code sources remain deferred. Spec §6.1 (`SchemaDelta`) is unchanged in 3b; lands in Phase 3c.
- **Placeholder scan:** zero "TBD" / "implement later" / "handle errors". Every step shows actual code.
- **Type consistency:** `ResearchArtifact`, `ResearchQuery`, `CandidateTriple`, `ResearchStats`, `GoalPlanWithStats` defined once in `types.ts` and reused. The `Extractor.supports(kind)` signature is uniform across the three concrete extractors. The orchestrator's per-sub-question loop uses `gaps[i]` paired with `subQuestions[i]` — same indexing both in the test and the implementation. `assertCandidate` maps `CandidateTriple` to the existing `Triple` shape from `predicate-mcp/src/tools/kg-assert.ts` without redefining either.
- **Known follow-up:** v1 extractors are regex-based and limited to the demo corpus's content shape. They'll miss any TS feature outside the four regex patterns (named imports only; `export function` only; no `import * as`; etc.). Phase 4 introduces an LLM-augmented extractor for broader coverage. The orchestrator emits per-failure error strings in `ResearchStats.errors`, which is sufficient observability for v1.
