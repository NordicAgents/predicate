import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { deriveInstances } from '../src/exact/instances.js';
import { runKeyJoin, type ExactRunResult } from '../src/exact/key-join.js';
import { runSparqlGroupBy } from '../src/exact/sparql-groupby.js';
import { buildPredictionRows } from '../src/exact/predict.js';
import type { InstanceRecord } from '../src/exact/contract.js';

/**
 * Gate-A check for the exact/non-LLM baselines: a plain hash join and a
 * single SPARQL GROUP BY per property must both solve CONFLICT-BENCH
 * perfectly (P=R=1) with zero false positives on every benign slice.
 * (Runs under the vitest-injected PREDICATE_BACKEND=oxigraph-wasm,
 * PREDICATE_STORE_PATH=:memory: env.)
 */

const fixtures = join(import.meta.dirname, '..', 'fixtures');
const XR = 'conflict-xr-small';
const D20 = 'conflict-d20';

function scored(
  instances: InstanceRecord[], res: ExactRunResult, system: string,
): ReturnType<typeof buildPredictionRows> {
  return buildPredictionRows({
    instances, detections: res.detections, index: res.index, system, totalMs: res.timings.totalMs,
  });
}

describe('instance derivation (shared contract)', () => {
  it('conflict-xr-small: 12 conflict pairs + 3 benign corefs + 1 shared-office pair', () => {
    const instances = deriveInstances(XR, join(fixtures, XR));
    expect(instances).toHaveLength(16);
    const byKind = (k: string): InstanceRecord[] => instances.filter((i) => i.kind === k);
    expect(byKind('conflict')).toHaveLength(12);
    expect(byKind('benign-coreference')).toHaveLength(3);
    // one paired instance matching the canonical manifest id (Amendment A1 reconciliation)
    expect(byKind('benign-shared-value').map((i) => i.id)).toEqual([`${XR}#benign-shared-value-p048-p006`]);
    expect(byKind('benign-shared-value')[0]!.subjects).toHaveLength(2);
    const pair = instances.find((i) => i.id === `${XR}#pair-p002`)!;
    expect(pair.subjects).toEqual(['http://ex/cb2/s1-p002', 'http://ex/cb2/s2-p002']);
    expect(pair.key).toBe('p002@ex.com');
    expect(pair.goldValues).toHaveLength(2);
    expect(pair.goldWitness).toHaveLength(6); // 2 types + 2 emails + 2 values
    expect(pair.isConflict).toBe(true);
  });

  it('conflict-d20: 8 same-subject conflicts + 6 benign instances', () => {
    const instances = deriveInstances(D20, join(fixtures, D20));
    expect(instances.filter((i) => i.isConflict)).toHaveLength(8);
    expect(instances.filter((i) => i.kind === 'benign-duplicate')).toHaveLength(2);
    expect(instances.filter((i) => i.kind === 'benign-multivalued')).toHaveLength(2);
    expect(instances.filter((i) => i.kind === 'benign-shared-value')).toHaveLength(2);
    const c = instances.find((i) => i.id === `${D20}#subject-p06`)!;
    expect(c.goldWitness).toHaveLength(2); // the 2 conflicting value assertions
  });
});

describe.each([
  ['exact-key-join', async (dir: string): Promise<ExactRunResult> => runKeyJoin(dir)],
  ['sparql-groupby', async (dir: string): Promise<ExactRunResult> => runSparqlGroupBy(getAdapter(), dir)],
] as const)('%s', (system, run) => {
  it(`is perfect on ${XR} with zero FPs on every benign slice`, async () => {
    const instances = deriveInstances(XR, join(fixtures, XR));
    const res = await run(join(fixtures, XR));
    const { rows, score } = scored(instances, res, system);

    expect(score.tp).toBe(12);
    expect(score.fn).toBe(0);
    expect(score.fp).toBe(0);
    expect(score.precision).toBe(1);
    expect(score.recall).toBe(1);
    expect(score.f1).toBe(1);
    expect(score.spuriousDetections).toBe(0);
    // zero FPs per benign slice, checked row-by-row
    for (const inst of instances.filter((i) => !i.isConflict)) {
      const row = rows.find((r) => r.instanceId === inst.id)!;
      expect(row.flagged, `${inst.kind} ${inst.id} must not be flagged`).toBe(false);
    }
    // flagged conflict rows carry gold-equivalent values + the 6-triple witness
    for (const inst of instances.filter((i) => i.isConflict)) {
      const row = rows.find((r) => r.instanceId === inst.id)!;
      expect(row.flagged).toBe(true);
      expect([...row.values].sort()).toEqual([...inst.goldValues].sort());
      expect([...row.witness].sort()).toEqual([...inst.goldWitness].sort());
    }
  });

  it(`is perfect on ${D20} with zero FPs on duplicate/multivalued/shared slices`, async () => {
    const instances = deriveInstances(D20, join(fixtures, D20));
    const res = await run(join(fixtures, D20));
    const { rows, score } = scored(instances, res, system);

    expect(score.tp).toBe(8);
    expect(score.fn).toBe(0);
    expect(score.fp).toBe(0);
    expect(score.f1).toBe(1);
    expect(score.spuriousDetections).toBe(0);
    for (const inst of instances.filter((i) => !i.isConflict)) {
      const row = rows.find((r) => r.instanceId === inst.id)!;
      expect(row.flagged, `${inst.kind} ${inst.id} must not be flagged`).toBe(false);
    }
    for (const inst of instances.filter((i) => i.isConflict)) {
      const row = rows.find((r) => r.instanceId === inst.id)!;
      expect(row.flagged).toBe(true);
      expect([...row.witness].sort()).toEqual([...inst.goldWitness].sort());
    }
  });
});
