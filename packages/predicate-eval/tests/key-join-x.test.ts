import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveInstances } from '../src/exact/instances.js';
import { runKeyJoin } from '../src/exact/key-join.js';
import { runKeyJoinX } from '../src/exact/key-join-x.js';
import { buildPredictionRows } from '../src/exact/predict.js';
import { parseTBoxSchema } from '../src/exact/tbox.js';

/**
 * exact-key-join-x (pre-registration Amendment A2.3): the Prop. 4 full-
 * fragment baseline — union-find ~K closure + tau/sigma overlap partitioning.
 * Registered expectations: perfect on the chain and tausig fixtures where the
 * single-join baseline is structurally insufficient / over-flags (H6.i,
 * H6.ii, H7), and EXACTLY the plain join's detections on mechanism-v0.
 */

const fixtures = join(import.meta.dirname, '..', 'fixtures');

function score(domain: string, run: typeof runKeyJoinX): ReturnType<typeof buildPredictionRows>['score'] {
  const dir = join(fixtures, domain);
  const res = run(dir);
  return buildPredictionRows({
    instances: deriveInstances(domain, dir), detections: res.detections,
    index: res.index, system: 'test', totalMs: res.timings.totalMs,
  }).score;
}

describe('chain fixtures (H6.i / H6.ii)', () => {
  it.each(['conflict-chain-m2', 'conflict-chain-m3'])(
    '%s: plain join finds NOTHING (structural), extended join is perfect', (domain) => {
      const plain = score(domain, runKeyJoin);
      expect(plain.tp).toBe(0);
      expect(plain.fp).toBe(0);
      expect(plain.spuriousDetections).toBe(0);
      const x = score(domain, runKeyJoinX);
      expect(x.precision).toBe(1);
      expect(x.recall).toBe(1);
      expect(x.fpBySlice).toEqual({});
      expect(x.spuriousDetections).toBe(0);
    },
  );

  it('chain detections cover ALL chain members (intermediates included) and cite a full witness', () => {
    const domain = 'conflict-chain-m2';
    const dir = join(fixtures, domain);
    const res = runKeyJoinX(dir);
    expect(res.detections).toHaveLength(10);
    for (const d of res.detections) {
      expect(d.subjects).toHaveLength(3);
      expect(d.witnessTriples!.length).toBeGreaterThanOrEqual(9);
    }
    const instances = deriveInstances(domain, dir);
    const { rows } = buildPredictionRows({
      instances, detections: res.detections, index: res.index, system: 'x', totalMs: 1,
    });
    for (const inst of instances.filter((i) => i.isConflict)) {
      const row = rows.find((r) => r.instanceId === inst.id)!;
      expect(row.flagged).toBe(true);
      for (const w of inst.goldWitness) expect(row.witness).toContain(w);
      expect(row.values).toEqual(inst.goldValues);
    }
  });
});

describe('tausig fixture (H7)', () => {
  it('plain join over-flags all temporal/scoped negatives; extended join flags none', () => {
    const plain = score('conflict-tausig', runKeyJoin);
    expect(plain.recall).toBe(1);
    expect(plain.fpBySlice).toEqual({ 'benign-temporal': 12, 'benign-scoped': 12 });
    const x = score('conflict-tausig', runKeyJoinX);
    expect(x.precision).toBe(1);
    expect(x.recall).toBe(1);
    expect(x.fpBySlice).toEqual({});
  });

  it('tau/sigma annotation properties are read from TBox markers, not hardcoded', () => {
    const schema = parseTBoxSchema(readFileSync(join(fixtures, 'conflict-tausig', 'world.ttl'), 'utf8'));
    expect(schema.validFromProp).toBe('http://ex/cb3#validFrom');
    expect(schema.validToProp).toBe('http://ex/cb3#validTo');
    expect(schema.scopeProp).toBe('http://ex/cb3#sourceScope');
    const mech = parseTBoxSchema(readFileSync(join(fixtures, 'conflict-xr-small', 'world.ttl'), 'utf8'));
    expect(mech.validFromProp).toBeNull();
    expect(mech.scopeProp).toBeNull();
  });
});

describe('mechanism-v0 regression (A2.3: x reduces to the plain join)', () => {
  it.each(['conflict-d20', 'conflict-xr-small', 'conflict-xr-scale'])(
    '%s: identical detection sets (subjects + predicate + values)', (domain) => {
      const dir = join(fixtures, domain);
      const canon = (ds: ReturnType<typeof runKeyJoin>['detections']): string[] =>
        ds.map((d) => `${[...d.subjects].sort().join(',')}|${d.predicate}|${[...d.values].sort().join(',')}`).sort();
      expect(canon(runKeyJoinX(dir).detections)).toEqual(canon(runKeyJoin(dir).detections));
    },
  );

  it.each(['conflict-d20', 'conflict-xr-small'])('%s: perfect score preserved', (domain) => {
    const x = score(domain, runKeyJoinX);
    expect(x.precision).toBe(1);
    expect(x.recall).toBe(1);
    expect(x.spuriousDetections).toBe(0);
  });
});
