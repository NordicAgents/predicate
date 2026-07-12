/**
 * Instance-level evaluation contract (paper1 Phase-0, publication-plan §10).
 *
 * These two shapes are a CROSS-AGENT DATA CONTRACT: the manifest builder,
 * every measured system (reasoner arm, exact baselines, retrieval policies),
 * and the scorer all read/write exactly these fields. Do not extend or rename
 * fields without updating every producer and the scorer together.
 */

export type InstanceKind =
  | 'conflict'
  | 'benign-coreference'
  | 'benign-shared-value'
  | 'benign-duplicate'
  | 'benign-multivalued';

/** One benchmark instance derived from a fixture's oracle.json. */
export interface InstanceRecord {
  /** "<domain>#<pair-pNNN|subject-pNN|benign-...>" */
  id: string;
  domain: string;
  kind: InstanceKind;
  /** 1 record IRI for v1 (same-subject), 2 for v2 (cross-record). */
  subjects: string[];
  /** Shared key literal (v2 email) or null. */
  key: string | null;
  /** Predicate under test (conflicted / duplicated / multi-valued) or null. */
  predicate: string | null;
  goldValues: string[];
  /**
   * Triple ids "s|p|o". v2 conflicts: the 6 minimal source triples
   * [s1 rdf:type, s2 rdf:type, s1 email, s2 email, s1 <pred> v1, s2 <pred> v2].
   * v1 conflicts: the 2 value assertions.
   */
  goldWitness: string[];
  isConflict: boolean;
}

/** One system's prediction for one instance (JSONL, one line per instance). */
export interface PredictionRow {
  instanceId: string;
  domain: string;
  /** e.g. "reasoner-r14r23r22" | "exact-key-join" | "retrieval:iri-bfs@2" */
  system: string;
  flagged: boolean;
  values: string[];
  /** Triple ids "s|p|o" the system can actually cite. */
  witness: string[];
  costMs: number;
  extra: Record<string, unknown>;
}

export const tripleId = (s: string, p: string, o: string): string => `${s}|${p}|${o}`;

export function parseTripleId(id: string): { s: string; p: string; o: string } {
  const parts = id.split('|');
  if (parts.length !== 3) throw new Error(`malformed triple id (want "s|p|o"): ${id}`);
  return { s: parts[0]!, p: parts[1]!, o: parts[2]! };
}
