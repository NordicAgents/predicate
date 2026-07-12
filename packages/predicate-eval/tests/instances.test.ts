import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { buildInstanceManifest } from '../src/instances/manifest.js';
import { runReasonerArm, SYSTEM } from '../src/instances/reasoner-arm-cli.js';
import { scorePredictions } from '../src/instances/score-cli.js';
import type { InstanceRecord, PredictionRow } from '../src/instances/types.js';

const client = getAdapter();
const fixtureDir = (domain: string): string => join(import.meta.dirname, '..', 'fixtures', domain);

const countByKind = (instances: InstanceRecord[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const i of instances) out[i.kind] = (out[i.kind] ?? 0) + 1;
  return out;
};

describe('instance-level benchmark — manifest derivation', () => {
  it('conflict-xr-small: 12 conflict pairs + 3 benign-coreference + 1 benign-shared-value', () => {
    const instances = buildInstanceManifest(fixtureDir('conflict-xr-small'));
    expect(countByKind(instances)).toEqual({
      conflict: 12, 'benign-coreference': 3, 'benign-shared-value': 1,
    });
    expect(instances.length).toBe(16);

    for (const inst of instances.filter((i) => i.kind === 'conflict')) {
      expect(inst.isConflict).toBe(true);
      expect(inst.subjects.length).toBe(2);              // cross-record pair
      expect(inst.key).toMatch(/^p\d{3}@ex\.com$/);       // shared email key
      expect(inst.predicate).toBe('http://ex/cb2#office');
      expect(new Set(inst.goldValues).size).toBe(2);      // two DISTINCT values
      expect(inst.goldWitness.length).toBe(6);            // 2 types + 2 emails + 2 values
      expect(inst.id).toMatch(/^conflict-xr-small#pair-p\d{3}$/);
    }
    for (const inst of instances.filter((i) => !i.isConflict)) {
      expect(inst.id).toMatch(/^conflict-xr-small#benign-/);
    }
    // Benign co-referent pairs agree: one distinct value, 6 witness triples.
    for (const inst of instances.filter((i) => i.kind === 'benign-coreference')) {
      expect(inst.subjects.length).toBe(2);
      expect(inst.goldValues.length).toBe(1);
      expect(inst.goldWitness.length).toBe(6);
    }
    // The shared-value pair shares a value on a single-valued property
    // WITHOUT a shared key — the classic false-positive probe.
    const shared = instances.find((i) => i.kind === 'benign-shared-value')!;
    expect(shared.subjects.length).toBe(2);
    expect(shared.key).toBeNull();
    expect(shared.goldValues.length).toBe(1);
  });

  it('conflict-xr-scale: 60 conflict pairs and the same benign slices', () => {
    const instances = buildInstanceManifest(fixtureDir('conflict-xr-scale'));
    expect(countByKind(instances)).toEqual({
      conflict: 60, 'benign-coreference': 3, 'benign-shared-value': 1,
    });
  });

  it('conflict-d20 (v1 same-subject): 8 conflicts + benign slices, 2-triple witnesses', () => {
    const instances = buildInstanceManifest(fixtureDir('conflict-d20'));
    expect(countByKind(instances)).toEqual({
      conflict: 8,
      'benign-duplicate': 2,
      'benign-multivalued': 2,   // 3 oracle additions merge to 2 (s,p) instances
      'benign-shared-value': 2,  // v1: one instance per shared-object subject
    });
    for (const inst of instances.filter((i) => i.kind === 'conflict')) {
      expect(inst.subjects.length).toBe(1);              // same-subject conflict
      expect(inst.key).toBeNull();
      expect(inst.goldValues.length).toBe(2);
      // v1 witness = exactly the two value assertions, verified against facts
      expect(inst.goldWitness).toEqual(
        inst.goldValues.map((v) => `${inst.subjects[0]}|${inst.predicate}|${v}`),
      );
      expect(inst.id).toMatch(/^conflict-d20#subject-p\d{2}$/);
    }
    const multi = instances.filter((i) => i.kind === 'benign-multivalued');
    for (const inst of multi) expect(inst.goldValues.length).toBeGreaterThanOrEqual(2);
  });

  it('manifest is deterministic (two builds are deep-equal) and ids are unique', () => {
    const a = buildInstanceManifest(fixtureDir('conflict-xr-small'));
    const b = buildInstanceManifest(fixtureDir('conflict-xr-small'));
    expect(a).toEqual(b);
    expect(new Set(a.map((i) => i.id)).size).toBe(a.length);
  });
});

describe('instance-level benchmark — reasoner arm (r14 -> r23 -> r22)', () => {
  it('conflict-xr-small: perfect P/R/F1, both-value recall 1, witness recall 1', async () => {
    const instances = buildInstanceManifest(fixtureDir('conflict-xr-small'));
    const { rows } = await runReasonerArm(client, 'conflict-xr-small', fixtureDir('conflict-xr-small'));
    expect(rows.length).toBe(instances.length);

    const [score] = scorePredictions(instances, rows);
    expect(score!.system).toBe(SYSTEM);
    expect(score!.missing).toBe(0);
    expect(score!.conflict).toMatchObject({ tp: 12, fp: 0, fn: 0, tn: 4, precision: 1, recall: 1, f1: 1 });
    expect(score!.bothValueRecall).toBe(1);
    expect(score!.witnessRecall).toBe(1);
    expect(score!.meanCostMs).toBeGreaterThan(0);
    // Benign slices are NOT flagged (no false-positive source).
    expect(score!.perKind['benign-coreference']).toMatchObject({ n: 3, flagged: 0 });
    expect(score!.perKind['benign-shared-value']).toMatchObject({ n: 1, flagged: 0 });
  }, 240_000);
});

describe('instance-level benchmark — scorer math (hand-built predictions)', () => {
  const toy = (over: Partial<InstanceRecord> & Pick<InstanceRecord, 'id' | 'kind' | 'isConflict'>): InstanceRecord => ({
    domain: 'toy', subjects: ['http://ex/a'], key: null, predicate: 'http://ex/p',
    goldValues: [], goldWitness: [], ...over,
  });
  const instances: InstanceRecord[] = [
    toy({ id: 'toy#subject-a', kind: 'conflict', isConflict: true, goldValues: ['v1', 'v2'], goldWitness: ['a|p|v1', 'a|p|v2'] }),
    toy({ id: 'toy#subject-b', kind: 'conflict', isConflict: true, goldValues: ['v3', 'v4'], goldWitness: ['b|p|v3', 'b|p|v4'] }),
    toy({ id: 'toy#benign-coreference-c', kind: 'benign-coreference', isConflict: false }),
    toy({ id: 'toy#benign-shared-value-d', kind: 'benign-shared-value', isConflict: false }),
  ];
  const row = (over: Partial<PredictionRow> & Pick<PredictionRow, 'instanceId' | 'flagged'>): PredictionRow => ({
    domain: 'toy', system: 'toy-system', values: [], witness: [], costMs: 10, extra: {}, ...over,
  });

  it('deliberate FP + FN: precision/recall/F1 = 0.5, partial value and witness recall', () => {
    const rows: PredictionRow[] = [
      // TP: flagged conflict with full values + witness.
      row({ instanceId: 'toy#subject-a', flagged: true, values: ['v1', 'v2'], witness: ['a|p|v1', 'a|p|v2'] }),
      // FN: missed conflict; sees one value, cites one witness triple.
      row({ instanceId: 'toy#subject-b', flagged: false, values: ['v3'], witness: ['b|p|v3'] }),
      // FP: benign instance wrongly flagged.
      row({ instanceId: 'toy#benign-coreference-c', flagged: true }),
      // TN.
      row({ instanceId: 'toy#benign-shared-value-d', flagged: false, costMs: 40 }),
    ];
    const [s] = scorePredictions(instances, rows);
    expect(s!.conflict).toMatchObject({ tp: 1, fp: 1, fn: 1, tn: 1 });
    expect(s!.conflict.precision).toBeCloseTo(0.5, 10);
    expect(s!.conflict.recall).toBeCloseTo(0.5, 10);
    expect(s!.conflict.f1).toBeCloseTo(0.5, 10);
    expect(s!.bothValueRecall).toBeCloseTo(0.5, 10);            // only A has both values
    expect(s!.witnessRecall).toBeCloseTo((1 + 0.5) / 2, 10);    // A full, B half
    expect(s!.meanCostMs).toBeCloseTo((10 + 10 + 10 + 40) / 4, 10);
    expect(s!.perKind).toEqual({
      conflict: { n: 2, flagged: 1, missing: 0 },
      'benign-coreference': { n: 1, flagged: 1, missing: 0 },
      'benign-shared-value': { n: 1, flagged: 0, missing: 0 },
    });
  });

  it('missing prediction rows count as un-flagged (FN for conflicts) and are reported', () => {
    const rows: PredictionRow[] = [
      row({ instanceId: 'toy#subject-a', flagged: true, values: ['v1', 'v2'], witness: ['a|p|v1', 'a|p|v2'] }),
      // no rows for b, c, d
    ];
    const [s] = scorePredictions(instances, rows);
    expect(s!.missing).toBe(3);
    expect(s!.conflict).toMatchObject({ tp: 1, fp: 0, fn: 1, tn: 2 });
    expect(s!.conflict.precision).toBe(1);
    expect(s!.conflict.recall).toBeCloseTo(0.5, 10);
    expect(s!.perKind['conflict']).toMatchObject({ missing: 1 });
  });

  it('systems are scored independently and sorted by name', () => {
    const rows: PredictionRow[] = [
      row({ instanceId: 'toy#subject-a', flagged: true, system: 'zeta' }),
      row({ instanceId: 'toy#subject-a', flagged: false, system: 'alpha' }),
    ];
    const scores = scorePredictions(instances, rows);
    expect(scores.map((s) => s.system)).toEqual(['alpha', 'zeta']);
    expect(scores[0]!.conflict.tp).toBe(0);
    expect(scores[1]!.conflict.tp).toBe(1);
  });
});
