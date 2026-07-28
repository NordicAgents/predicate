import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTBoxSchema } from '../src/exact/tbox.js';
import { readAllEpisodes } from '../src/exact/triple-index.js';
import { runKeyJoinX } from '../src/exact/key-join-x.js';
import { deriveInstances } from '../src/exact/instances.js';
import { tripleId } from '../src/exact/contract.js';
import { ConflictWitnessIndex } from '../src/cwi/index.js';
import type { EpisodeTriple } from '../src/episode-runner.js';

/**
 * CWI — incremental Conflict Witness Index (Amendment A3). Registered
 * obligations under test:
 *  - cross-engine equality with exact-key-join-x on every fixture (A3.4 H9);
 *  - witnesses returned are EXACTLY the gold minimal witnesses (|W| = 3m+3
 *    cross-record, 2 same-record, + tau/sigma premises);
 *  - incrementality: tau/sigma metadata updates retract and restore conflicts
 *    under record-snapshot semantics (A3.1.iii);
 *  - insertion-order robustness: values before keys before types reach the
 *    same fixpoint as file order.
 */

const fixtures = join(import.meta.dirname, '..', 'fixtures');
const ALL_DOMAINS = [
  'conflict-d20', 'conflict-xr-small', 'conflict-xr-scale',
  'conflict-chain-m2', 'conflict-chain-m3', 'conflict-h3-nk1', 'conflict-h3-nk3', 'conflict-tausig',
];

function buildIndex(domain: string, triples?: EpisodeTriple[]): ConflictWitnessIndex {
  const dir = join(fixtures, domain);
  const schema = parseTBoxSchema(readFileSync(join(dir, 'world.ttl'), 'utf8'));
  const index = new ConflictWitnessIndex(schema);
  for (const t of triples ?? readAllEpisodes(dir)) index.insert(t);
  return index;
}

/** Canonical conflict signature: unordered records + unordered values + predicate. */
const sig = (predicate: string, records: string[], values: string[]): string =>
  `${predicate}|${[...records].sort().join(',')}|${[...values].sort().join(',')}`;

describe('cross-engine equality with exact-key-join-x (H9)', () => {
  it.each(ALL_DOMAINS)('%s: identical conflict sets', (domain) => {
    const dir = join(fixtures, domain);
    const index = buildIndex(domain);
    const instances = deriveInstances(domain, dir);
    const detections = runKeyJoinX(dir).detections;

    // Every CWI conflict pair lies inside some key-join-x detection
    // (key-join-x emits one class-level detection per (class, predicate)).
    for (const inst of instances) {
      for (const seed of inst.subjects) {
        for (const c of index.query(seed).conflicts) {
          const covered = detections.some((d) =>
            d.predicate === c.predicate && c.records.every((r) => d.subjects.includes(r))
            && c.values.every((v) => d.values.includes(v)));
          expect(covered, `uncovered CWI conflict ${sig(c.predicate, c.records, c.values)} in ${domain}`).toBe(true);
        }
      }
    }
    // …and both systems flag exactly the same instances (predict.ts rules).
    for (const inst of instances) {
      const cwiFlag = inst.subjects.every((seed) =>
        index.query(seed).conflicts.some((c) =>
          c.predicate === inst.predicate && c.records.every((r) => inst.subjects.includes(r))));
      const xFlag = inst.isConflict
        ? detections.some((d) => d.predicate === inst.predicate && inst.subjects.every((s) => d.subjects.includes(s)))
        : detections.some((d) => inst.subjects.some((s) => d.subjects.includes(s)));
      expect(cwiFlag, `${inst.id}: cwi=${cwiFlag} x=${xFlag}`).toBe(xFlag);
    }
  });
});

describe('witnesses are exactly the gold minimal witnesses', () => {
  it.each(['conflict-chain-m2', 'conflict-chain-m3', 'conflict-tausig', 'conflict-xr-small', 'conflict-d20'])(
    '%s', (domain) => {
      const dir = join(fixtures, domain);
      const index = buildIndex(domain);
      for (const inst of deriveInstances(domain, dir).filter((i) => i.isConflict)) {
        const c = index.query(inst.subjects[0]!).conflicts
          .find((x) => x.predicate === inst.predicate && x.records.every((r) => inst.subjects.includes(r)));
        expect(c, inst.id).toBeDefined();
        expect(new Set(c!.witnessIds)).toEqual(new Set(inst.goldWitness));
      }
    },
  );
});

