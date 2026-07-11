import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runXrStats, bootstrapCI } from '../src/conflict/xr-stats.js';
import type { Question } from '../src/eval-types.js';

const client = getAdapter();

interface CorefPair { records: [string, string]; email: string; conflicted: boolean }

describe('xr-stats — statistical hardening runner (smoke: seed 11, hops 1-2)', () => {
  it('tier1 ON is perfect, twin unreachable at k<=2 both directions, prompts are leak-free', async () => {
    const out = mkdtempSync(join(tmpdir(), 'xr-stats-'));
    const res = await runXrStats(client, {
      seeds: [11], hops: [1, 2], variantName: 'conflict-xr-small', outDir: out,
    });

    // Reasoner reference: inference-ON accuracy is exactly 1 (no anomaly).
    expect(res.tier1).toHaveLength(1);
    expect(res.tier1[0]!.onAccuracy).toBe(1);
    expect(res.tier1[0]!.anomaly).toBeNull();

    // Deterministic k-sweep: EVERY conflicted pair (12 at 20% of 60 persons),
    // probed from BOTH directions, misses its twin at k=1 and k=2.
    const conflicted = res.ksweepDetail.filter((p) => p.kind === 'conflicted');
    expect(conflicted).toHaveLength(12 * 2 * 2); // pairs x directions x hops
    for (const p of conflicted) {
      expect(p.twinInBall, `twin reachable: ${p.direction} k=${p.k} seed-record ${p.seedRecord}`).toBe(false);
    }
    for (const row of res.ksweep.filter((r) => r.kind === 'conflicted')) {
      expect(row.twinReachRate, `aggregate reach at k=${row.k} ${row.direction}`).toBe(0);
    }
    // Benign pairs run through the same mechanism (3 per seed).
    expect(res.ksweepDetail.filter((p) => p.kind === 'benign')).toHaveLength(3 * 2 * 2);

    // Prompt files exist and contain no oracle leakage.
    const flatAllPath = join(out, 'prompts', 'xr-s11-flat-all.txt');
    const flatRetrPath = join(out, 'prompts', 'xr-s11-flat-retrieved.txt');
    expect(existsSync(flatAllPath)).toBe(true);
    expect(existsSync(flatRetrPath)).toBe(true);
    const flatAll = readFileSync(flatAllPath, 'utf8');
    const flatRetr = readFileSync(flatRetrPath, 'utf8');
    expect(flatAll).not.toContain('oracle');
    expect(flatRetr).not.toContain('oracle');

    // The flat-retrieved context for q02 must not contain the twin record IRI
    // (that is the structural miss the benchmark measures).
    const fixtureDir = join(out, 'fixtures', 'xr-s11');
    const questions = JSON.parse(readFileSync(join(fixtureDir, 'questions.json'), 'utf8')) as Question[];
    const q02 = questions.find((q) => q.id === 'xr-s11-q02')!;
    const q02seed = q02.retrieval_seeds![0]!;
    const oracle = JSON.parse(readFileSync(join(fixtureDir, 'oracle.json'), 'utf8')) as {
      coreference: CorefPair[];
    };
    const pair = oracle.coreference.find((c) => c.records.includes(q02seed))!;
    expect(pair.conflicted).toBe(true);
    const twin = pair.records.find((r) => r !== q02seed)!;

    const tasks = readFileSync(join(out, 'tasks', 'xr-s11-flat-retrieved.jsonl'), 'utf8')
      .trim().split('\n').map((l) => JSON.parse(l) as { id: string; context: string });
    const q02task = tasks.find((t) => t.id === 'xr-s11-q02')!;
    expect(q02task.context).not.toContain(twin);
    // And the same holds inside the rendered prompt's q02 section.
    const q02section = flatRetr.split('## Question ')
      .find((s) => s.startsWith('2 — id=xr-s11-q02'))!;
    expect(q02section).toBeDefined();
    expect(q02section).not.toContain(twin);
    expect(q02section).toContain(q02seed);

    // Result JSON persisted for later scoring.
    expect(existsSync(join(out, 'xr-stats.conflict-xr-small.json'))).toBe(true);
  }, 55_000);

  it('bootstrapCI is seeded/deterministic and sane on constant input', () => {
    const a = bootstrapCI([0, 0, 0, 1, 1], 2000, 7);
    const b = bootstrapCI([0, 0, 0, 1, 1], 2000, 7);
    expect(a).toEqual(b);
    expect(a.mean).toBeCloseTo(0.4, 10);
    expect(a.lo95).toBeGreaterThanOrEqual(0);
    expect(a.hi95).toBeLessThanOrEqual(1);
    expect(a.lo95).toBeLessThanOrEqual(a.hi95);
    const c = bootstrapCI([1, 1, 1, 1]);
    expect(c).toEqual({ mean: 1, lo95: 1, hi95: 1 });
  });
});
