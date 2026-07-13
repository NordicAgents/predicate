import type { InstanceRecord } from './types.js';
import { tripleId } from './types.js';

/**
 * Shared derivation for phase1-v3 oracles (pre-registration Amendment A2.1:
 * conflict-chain-m2/m3 and conflict-tausig). Unlike the v1/v2 fixtures — where
 * the manifest builder, the exact arm, and the retrieval arm each carry an
 * id-compatible derivation — v3 has exactly ONE derivation, used by all three,
 * so id drift between producers is impossible by construction.
 *
 * The v3 oracle carries explicit per-group gold witnesses computed by the
 * generator (|W| = 3m+3 for chain groups, core 6 + tau/sigma annotation
 * triples for tausig groups); this module validates every witness triple
 * against oracle.facts and maps groups onto contract InstanceRecords.
 */

export type V3GroupKind = 'conflict' | 'benign-coreference' | 'benign-temporal' | 'benign-scoped';

export interface V3Fact { s: string; p: string; o: string; lit?: boolean; episode: number }

export interface V3Group {
  /** Person token, e.g. "p003" — the entity for cluster bootstrap (A2.6). */
  person: string;
  kind: V3GroupKind;
  /** Record IRIs in chain order (endpoint, intermediates..., endpoint). */
  records: string[];
  /** The m shared key literals along the chain (1 for tausig pairs). */
  keys: string[];
  keyProp: string;
  /** Constrained predicate under test. */
  predicate: string;
  /** Distinct endpoint values ([v1, v2] when differing, [v] when agreeing). */
  values: string[];
  /** Explicit gold witness triples (validated against oracle.facts). */
  witness: Array<{ s: string; p: string; o: string }>;
}

export interface OracleV3 {
  version: 3;
  /** Chain length m (co-key links per group); 1 for tausig pairs. */
  chainLength: number;
  facts: V3Fact[];
  conflicts: Array<{ id: string; about: string; predicate: string; values: string[]; episode: number }>;
  groups: V3Group[];
  benign?: {
    /** Two record IRIs of DIFFERENT persons sharing a constrained value (FP probe). */
    sharedValueSubjects?: string[];
  };
}

export function isV3Oracle(oracle: unknown): oracle is OracleV3 {
  return typeof oracle === 'object' && oracle !== null && (oracle as { version?: unknown }).version === 3;
}

const KIND_ID_PREFIX: Record<V3GroupKind, string> = {
  conflict: 'pair',
  'benign-coreference': 'benign-coreference',
  'benign-temporal': 'benign-temporal',
  'benign-scoped': 'benign-scoped',
};

const localName = (iri: string): string => iri.slice(Math.max(iri.lastIndexOf('/'), iri.lastIndexOf('#')) + 1);
const personToken = (iri: string): string => localName(iri).replace(/^s\d+-/, '');

export function deriveV3Instances(domain: string, oracle: OracleV3): InstanceRecord[] {
  const assertedIds = new Set(oracle.facts.map((f) => tripleId(f.s, f.p, f.o)));
  const requireWitness = (witness: Array<{ s: string; p: string; o: string }>, id: string): string[] =>
    witness.map((w) => {
      const wid = tripleId(w.s, w.p, w.o);
      if (!assertedIds.has(wid)) throw new Error(`goldWitness triple not found in oracle facts for ${id}: ${wid}`);
      return wid;
    });

  const out: InstanceRecord[] = [];
  for (const g of oracle.groups) {
    const id = `${domain}#${KIND_ID_PREFIX[g.kind]}-${g.person}`;
    if (g.kind === 'conflict' && g.values.length !== 2) {
      throw new Error(`${id}: conflict group must carry exactly 2 distinct values, got [${g.values.join(', ')}]`);
    }
    out.push({
      id,
      domain,
      kind: g.kind,
      subjects: [...g.records],
      key: g.keys.join('+'),
      predicate: g.predicate,
      goldValues: [...g.values],
      goldWitness: requireWitness(g.witness, id),
      isConflict: g.kind === 'conflict',
    });
  }

  const shared = oracle.benign?.sharedValueSubjects ?? [];
  if (shared.length >= 2) {
    const [a, b] = [shared[0]!, shared[1]!];
    const id = `${domain}#benign-shared-value-${personToken(a)}-${personToken(b)}`;
    const predicate = oracle.groups[0]?.predicate ?? null;
    if (predicate === null) throw new Error(`${id}: cannot determine shared-value predicate (no groups)`);
    const valueOf = (s: string): string => {
      const f = oracle.facts.find((x) => x.s === s && x.p === predicate);
      if (!f) throw new Error(`${id}: no <${s}> <${predicate}> fact for shared-value probe`);
      return f.o;
    };
    const [va, vb] = [valueOf(a), valueOf(b)];
    out.push({
      id, domain, kind: 'benign-shared-value', subjects: [a, b], key: null,
      predicate, goldValues: [...new Set([va, vb])],
      goldWitness: requireWitness([{ s: a, p: predicate, o: va }, { s: b, p: predicate, o: vb }], id),
      isConflict: false,
    });
  }
  return out;
}
