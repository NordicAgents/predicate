/**
 * Tests for the B-bounded completeness curves (Amendment A4.1, §4.3 primary
 * metric): unit tests of both registered rate readings on synthetic rows,
 * a real-fixture smoke on the committed conflict-chain-m2 artifacts, and a
 * byte-determinism check of the canonical serialization.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  computeBCurves, serializeBCurves, TRIPLES_GRID, BYTES_GRID,
  type BCurvePoint, type SystemBCurves,
} from '../src/instances/bcurves-cli.js';
import type { InstanceRecord, PredictionRow } from '../src/instances/types.js';

function inst(id: string, isConflict: boolean): InstanceRecord {
  return {
    id: `dom#${id}`, domain: 'dom', kind: isConflict ? 'conflict' : 'benign-coreference',
    subjects: [`http://ex/${id}`], key: null, predicate: null,
    goldValues: [], goldWitness: [], isConflict,
  };
}

function row(
  instanceId: string, system: string, flagged: boolean,
  contextTriples: number, contextBytes: number,
): PredictionRow {
  return {
    instanceId: `dom#${instanceId}`, domain: 'dom', system, flagged,
    values: [], witness: [], costMs: 0,
    extra: { contextTriples, contextBytes },
  };
}

function point(points: BCurvePoint[], budget: number | 'whole-store'): BCurvePoint {
  const p = points.find((q) => q.budget === budget);
  if (!p) throw new Error(`no point at budget ${budget}`);
  return p;
}

describe('computeBCurves — rate definitions (synthetic)', () => {
  // 10 conflicts: c0 flagged at 5 triples; c1..c9 flagged at 1000 triples.
  // At B=10 the conditional reading is 1.0 on n=1 while the primary (Def. 5.3)
  // reading is 0.1 — the reason both are emitted.
  const instances = [...Array.from({ length: 10 }, (_, i) => inst(`c${i}`, true)), inst('b0', false)];
  const rows: PredictionRow[] = instances.filter((i) => i.isConflict).map((i, idx) =>
    row(i.id.split('#')[1]!, 'retrieval:key-aware@1', true, idx === 0 ? 5 : 1000, idx === 0 ? 512 : 90000));

  const result = computeBCurves('dom', instances, rows);
  const sys = result.systems.find((s) => s.system === 'retrieval:key-aware@1')!;

  it('primaryRate divides by ALL conflict instances; conditionalRate by n within budget', () => {
    const p10 = point(sys.triples, 10);
    expect(p10.primaryRate).toBe(0.1);
    expect(p10.conditionalRate).toBe(1.0);
    expect(p10.n).toBe(1);
  });

  it('conditionalRate is null when no instance fits the budget', () => {
    expect(point(sys.triples, 5).n).toBe(1); // c0 sits exactly at the boundary
    const tight = computeBCurves('dom', instances,
      rows.map((r) => ({ ...r, extra: { contextTriples: 6, contextBytes: 2000 } })));
    const t5 = point(tight.systems[0]!.triples, 5);
    expect(t5.n).toBe(0);
    expect(t5.conditionalRate).toBeNull();
    expect(t5.primaryRate).toBe(0);
  });

  it('whole-store point is the plain flagged rate with no context cap', () => {
    const ws = point(sys.triples, 'whole-store');
    expect(ws.primaryRate).toBe(1.0);
    expect(ws.conditionalRate).toBe(1.0);
    expect(ws.n).toBe(10);
    expect(point(sys.bytes, 'whole-store')).toEqual(ws);
  });

  it('un-flagged rows never count toward primaryRate even within budget', () => {
    const r = computeBCurves('dom', instances, instances.filter((i) => i.isConflict)
      .map((i) => row(i.id.split('#')[1]!, 'retrieval:iri-bfs@1', false, 3, 100)));
    const s = r.systems[0]!;
    expect(point(s.triples, 5).primaryRate).toBe(0);
    expect(point(s.triples, 5).conditionalRate).toBe(0);
    expect(point(s.triples, 5).n).toBe(10);
    expect(point(s.triples, 'whole-store').primaryRate).toBe(0);
  });

  it('missing rows count as un-flagged with infinite context and warn loudly', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const r = computeBCurves('dom', instances,
        rows.filter((x) => x.instanceId !== 'dom#c0')); // drop one conflict row
      const s = r.systems[0]!;
      // c0 missing: excluded from every finite point, un-flagged at whole-store.
      expect(point(s.triples, 10).n).toBe(0);
      expect(point(s.triples, 10).conditionalRate).toBeNull();
      expect(point(s.triples, 'whole-store').primaryRate).toBe(0.9);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('WARNING'));
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('1 conflict instance(s) with no prediction row'));
    } finally {
      spy.mockRestore();
    }
  });

  it('ignores out-of-scope systems (cwi-pointer/cwi-flag) and benign instances', () => {
    const r = computeBCurves('dom', instances, [
      ...rows,
      row('c0', 'cwi-pointer', true, 0, 0),
      row('c0', 'cwi-flag', true, 0, 0),
      row('b0', 'retrieval:key-aware@1', true, 1, 1),
    ]);
    expect(r.systems.map((s) => s.system)).toEqual(['retrieval:key-aware@1']);
    expect(r.conflictInstances).toBe(10);
    // the benign flagged row must not leak into any point
    expect(point(r.systems[0]!.triples, 5).n).toBe(1);
  });
});

describe('bcurves — real-fixture smoke on conflict-chain-m2 committed artifacts', () => {
  const root = join(import.meta.dirname, '..');
  const domain = 'conflict-chain-m2';
  const instances = JSON.parse(
    readFileSync(join(root, 'fixtures', domain, 'instances.json'), 'utf8'),
  ) as InstanceRecord[];
  const rows: PredictionRow[] = [
    join(root, 'results', 'retrieval', `retrieval.${domain}.jsonl`),
    join(root, 'results', 'cwi', `cwi.${domain}.jsonl`),
  ].flatMap((f) => readFileSync(f, 'utf8').split('\n').filter(Boolean)
    .map((l) => JSON.parse(l) as PredictionRow));

  const result = computeBCurves(domain, instances, rows);
  const sys = (name: string): SystemBCurves => {
    const s = result.systems.find((x) => x.system === name);
    if (!s) throw new Error(`system ${name} not in curves`);
    return s;
  };

  it('covers the retrieval sweep plus cwi-witness only', () => {
    expect(result.systems).toHaveLength(13); // 3 policies x 4 k + cwi-witness
    expect(result.systems.some((s) => s.system === 'cwi-witness')).toBe(true);
    expect(result.systems.every((s) => s.system === 'cwi-witness' || s.system.startsWith('retrieval:'))).toBe(true);
    expect(result.grids.triples).toEqual([...TRIPLES_GRID]);
    expect(result.grids.bytes).toEqual([...BYTES_GRID]);
  });

  it('cwi-witness is complete at triples budget 10 and whole-store', () => {
    expect(point(sys('cwi-witness').triples, 10).primaryRate).toBe(1.0);
    expect(point(sys('cwi-witness').triples, 'whole-store').primaryRate).toBe(1.0);
  });

  it('retrieval:key-aware@2 crosses between budgets 50 and 100 (mean ctx 94.6, max 98)', () => {
    expect(point(sys('retrieval:key-aware@2').triples, 50).primaryRate).toBe(0.0);
    expect(point(sys('retrieval:key-aware@2').triples, 100).primaryRate).toBe(1.0);
  });

  it('retrieval:iri-bfs@4 stays at 0 even at whole-store (IRI-isolated intermediates)', () => {
    expect(point(sys('retrieval:iri-bfs@4').triples, 'whole-store').primaryRate).toBe(0.0);
  });
});

describe('bcurves — determinism', () => {
  it('two independent computations serialize byte-identically', () => {
    const root = join(import.meta.dirname, '..');
    const domain = 'conflict-chain-m2';
    const run = (): string => {
      const instances = JSON.parse(
        readFileSync(join(root, 'fixtures', domain, 'instances.json'), 'utf8'),
      ) as InstanceRecord[];
      const rows: PredictionRow[] = [
        join(root, 'results', 'retrieval', `retrieval.${domain}.jsonl`),
        join(root, 'results', 'cwi', `cwi.${domain}.jsonl`),
      ].flatMap((f) => readFileSync(f, 'utf8').split('\n').filter(Boolean)
        .map((l) => JSON.parse(l) as PredictionRow));
      return serializeBCurves(computeBCurves(domain, instances, rows));
    };
    const a = run();
    const b = run();
    expect(a).toBe(b);
    // no run-variable fields may leak into the canonical artifact
    expect(a).not.toMatch(/"(timestamp|generatedAt|costMs|queryUs|ingestMs)"/);
  });
});
