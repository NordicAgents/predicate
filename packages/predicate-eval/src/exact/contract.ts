/**
 * Shared cross-agent data contract for the exact-baseline arm (publication
 * plan §8 "Exact/non-LLM baselines"). Another agent implements the scorer
 * against EXACTLY these shapes — do not change field names or id conventions.
 */

export const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
export const RDF_FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
export const RDF_REST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
export const OWL_HASKEY = 'http://www.w3.org/2002/07/owl#hasKey';
export const J_SINGLE_VALUED = 'https://industriagents.com/predicate/judgment#SingleValued';
// Record-level tau/sigma annotation markers (Amendment A2.1.3): a property
// typed with one of these carries the record's valid-time bounds / scope.
export const J_VALID_FROM = 'https://industriagents.com/predicate/judgment#ValidFrom';
export const J_VALID_TO = 'https://industriagents.com/predicate/judgment#ValidTo';
export const J_SOURCE_SCOPE = 'https://industriagents.com/predicate/judgment#SourceScope';

export type InstanceKind =
  | 'conflict'
  | 'benign-coreference'
  | 'benign-shared-value'
  | 'benign-duplicate'
  | 'benign-multivalued'
  // phase1-v3 hard negatives (pre-registration Amendment A2.2):
  | 'benign-temporal'
  | 'benign-scoped';

/**
 * One scoreable unit derived from oracle.json.
 * id convention: "<domain>#pair-pNNN" (v2 cross-record conflict pair),
 * "<domain>#subject-pNN" (v1 same-subject conflict), "<domain>#benign-..."
 * (negatives; see instances.ts for the exact benign suffixes).
 */
export interface InstanceRecord {
  id: string;
  domain: string;
  kind: InstanceKind;
  /** 1 record IRI for v1, 2 for v2. */
  subjects: string[];
  /** Shared key literal (v2 email) or null. */
  key: string | null;
  /** Conflicted / benign predicate, or null when not predicate-specific. */
  predicate: string | null;
  goldValues: string[];
  /**
   * Triple ids "s|p|o". For v2 conflicts: the 6 minimal source triples
   * [s1 rdf:type, s2 rdf:type, s1 email, s2 email, s1 <pred>, s2 <pred>].
   * For v1 conflicts: the 2 value assertions. For benign instances the
   * contract leaves this open; we emit the evidence triples needed to
   * adjudicate benignity (identity triples + single-valued value triples).
   */
  goldWitness: string[];
  isConflict: boolean;
}

/** One JSONL line per instance per system. */
export interface PredictionRow {
  instanceId: string;
  domain: string;
  system: string;
  flagged: boolean;
  values: string[];
  /** Triple ids "s|p|o" the system can cite. */
  witness: string[];
  costMs: number;
  extra: Record<string, unknown>;
}

/**
 * A raw conflict detection, before mapping onto instances: one equivalence
 * class (records sharing a key literal, or a single subject) that carries
 * more than one distinct value for one single-valued predicate.
 */
export interface Detection {
  subjects: string[];
  key: string | null;
  keyProp: string | null;
  predicate: string;
  values: string[];
  /**
   * Optional explicit witness triple ids ("s|p|o"). Systems whose witnesses
   * are not reconstructible from (key, keyProp) alone — chain closures with
   * per-record key values, tau/sigma overlap evidence — supply them here;
   * predict.ts uses them (filtered to the instance's subjects) when present.
   */
  witnessTriples?: string[];
}

/** Canonical triple id: raw IRI/literal text, no quoting, '|'-joined. */
export const tripleId = (s: string, p: string, o: string): string => `${s}|${p}|${o}`;

/** Local name of an IRI: the segment after the last '/' or '#'. */
export function localName(iri: string): string {
  const i = Math.max(iri.lastIndexOf('/'), iri.lastIndexOf('#'));
  return i >= 0 ? iri.slice(i + 1) : iri;
}
