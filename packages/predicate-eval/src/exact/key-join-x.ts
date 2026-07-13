import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseTBoxSchema } from './tbox.js';
import { TripleIndex, readAllEpisodes } from './triple-index.js';
import { RDF_TYPE, tripleId, type Detection } from './contract.js';
import type { ExactRunResult } from './key-join.js';

/**
 * Baseline 1x — exact-key-join-x: the Prop. 4 FULL-FRAGMENT exact baseline
 * (pre-registration Amendment A2.3). Extends the plain hash join with:
 *
 *   1. per-(keyed class, key property, key VALUE) buckets over ALL of a
 *      record's key values (a record may carry several — chain fixtures), and
 *      a UNION-FIND closure over the buckets: ~K as an equivalence relation,
 *      O(n * alpha(n)), so chain-mediated co-reference of any length m is
 *      closed exactly (the single-join baseline structurally cannot);
 *   2. tau/sigma overlap partitioning implementing F3's side conditions:
 *      within an equivalence class, two values of a j:SingleValued property
 *      conflict only if their records' valid-time intervals OVERLAP (absent
 *      bound = unbounded; no annotations = overlaps everything) AND their
 *      scopes are equal-or-absent. Temporal supersession and scoped facts are
 *      therefore NOT flagged — the separation the tau/sigma-blind detectors
 *      are registered (H7) to fail.
 *
 * On mechanism-v0 (all links single, all tau/sigma absent) this reduces to
 * exactly the plain key join. Pure JS: NO store, NO reasoner, NO SPARQL.
 */

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let r = this.parent.get(x) ?? x;
    if (r !== x) {
      r = this.find(r);
      this.parent.set(x, r);
    }
    return r;
  }
  union(a: string, b: string): void {
    const [ra, rb] = [this.find(a), this.find(b)];
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

interface TauSigma {
  from: string | null;
  to: string | null;
  scope: string | null;
}

/** Interval overlap on [from, to): absent bound = unbounded; ISO dates compare lexicographically. */
const tauOverlaps = (a: TauSigma, b: TauSigma): boolean =>
  (a.from === null || b.to === null || a.from < b.to)
  && (b.from === null || a.to === null || b.from < a.to);

/** Scope comparability: equal, or either side absent. */
const sigmaOverlaps = (a: TauSigma, b: TauSigma): boolean =>
  a.scope === null || b.scope === null || a.scope === b.scope;

export function runKeyJoinX(dir: string): ExactRunResult {
  const t0 = performance.now();
  const schema = parseTBoxSchema(readFileSync(join(dir, 'world.ttl'), 'utf8'));
  const index = new TripleIndex(readAllEpisodes(dir));
  const t1 = performance.now();

  // Pass 1 — per-(class, key prop, key value) buckets over ALL key values of
  // typed subjects, then union-find closure of ~K. Untyped / unkeyed subjects
  // stay identity singletons (the v1 case).
  const uf = new UnionFind();
  const keyed = new Set<string>();
  const buckets = new Map<string, string[]>();
  for (const s of index.subjects()) {
    const types = index.values(s, RDF_TYPE);
    for (const [cls, keyProps] of schema.keyedClasses) {
      if (!types.includes(cls)) continue;
      for (const kp of keyProps) {
        for (const v of index.values(s, kp)) {
          const b = `${cls}|${kp}|${v}`;
          const members = buckets.get(b) ?? [];
          members.push(s);
          buckets.set(b, members);
          keyed.add(s);
        }
      }
    }
  }
  for (const members of buckets.values()) {
    for (let i = 1; i < members.length; i++) uf.union(members[0]!, members[i]!);
  }
  const classes = new Map<string, string[]>();
  for (const s of index.subjects()) {
    const root = keyed.has(s) ? `key ${uf.find(s)}` : `id ${s}`;
    const g = classes.get(root) ?? [];
    g.push(s);
    classes.set(root, g);
  }

  // Pass 2 — per class, per single-valued property: pairwise distinct-value
  // check under the tau/sigma overlap side conditions.
  const tsOf = (s: string): TauSigma => ({
    from: schema.validFromProp ? index.values(s, schema.validFromProp)[0] ?? null : null,
    to: schema.validToProp ? index.values(s, schema.validToProp)[0] ?? null : null,
    scope: schema.scopeProp ? index.values(s, schema.scopeProp)[0] ?? null : null,
  });

  const svProps = [...schema.singleValued].sort();
  const detections: Detection[] = [];
  for (const members of classes.values()) {
    const ts = new Map(members.map((s) => [s, tsOf(s)]));
    for (const p of svProps) {
      const entries: Array<{ s: string; v: string }> = [];
      for (const s of members) {
        for (const v of index.values(s, p)) entries.push({ s, v });
      }
      const conflictingValues: string[] = [];
      let fires = false;
      for (let i = 0; i < entries.length && entries.length >= 2; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const [a, b] = [entries[i]!, entries[j]!];
          if (a.v === b.v) continue;
          if (!tauOverlaps(ts.get(a.s)!, ts.get(b.s)!)) continue;
          if (!sigmaOverlaps(ts.get(a.s)!, ts.get(b.s)!)) continue;
          fires = true;
          for (const v of [a.v, b.v]) if (!conflictingValues.includes(v)) conflictingValues.push(v);
        }
      }
      if (!fires) continue;
      // Explicit witness: per member — type(s), its own key values, its p
      // values, and its tau/sigma annotation triples (the overlap evidence).
      const witnessTriples: string[] = [];
      const keyValues: string[] = [];
      let keyProp: string | null = null;
      for (const s of members) {
        for (const t of index.values(s, RDF_TYPE)) witnessTriples.push(tripleId(s, RDF_TYPE, t));
        for (const [cls, keyProps] of schema.keyedClasses) {
          if (!index.values(s, RDF_TYPE).includes(cls)) continue;
          for (const kp of keyProps) {
            keyProp ??= kp;
            for (const v of index.values(s, kp)) {
              witnessTriples.push(tripleId(s, kp, v));
              if (!keyValues.includes(v)) keyValues.push(v);
            }
          }
        }
        for (const v of index.values(s, p)) witnessTriples.push(tripleId(s, p, v));
        for (const ap of [schema.validFromProp, schema.validToProp, schema.scopeProp]) {
          if (ap === null) continue;
          for (const v of index.values(s, ap)) witnessTriples.push(tripleId(s, ap, v));
        }
      }
      detections.push({
        subjects: [...members],
        key: keyValues.length > 0 ? keyValues.join('|') : null,
        keyProp,
        predicate: p,
        values: conflictingValues,
        witnessTriples,
      });
    }
  }
  const t2 = performance.now();

  return {
    detections, index,
    timings: { setupMs: t1 - t0, detectMs: t2 - t1, totalMs: t2 - t0 },
    stats: {
      triples: index.triples, subjects: index.subjects().length,
      classes: classes.size, singleValuedProps: svProps.length,
    },
  };
}
