import type { EpisodeTriple } from '../episode-runner.js';
import type { TBoxSchema } from '../exact/tbox.js';
import { RDF_TYPE, tripleId } from '../exact/contract.js';
import { tauOverlaps, sigmaOverlaps, type TauSigma } from '../exact/tau-sigma.js';

/**
 * CWI — incremental Conflict Witness Index (pre-registration Amendment A3.1;
 * publication plan §5 "Proposed method"; formal doc §3–§5). The Phase-1
 * method arm, competing as a RETRIEVAL INDEX only: witness-completeness per
 * context budget plus the maintenance ledger — never as a store-side
 * detector (clause-3 first conjunct stands; A3.6 non-claims).
 *
 * Design (all pure TS, no store):
 *  - ~K maintained incrementally: per-(keyed class, key prop, key VALUE)
 *    buckets; union-find with union-by-size over co-key membership. A record
 *    joins a bucket only once it is BOTH typed with the keyed class and
 *    carries the key value (Def. 1.4 requires both).
 *  - Per-class, per-E-predicate entry lists; conflicts re-evaluated at
 *    EQUIVALENCE-CLASS granularity on every touching update (new value, class
 *    merge, or tau/sigma metadata update) — per-update work is bounded by the
 *    affected class, never the store. Metadata uses record-snapshot
 *    last-write-wins semantics, so an update can retract or restore a
 *    conflict; full cell re-evaluation handles both.
 *  - Query(seed): the conflicts on the seed's class, each with a MINIMAL
 *    witness assembled by shortest record–bucket–record path (BFS inside the
 *    class): |W| = 3m+3 cross-record, 2 same-record, + the two supporting
 *    records' tau/sigma annotation triples where present (they are F3
 *    premises).
 *  - Ledger: every structural mutation and every cell re-evaluation counts
 *    into `insertWrites` (update amplification = insertWrites/sourceTriples).
 */

export interface CwiConflict {
  predicate: string;
  /** The two supporting records, endpoint order. */
  records: [string, string];
  /** The two conflicting values, aligned with `records`. */
  values: [string, string];
}

export interface CwiWitnessedConflict extends CwiConflict {
  witness: EpisodeTriple[];
  witnessIds: string[];
}

export interface CwiQueryResult {
  seed: string;
  classMembers: string[];
  conflicts: CwiWitnessedConflict[];
}

export interface CwiStats {
  sourceTriples: number;
  insertWrites: number;
  indexEntries: number;
}

interface SubjectState {
  types: Set<string>;
  /** key prop -> values (assertion order). */
  keyVals: Map<string, string[]>;
  /** E-predicate -> values (assertion order). */
  eVals: Map<string, string[]>;
  tau: TauSigma;
}

interface ClassState {
  members: string[];
  /** E-predicate -> entries {record, value}. */
  entries: Map<string, Array<{ record: string; value: string }>>;
  /** predicate -> conflicting pairs (recomputed per touch). */
  conflicts: Map<string, CwiConflict[]>;
}

const freshSubject = (): SubjectState => ({
  types: new Set(),
  keyVals: new Map(),
  eVals: new Map(),
  tau: { from: null, to: null, scope: null },
});

export class ConflictWitnessIndex {
  private readonly schema: TBoxSchema;
  private readonly subjects = new Map<string, SubjectState>();
  /** union-find over records that entered >= 1 bucket. */
  private readonly parent = new Map<string, string>();
  private readonly rank = new Map<string, number>();
  /** bucketId `cls|kp|v` -> member records. */
  private readonly buckets = new Map<string, string[]>();
  /** record -> bucketIds it belongs to (witness-path graph). */
  private readonly recordBuckets = new Map<string, Set<string>>();
  /** class root -> class state (identity classes materialized lazily). */
  private readonly classes = new Map<string, ClassState>();
  /** triple ids asserted with lit=true (serialization fidelity). */
  private readonly literalIds = new Set<string>();

  private writes = 0;
  private triples = 0;

  constructor(schema: TBoxSchema) {
    this.schema = schema;
  }

  // ---------------------------------------------------------------- insert --

