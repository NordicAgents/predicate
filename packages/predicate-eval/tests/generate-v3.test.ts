import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  V3_VARIANTS, generateChainFixture, generateH3Fixture, generateTausigFixture, generateV3Fixture,
} from '../src/conflict/generate-v3.js';
import { buildInstanceManifest } from '../src/instances/manifest.js';
import { deriveV3Instances, isV3Oracle, type OracleV3 } from '../src/instances/v3.js';
import { deriveInstances as deriveExact } from '../src/exact/instances.js';
import { deriveInstances as deriveRetrieval } from '../src/rigs/retrieval-policies.js';

/**
 * phase1-v3 fixture family (pre-registration Amendment A2.1): determinism,
 * the registered structural properties, and cross-arm instance-id agreement.
 * Structural properties are what make the fixtures separating BY CONSTRUCTION
 * (H6.i/H6.iv are mechanism checks): sparse intermediates carry two key
 * literals and no IRI object; no single key-value bucket holds two distinct
 * constrained values; h3 non-key literals are shared across persons; tausig
 * negatives differ only in tau/sigma.
 */

const fixtures = join(import.meta.dirname, '..', 'fixtures');
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const EMAIL = 'http://ex/cb3#email';
const OFFICE = 'http://ex/cb3#office';

describe('determinism', () => {
  it('same seed -> byte-identical fixture JSON for every variant', () => {
    for (const [domain, variant] of Object.entries(V3_VARIANTS)) {
      const a = generateV3Fixture(domain, variant);
      const b = generateV3Fixture(domain, variant);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });
});

describe('chain fixtures (H6 structural properties)', () => {
  const variant = V3_VARIANTS['conflict-chain-m2']!;
  const fx = generateChainFixture('conflict-chain-m2', variant);
  const oracle = fx.oracle as OracleV3;

  it('is a v3 oracle with chainLength 2 and 40 groups (10 conflicted)', () => {
    expect(isV3Oracle(oracle)).toBe(true);
    expect(oracle.chainLength).toBe(2);
    expect(oracle.groups).toHaveLength(40);
    expect(oracle.groups.filter((g) => g.kind === 'conflict')).toHaveLength(10);
  });

  it('every conflict witness has |W| = 3m+3 = 9 distinct asserted triples', () => {
    const asserted = new Set(oracle.facts.map((f) => `${f.s}|${f.p}|${f.o}`));
    for (const g of oracle.groups.filter((x) => x.kind === 'conflict')) {
      const ids = new Set(g.witness.map((w) => `${w.s}|${w.p}|${w.o}`));
      expect(ids.size).toBe(9);
      for (const id of ids) expect(asserted.has(id)).toBe(true);
    }
  });

  it('sparse intermediates carry exactly type + TWO key literals and no IRI object', () => {
    for (const g of oracle.groups) {
      const mid = g.records[1]!;
      const midFacts = oracle.facts.filter((f) => f.s === mid);
      expect(midFacts).toHaveLength(3);
      expect(midFacts.filter((f) => f.p === EMAIL && f.lit === true)).toHaveLength(2);
      expect(midFacts.filter((f) => f.p !== EMAIL && f.p !== RDF_TYPE)).toHaveLength(0);
    }
  });

  it('single-join insufficiency: no (key value) bucket holds two distinct office values', () => {
    const officeOf = new Map<string, string>();
    for (const f of oracle.facts.filter((x) => x.p === OFFICE)) officeOf.set(f.s, f.o);
    const buckets = new Map<string, Set<string>>();
    for (const f of oracle.facts.filter((x) => x.p === EMAIL)) {
      const b = buckets.get(f.o) ?? new Set<string>();
      const office = officeOf.get(f.s);
      if (office !== undefined) b.add(office);
      buckets.set(f.o, b);
    }
    for (const values of buckets.values()) expect(values.size).toBeLessThanOrEqual(1);
  });

  it('m3 variant: chains of 4 records, |W| = 12, intermediates all sparse', () => {
    const fx3 = generateChainFixture('conflict-chain-m3', V3_VARIANTS['conflict-chain-m3']!);
    const o3 = fx3.oracle as OracleV3;
    expect(o3.chainLength).toBe(3);
    for (const g of o3.groups) expect(g.records).toHaveLength(4);
    for (const g of o3.groups.filter((x) => x.kind === 'conflict')) {
      expect(new Set(g.witness.map((w) => `${w.s}|${w.p}|${w.o}`)).size).toBe(12);
    }
  });
});

describe('h3 fixtures (H3 lever)', () => {
  it('nk1 adds city only; nk3 adds city+title+building; session-2 records stay sparse', () => {
    const nk1 = generateH3Fixture('conflict-h3-nk1', V3_VARIANTS['conflict-h3-nk1']!);
    const nk3 = generateH3Fixture('conflict-h3-nk3', V3_VARIANTS['conflict-h3-nk3']!);
    const preds = (fx: typeof nk1): Set<string> =>
      new Set((fx.oracle as { facts: Array<{ p: string }> }).facts.map((f) => f.p));
    expect(preds(nk1).has('http://ex/cb3#city')).toBe(true);
    expect(preds(nk1).has('http://ex/cb3#title')).toBe(false);
    expect(preds(nk3).has('http://ex/cb3#title')).toBe(true);
    expect(preds(nk3).has('http://ex/cb3#building')).toBe(true);
    for (const fx of [nk1, nk3]) {
      const facts = (fx.oracle as { facts: Array<{ s: string; p: string }> }).facts;
      for (const f of facts.filter((x) => x.s.includes('/s2-'))) {
        expect(['http://ex/cb3#email', 'http://ex/cb3#office', RDF_TYPE]).toContain(f.p);
      }
    }
  });

  it('non-key literals are SHARED across persons (groups of >= 2)', () => {
    const fx = generateH3Fixture('conflict-h3-nk1', V3_VARIANTS['conflict-h3-nk1']!);
    const byCity = new Map<string, number>();
    for (const f of (fx.oracle as { facts: Array<{ p: string; o: string }> }).facts) {
      if (f.p === 'http://ex/cb3#city') byCity.set(f.o, (byCity.get(f.o) ?? 0) + 1);
    }
    expect(byCity.size).toBeGreaterThan(1);
    for (const n of byCity.values()) expect(n).toBeGreaterThanOrEqual(2);
  });

  it('h3 oracles are v2-shaped (12 conflicted + 3 benign coreference pairs)', () => {
    const fx = generateH3Fixture('conflict-h3-nk1', V3_VARIANTS['conflict-h3-nk1']!);
    const oracle = fx.oracle as { coreference: Array<{ conflicted: boolean }> };
    expect(isV3Oracle(fx.oracle)).toBe(false);
    expect(oracle.coreference.filter((c) => c.conflicted)).toHaveLength(12);
    expect(oracle.coreference.filter((c) => !c.conflicted)).toHaveLength(3);
  });
});

describe('tausig fixture (H7 structural properties)', () => {
  const fx = generateTausigFixture('conflict-tausig', V3_VARIANTS['conflict-tausig']!);
  const oracle = fx.oracle as OracleV3;
  const kinds = (k: string): OracleV3['groups'] => oracle.groups.filter((g) => g.kind === k);

  it('registered kind counts: 12 conflict / 12 temporal / 12 scoped / 24 coreference', () => {
    expect(kinds('conflict')).toHaveLength(12);
    expect(kinds('benign-temporal')).toHaveLength(12);
    expect(kinds('benign-scoped')).toHaveLength(12);
    expect(kinds('benign-coreference')).toHaveLength(24);
  });

  const tauOf = (rec: string): { from?: string; to?: string } => {
    const from = oracle.facts.find((f) => f.s === rec && f.p === 'http://ex/cb3#validFrom')?.o;
    const to = oracle.facts.find((f) => f.s === rec && f.p === 'http://ex/cb3#validTo')?.o;
    return { from, to };
  };

  it('conflict pairs OVERLAP in tau; benign-temporal pairs are DISJOINT', () => {
    for (const g of kinds('conflict')) {
      const [a, b] = [tauOf(g.records[0]!), tauOf(g.records[1]!)];
      expect(a.from! < b.to! && b.from! < a.to!).toBe(true);
      expect(g.values).toHaveLength(2);
    }
    for (const g of kinds('benign-temporal')) {
      const [a, b] = [tauOf(g.records[0]!), tauOf(g.records[1]!)];
      expect(a.to! <= b.from!).toBe(true);
      expect(g.values).toHaveLength(2); // differing values — hard negative
    }
  });

  it('benign-scoped pairs carry DIFFERENT scopes and no tau', () => {
    for (const g of kinds('benign-scoped')) {
      const scopes = g.records.map((r) =>
        oracle.facts.find((f) => f.s === r && f.p === 'http://ex/cb3#sourceScope')?.o);
      expect(new Set(scopes).size).toBe(2);
      expect(tauOf(g.records[0]!).from).toBeUndefined();
      expect(g.values).toHaveLength(2);
    }
  });
});

describe('cross-arm instance derivation agreement (single v3 derivation)', () => {
  it.each(['conflict-chain-m2', 'conflict-chain-m3', 'conflict-tausig'])('%s', (domain) => {
    const dir = join(fixtures, domain);
    const canonical = buildInstanceManifest(dir);
    const exact = deriveExact(domain, dir);
    const retrieval = deriveRetrieval(domain, dir);
    const ids = (xs: Array<{ id: string }>): string[] => xs.map((x) => x.id).sort();
    expect(ids(exact)).toEqual(ids(canonical));
    expect(ids(retrieval)).toEqual(ids(canonical));
  });

  it('committed manifests match regenerated derivation (frozen-fixture invariant)', () => {
    for (const domain of ['conflict-chain-m2', 'conflict-tausig']) {
      const committed = JSON.parse(
        readFileSync(join(fixtures, domain, 'instances.json'), 'utf8'),
      ) as Array<{ id: string }>;
      const oracle = JSON.parse(
        readFileSync(join(fixtures, domain, 'oracle.json'), 'utf8'),
      ) as OracleV3;
      const derived = deriveV3Instances(domain, oracle);
      expect(committed.map((i) => i.id).sort()).toEqual(derived.map((i) => i.id).sort());
    }
  });
});