describe('incrementality (A3.1.iii)', () => {
  const CB3 = 'http://ex/cb3#';
  const schemaTtl = readFileSync(join(fixtures, 'conflict-tausig', 'world.ttl'), 'utf8');
  const rec = (n: string): string => `http://ex/cb3/${n}`;
  const base = (n: string, office: string): EpisodeTriple[] => [
    { s: rec(n), p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', o: `${CB3}PersonRecord` },
    { s: rec(n), p: `${CB3}email`, o: 'x@ex.com', lit: true },
    { s: rec(n), p: `${CB3}office`, o: `http://ex/cb3/${office}` },
  ];

  it('late tau annotations RETRACT a previously emitted conflict', () => {
    const index = new ConflictWitnessIndex(parseTBoxSchema(schemaTtl));
    for (const t of [...base('a', 'office1'), ...base('b', 'office2')]) index.insert(t);
    expect(index.query(rec('a')).conflicts).toHaveLength(1); // tau bottom: conflict
    // Disjoint intervals arrive late -> temporal supersession, not a conflict.
    index.insert({ s: rec('a'), p: `${CB3}validFrom`, o: '2026-01-01', lit: true });
    index.insert({ s: rec('a'), p: `${CB3}validTo`, o: '2026-02-01', lit: true });
    index.insert({ s: rec('b'), p: `${CB3}validFrom`, o: '2026-05-01', lit: true });
    expect(index.query(rec('a')).conflicts).toHaveLength(0);
    // Overlap restored (b's interval opens before a's ends? no — widen a instead):
    index.insert({ s: rec('a'), p: `${CB3}validTo`, o: '2026-12-01', lit: true });
    // NOTE: record-level tau is single-valued per record in the fixtures; the
    // index keeps the LATEST annotation (last write wins) — overlap again.
    expect(index.query(rec('a')).conflicts).toHaveLength(1);
  });

  it('duplicate value assertions are idempotent', () => {
    const index = new ConflictWitnessIndex(parseTBoxSchema(schemaTtl));
    const triples = [...base('a', 'office1'), ...base('b', 'office2')];
    for (const t of triples) index.insert(t);
    index.insert(base('a', 'office1')[2]!);
    index.insert(base('a', 'office1')[2]!);
    const result = index.query(rec('a'));
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.witnessIds).toHaveLength(6);
  });

  it('insertion order does not matter: values -> keys -> types reaches the same fixpoint', () => {
    const domain = 'conflict-chain-m2';
    const inFileOrder = buildIndex(domain);
    const reordered = readAllEpisodes(join(fixtures, domain));
    const rank = (t: EpisodeTriple): number =>
      t.p === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' ? 2 : t.p === `${CB3}email` ? 1 : 0;
    const sorted = [...reordered].sort((a, b) => rank(a) - rank(b));
    const index = buildIndex(domain, sorted);
    const dir = join(fixtures, domain);
    for (const inst of deriveInstances(domain, dir)) {
      const flag = (ix: ConflictWitnessIndex): boolean => inst.subjects.every((seed) =>
        ix.query(seed).conflicts.some((c) =>
          c.predicate === inst.predicate && c.records.every((r) => inst.subjects.includes(r))));
      expect(flag(index), inst.id).toBe(flag(inFileOrder));
    }
  });
});

describe('ledger sanity', () => {
  it('update amplification is bounded and index is non-trivial', () => {
    const index = buildIndex('conflict-xr-scale');
    const stats = index.stats();
    expect(stats.sourceTriples).toBeGreaterThan(1000);
    expect(stats.insertWrites / stats.sourceTriples).toBeLessThan(10);
    expect(stats.indexEntries).toBeGreaterThan(0);
    expect(stats.materializedConflicts).toBeGreaterThan(0);
  });

  it('witness ids match tripleId convention', () => {
    const index = buildIndex('conflict-xr-small');
    const dir = join(fixtures, 'conflict-xr-small');
    const inst = deriveInstances('conflict-xr-small', dir).find((i) => i.isConflict)!;
    const c = index.query(inst.subjects[0]!).conflicts[0]!;
    for (const w of c.witness) expect(c.witnessIds).toContain(tripleId(w.s, w.p, w.o));
  });
});