  insert(t: EpisodeTriple): void {
    this.triples++;
    if (t.lit === true) this.literalIds.add(tripleId(t.s, t.p, t.o));
    const st = this.subjects.get(t.s) ?? freshSubject();
    if (!this.subjects.has(t.s)) this.subjects.set(t.s, st);

    if (t.p === RDF_TYPE) {
      st.types.add(t.o);
      this.writes++;
      // Late type: activate key values already held for this class's key props.
      const keyProps = this.schema.keyedClasses.get(t.o);
      if (keyProps) {
        for (const kp of keyProps) {
          for (const v of st.keyVals.get(kp) ?? []) this.enterBucket(t.s, t.o, kp, v);
        }
      }
      return;
    }

    if (this.isKeyProp(t.p)) {
      const vs = st.keyVals.get(t.p) ?? [];
      if (!vs.includes(t.o)) vs.push(t.o);
      st.keyVals.set(t.p, vs);
      this.writes++;
      for (const [cls, keyProps] of this.schema.keyedClasses) {
        if (keyProps.includes(t.p) && st.types.has(cls)) this.enterBucket(t.s, cls, t.p, t.o);
      }
      return;
    }

    if (this.schema.singleValued.has(t.p)) {
      const vs = st.eVals.get(t.p) ?? [];
      if (vs.includes(t.o)) return;
      vs.push(t.o);
      st.eVals.set(t.p, vs);
      this.writes++;
      const root = this.rootOf(t.s);
      const cls = this.classState(root);
      const entries = cls.entries.get(t.p) ?? [];
      entries.push({ record: t.s, value: t.o });
      cls.entries.set(t.p, entries);
      this.writes++;
      this.evaluateCell(cls, t.p);
      return;
    }

    if (t.p === this.schema.validFromProp) { st.tau.from = t.o; this.touchAnnotations(t.s); return; }
    if (t.p === this.schema.validToProp) { st.tau.to = t.o; this.touchAnnotations(t.s); return; }
    if (t.p === this.schema.scopeProp) { st.tau.scope = t.o; this.touchAnnotations(t.s); return; }
    // Non-indexed predicate (multi-valued, descriptive): no index writes.
  }

  private isKeyProp(p: string): boolean {
    for (const keyProps of this.schema.keyedClasses.values()) if (keyProps.includes(p)) return true;
    return false;
  }

  /** Tau/sigma metadata update: re-evaluate every cell of the record's class. */
  private touchAnnotations(record: string): void {
    this.writes++;
    const cls = this.classes.get(this.rootOf(record));
    if (!cls) return;
    for (const p of cls.entries.keys()) this.evaluateCell(cls, p);
  }

  // ----------------------------------------------------------- union-find --

