import { describe, expect, it } from 'vitest';
import { generateXrFixture } from '../src/conflict/generate-v2.js';
import {
  runScaleLedger, stratumSha256, SCALE_SEED, SCALE_SEED_HEX, DEFAULT_SIZES,
} from '../src/scale-ledger/scale-ledger-cli.js';

/**
 * Load-scale maintenance ledger (Amendment A4.2, H11) — registered semantics
 * under test on SMALL strata (the four registered sizes run only in the
 * evidence build, via the CLI):
 *  - stratum identity: sha256 of the canonical fixture JSON is deterministic
 *    across regenerations (strata are never committed; the hash IS the stratum);
 *  - registered query sample: first 50 conflicted persons by person index in
 *    oracle.coreference array order, both records seeded — min(50, available)
 *    pairs, 2 queries each (100 persons -> 20 conflicted -> 20 pairs;
 *    300 persons -> 60 conflicted -> capped at 50);
 *  - CWI update amplification stays flat and small (< 10);
 *  - every sampled query returns exactly ONE conflict (no missing, no spurious).
 * sparql-groupby and the reasoner child are skipped via opts: their wall-clock
 * is run-variable and store-bound, and A4.2 measures them only in the CLI run.
 */

const SIZES = [100, 300];

const ledger = await runScaleLedger(SIZES, { skipSparql: true, skipReasoner: true });

describe('scale-ledger (A4.2)', () => {
  it('records the registration and registered seed', () => {
    expect(ledger.registration).toBe('A4.2');
    expect(ledger.seed).toBe(SCALE_SEED_HEX);
    expect(Number(ledger.seed)).toBe(SCALE_SEED);
    expect([...DEFAULT_SIZES]).toEqual([300, 1000, 3000, 10000]);
    expect(ledger.sizes.map((r) => r.persons)).toEqual(SIZES);
  });

  it('sha256 is deterministic across two independent generations and matches the ledger', () => {
    for (const persons of SIZES) {
      const a = stratumSha256(generateXrFixture(`scale-xr-p${persons}`, { persons }, SCALE_SEED));
      const b = stratumSha256(generateXrFixture(`scale-xr-p${persons}`, { persons }, SCALE_SEED));
      expect(a).toBe(b);
      expect(ledger.sizes.find((r) => r.persons === persons)?.sha256).toBe(a);
    }
    // Different sizes are different strata.
    expect(new Set(ledger.sizes.map((r) => r.sha256)).size).toBe(SIZES.length);
  });

  it('samples the first min(50, available) conflicted persons, both records seeded', () => {
    // Registered ordering premise: the generator emits conflicted coreference
    // entries first, sorted ascending by person index.
    for (const persons of SIZES) {
      const fx = generateXrFixture(`scale-xr-p${persons}`, { persons }, SCALE_SEED);
      const conflicted = fx.oracle.coreference.filter((c) => c.conflicted);
      const indices = conflicted.map((c) => Number(/p(\d+)@ex\.com/.exec(c.email)![1]));
      expect(indices).toEqual([...indices].sort((x, y) => x - y));
      expect(conflicted.length).toBe(Math.round(0.2 * persons));
    }
    const p100 = ledger.sizes.find((r) => r.persons === 100)!;
    const p300 = ledger.sizes.find((r) => r.persons === 300)!;
    expect(p100.cwi.sampledPersons).toBe(20); // min(50, 20 available)
    expect(p300.cwi.sampledPersons).toBe(50); // min(50, 60 available) — the cap
    for (const r of ledger.sizes) expect(r.cwi.sampledQueries).toBe(2 * r.cwi.sampledPersons);
  });

  it('CWI update amplification stays under 10 at every size', () => {
    for (const r of ledger.sizes) {
      expect(r.cwi.updateAmplification).toBeGreaterThan(0);
      expect(r.cwi.updateAmplification).toBeLessThan(10);
    }
  });

  it('every sampled query returns exactly one conflict', () => {
    for (const r of ledger.sizes) {
      expect(r.cwi.sampledMissing).toBe(0);
      expect(r.cwi.sampledSpurious).toBe(0);
    }
  });

  it('skipped systems are recorded as skipped, and H11 ampFlat is null without p300+p10000', () => {
    for (const r of ledger.sizes) {
      expect(r.systems.sparqlGroupbyMs).toBeNull();
      expect(r.systems.reasoner.materializeMs).toBe('skipped');
      expect(r.systems.exactKeyJoinMs).toBeGreaterThan(0);
      expect(r.systems.exactKeyJoinXMs).toBeGreaterThan(0);
      expect(r.triples).toBe(5 * r.persons + 3 * (Math.round(0.2 * r.persons) + 3));
    }
    expect(ledger.h11.ampFlat.p300).toBe(ledger.sizes.find((r) => r.persons === 300)!.cwi.updateAmplification);
    expect(ledger.h11.ampFlat.p10000).toBeNull();
    expect(ledger.h11.ampFlat.pass).toBeNull();
    expect(ledger.h11.pass).toBeNull();
    expect(typeof ledger.h11.queryP50UnderOneMsEverywhere).toBe('boolean');
    expect(typeof ledger.h11.ingestWithinTenXOfJoinX).toBe('boolean');
  });
});