  private find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) return x;
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }

  /** Root of a record's equivalence class ("id:<s>" identity when unkeyed). */
  private rootOf(record: string): string {
    return this.parent.has(record) ? this.find(record) : record;
  }

  private classState(root: string): ClassState {
    let cls = this.classes.get(root);
    if (!cls) {
      cls = { members: [root], entries: new Map(), conflicts: new Map() };
      this.classes.set(root, cls);
      this.writes++;
    }
    return cls;
  }

  private enterBucket(record: string, cls: string, kp: string, v: string): void {
    const bucketId = `${cls}|${kp}|${v}`;
    const members = this.buckets.get(bucketId) ?? [];
    if (members.includes(record)) return;
    members.push(record);
    this.buckets.set(bucketId, members);
    const rb = this.recordBuckets.get(record) ?? new Set();
    rb.add(bucketId);
    this.recordBuckets.set(record, rb);
    this.writes += 2;
    if (!this.parent.has(record)) {
      // Registering the record as its own root keeps any identity-class
      // entries it accumulated before keying under the same root key.
      this.parent.set(record, record);
      this.rank.set(record, 0);
    }
    if (members.length > 1) this.union(members[0]!, record);
  }

  private union(a: string, b: string): void {
    const [ra, rb] = [this.find(a), this.find(b)];
    if (ra === rb) return;
    const [hi, lo] = (this.rank.get(ra) ?? 0) >= (this.rank.get(rb) ?? 0) ? [ra, rb] : [rb, ra];
    this.parent.set(lo, hi);
    if ((this.rank.get(hi) ?? 0) === (this.rank.get(lo) ?? 0)) this.rank.set(hi, (this.rank.get(hi) ?? 0) + 1);
    this.writes++;
    // Merge class state lo -> hi and re-evaluate every predicate present.
    const from = this.classes.get(lo);
    const into = this.classState(hi);
    if (!into.members.includes(lo)) into.members.push(lo);
    if (from) {
      for (const m of from.members) if (!into.members.includes(m)) into.members.push(m);
      for (const [p, entries] of from.entries) {
        const dst = into.entries.get(p) ?? [];
        dst.push(...entries);
        into.entries.set(p, dst);
        this.writes++;
      }
      this.classes.delete(lo);
    }
    for (const p of into.entries.keys()) this.evaluateCell(into, p);
  }

  // ------------------------------------------------------------- conflicts --

  /** Recompute the (class, predicate) conflict cell under tau/sigma overlap. */
  private evaluateCell(cls: ClassState, p: string): void {
    const entries = cls.entries.get(p) ?? [];
    const pairs: CwiConflict[] = [];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [a, b] = [entries[i]!, entries[j]!];
        if (a.value === b.value) continue;
        const ta = this.subjects.get(a.record)?.tau ?? { from: null, to: null, scope: null };
        const tb = this.subjects.get(b.record)?.tau ?? { from: null, to: null, scope: null };
        if (!tauOverlaps(ta, tb) || !sigmaOverlaps(ta, tb)) continue;
        pairs.push({ predicate: p, records: [a.record, b.record], values: [a.value, b.value] });
      }
    }
    if (pairs.length > 0 || cls.conflicts.has(p)) {
      cls.conflicts.set(p, pairs);
      this.writes++;
    }
  }

  // ----------------------------------------------------------------- query --

  query(seed: string): CwiQueryResult {
    const root = this.rootOf(seed);
    const cls = this.classes.get(root);
    if (!cls) return { seed, classMembers: [seed], conflicts: [] };
    const out: CwiWitnessedConflict[] = [];
    for (const pairs of cls.conflicts.values()) {
      for (const c of pairs) {
        const witness = this.assembleWitness(c);
        out.push({ ...c, witness, witnessIds: witness.map((w) => tripleId(w.s, w.p, w.o)) });
      }
    }
    return { seed, classMembers: [...cls.members], conflicts: out };
  }

  /**
   * Minimal witness (Def. 2.1): shortest record–bucket–record path between
   * the two supporting records, + their value assertions, + their tau/sigma
   * annotation triples (F3 premises). Same-record: the two value assertions.
   */
  private assembleWitness(c: CwiConflict): EpisodeTriple[] {
    const [a, b] = c.records;
    const witness: EpisodeTriple[] = [];
    const pushed = new Set<string>();
    const push = (s: string, p: string, o: string): void => {
      const id = tripleId(s, p, o);
      if (pushed.has(id)) return;
      pushed.add(id);
      witness.push(this.literalIds.has(id) ? { s, p, o, lit: true } : { s, p, o });
    };

    if (a !== b) {
      const path = this.shortestKeyPath(a, b);
      if (path === null) throw new Error(`CWI invariant violated: no key path between co-class records ${a} and ${b}`);
      for (const step of path.links) {
        const [cls2, kp, v] = step.bucket.split('|') as [string, string, string];
        push(step.from, RDF_TYPE, cls2);
        push(step.to, RDF_TYPE, cls2);
        push(step.from, kp, v);
        push(step.to, kp, v);
      }
    }
    push(a, c.predicate, c.values[0]);
    push(b, c.predicate, c.values[1]);
    for (const r of a === b ? [a] : [a, b]) {
      const tau = this.subjects.get(r)?.tau;
      if (!tau) continue;
      if (tau.from !== null && this.schema.validFromProp) push(r, this.schema.validFromProp, tau.from);
      if (tau.to !== null && this.schema.validToProp) push(r, this.schema.validToProp, tau.to);
      if (tau.scope !== null && this.schema.scopeProp) push(r, this.schema.scopeProp, tau.scope);
    }
    return witness;
  }

  private shortestKeyPath(a: string, b: string): { links: Array<{ from: string; to: string; bucket: string }> } | null {
    if (a === b) return { links: [] };
    const prev = new Map<string, { from: string; bucket: string }>();
    const seen = new Set([a]);
    let frontier = [a];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const r of frontier) {
        for (const bucket of this.recordBuckets.get(r) ?? []) {
          for (const n of this.buckets.get(bucket) ?? []) {
            if (seen.has(n)) continue;
            seen.add(n);
            prev.set(n, { from: r, bucket });
            if (n === b) {
              const links: Array<{ from: string; to: string; bucket: string }> = [];
              let cur = b;
              while (cur !== a) {
                const e = prev.get(cur)!;
                links.unshift({ from: e.from, to: cur, bucket: e.bucket });
                cur = e.from;
              }
              return { links };
            }
            next.push(n);
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  // ----------------------------------------------------------------- stats --

  stats(): CwiStats {
    let entryCount = 0;
    for (const cls of this.classes.values()) {
      for (const es of cls.entries.values()) entryCount += es.length;
    }
    return {
      sourceTriples: this.triples,
      insertWrites: this.writes,
      indexEntries: this.buckets.size + this.parent.size + entryCount,
    };
  }
}
