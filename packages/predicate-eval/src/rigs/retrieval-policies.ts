import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { ballFor, type BallOptions } from './flat-retrieved.js';
import { readEpisode, applyEpisodeTriples } from '../episode-runner.js';
import { seedProvenance } from '../provenance.js';
import { deriveV3Instances, isV3Oracle } from '../instances/v3.js';

/**
 * Retrieval-policy ball builders (publication plan §8 "Retrieval baselines").
 *
 * The benchmark's structural claim is that the non-type IRI BFS baseline
 * (rigs/flat-retrieved.ts) cannot cross a shared key LITERAL to the
 * co-referent record. Fatal objection 2 says the benchmark engineers that
 * failure. These policies answer it by STRENGTHENING the baseline:
 *
 *  - iri-bfs        control: the existing ballFor, unchanged.
 *  - literal-aware  schema-free upper bound: any two IRI nodes sharing ANY
 *                   identical literal value (on any predicate pair) are
 *                   neighbours. Finds key-co-referent records without knowing
 *                   what a key is — at whatever ball-size cost indiscriminate
 *                   literal joins incur.
 *  - key-aware      schema-informed: iri-bfs PLUS traversal through literals
 *                   of properties declared in owl:hasKey lists (kg:tbox).
 *
 * All three share ballFor's frontier semantics: undirected expansion over
 * GRAPH <kg:abox>, rdf:type edges never expanded, only IRIs enter the ball,
 * VALUES batches of 200, default cap 10k nodes.
 */

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const BATCH = 200;
const DEFAULT_CAP = 10_000;

export const RETRIEVAL_POLICIES = ['iri-bfs', 'literal-aware', 'key-aware', 'bm25'] as const;
export type RetrievalPolicy = (typeof RETRIEVAL_POLICIES)[number];

export interface PolicyBallOptions extends BallOptions {
  /** Pre-fetched owl:hasKey property IRIs (avoids one tbox query per ball). */
  keyProps?: string[];
}

export interface PolicyBall {
  ball: Set<string>;
  stats: { nodes: number; hopsUsed: number };
}

/** owl:hasKey property IRIs declared in kg:tbox (walks the RDF list). */
export async function keyProperties(client: StorageAdapter): Promise<string[]> {
  const r = await client.select(`
    SELECT DISTINCT ?prop WHERE {
      GRAPH <kg:tbox> {
        ?cls <${OWL_NS}hasKey> ?list .
        ?list <${RDF_NS}rest>*/<${RDF_NS}first> ?prop .
      }
    }
  `);
  return r.results.bindings.map((b) => b.prop!.value).sort();
}

/** The control: thin wrapper over the existing non-type IRI BFS. */
export async function iriBfsBall(
  client: StorageAdapter, seeds: string[], hops: number, opts: PolicyBallOptions = {},
): Promise<PolicyBall> {
  const ball = await ballFor(client, seeds, hops, opts);
  return { ball, stats: { nodes: ball.size, hopsUsed: hops } };
}

/** Shared BFS driver; `queryFor` renders the one-batch neighbour query. */
async function bfs(
  client: StorageAdapter, seeds: string[], hops: number, cap: number,
  queryFor: (values: string) => string,
): Promise<PolicyBall> {
  const ball = new Set<string>(seeds);
  let frontier = seeds.slice();
  let hopsUsed = 0;
  for (let h = 0; h < hops && frontier.length > 0 && ball.size < cap; h++) {
    hopsUsed = h + 1;
    const next = new Set<string>();
    for (let i = 0; i < frontier.length; i += BATCH) {
      const values = frontier.slice(i, i + BATCH).map((n) => `<${n}>`).join(' ');
      const r = await client.select(queryFor(values));
      for (const b of r.results.bindings) {
        const n = b.n!.value;
        if (!ball.has(n)) next.add(n);
      }
    }
    frontier = [];
    for (const n of next) {
      if (ball.size >= cap) break;
      ball.add(n);
      frontier.push(n);
    }
  }
  return { ball, stats: { nodes: ball.size, hopsUsed } };
}

const iriEdgeClauses = (values: string): string => `
    { VALUES ?f { ${values} } ?f ?p ?n . FILTER (?p != <${RDF_TYPE}>) }
    UNION
    { VALUES ?f { ${values} } ?n ?p ?f . FILTER (?p != <${RDF_TYPE}>) }`;

/**
 * BFS where two IRI nodes are additionally neighbours if they share ANY
 * identical literal value on ANY predicate pair (schema-free literal join).
 */
export async function literalAwareBall(
  client: StorageAdapter, seeds: string[], hops: number, opts: PolicyBallOptions = {},
): Promise<PolicyBall> {
  const cap = opts.maxBallNodes ?? DEFAULT_CAP;
  return bfs(client, seeds, hops, cap, (values) => `
    SELECT DISTINCT ?n WHERE {
      GRAPH <kg:abox> {
        ${iriEdgeClauses(values)}
        UNION
        { VALUES ?f { ${values} }
          ?f ?p1 ?lit . ?n ?p2 ?lit .
          FILTER (isLiteral(?lit)) FILTER (?n != ?f) }
      }
      FILTER (isIRI(?n))
    }
  `);
}

/**
 * iri-bfs PLUS expansion through declared keys only: two nodes are neighbours
 * if they share the same literal value on the SAME owl:hasKey property.
 */
export async function keyAwareBall(
  client: StorageAdapter, seeds: string[], hops: number, opts: PolicyBallOptions = {},
): Promise<PolicyBall> {
  const cap = opts.maxBallNodes ?? DEFAULT_CAP;
  const keyProps = opts.keyProps ?? await keyProperties(client);
  if (keyProps.length === 0) return iriBfsBall(client, seeds, hops, opts);
  const keyValues = keyProps.map((p) => `<${p}>`).join(' ');
  return bfs(client, seeds, hops, cap, (values) => `
    SELECT DISTINCT ?n WHERE {
      GRAPH <kg:abox> {
        ${iriEdgeClauses(values)}
        UNION
        { VALUES ?f { ${values} } VALUES ?kp { ${keyValues} }
          ?f ?kp ?lit . ?n ?kp ?lit .
          FILTER (isLiteral(?lit)) FILTER (?n != ?f) }
      }
      FILTER (isIRI(?n))
    }
  `);
}

const lexicalTokens = (text: string): string[] =>
  text.toLowerCase().split(/[^a-z0-9@._+-]+/u).filter((token) => token.length > 1);

interface Bm25Corpus {
  docs: Map<string, string[]>;
  averageLength: number;
  documentFrequency: Map<string, number>;
  rankings: Map<string, string[]>;
}

/** Per-loaded-store corpus/ranking cache; invalidated by loadDomainForRetrieval. */
const bm25Corpora = new WeakMap<StorageAdapter, Bm25Corpus>();
const subjectContextCorpora = new WeakMap<StorageAdapter, Map<string, string[]>>();

async function bm25Corpus(client: StorageAdapter): Promise<Bm25Corpus> {
  const cached = bm25Corpora.get(client);
  if (cached) return cached;
  const result = await client.select(`
    SELECT ?s ?p ?o WHERE {
      GRAPH <kg:abox> { ?s ?p ?o }
      FILTER (isIRI(?s))
    }
  `);
  const docs = new Map<string, string[]>();
  for (const binding of result.results.bindings) {
    const s = binding.s!.value;
    const terms = docs.get(s) ?? [];
    terms.push(...lexicalTokens(binding.p!.value), ...lexicalTokens(binding.o!.value));
    docs.set(s, terms);
  }
  const n = Math.max(1, docs.size);
  const averageLength = [...docs.values()].reduce((sum, terms) => sum + terms.length, 0) / n;
  const documentFrequency = new Map<string, number>();
  for (const terms of docs.values()) {
    for (const term of new Set(terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const corpus = { docs, averageLength, documentFrequency, rankings: new Map<string, string[]>() };
  bm25Corpora.set(client, corpus);
  return corpus;
}

/**
 * Batch-load the store's subject contexts once. This is semantically identical
 * to repeated ballContext queries, but avoids one SPARQL round trip per
 * (instance, seed, budget). The preload is common retrieval infrastructure and
 * occurs outside the per-query timer.
 */
async function subjectContextCorpus(client: StorageAdapter): Promise<Map<string, string[]>> {
  const cached = subjectContextCorpora.get(client);
  if (cached) return cached;
  const result = await client.select(`
    SELECT ?s ?p ?o WHERE {
      GRAPH <kg:abox> { ?s ?p ?o }
      FILTER (isIRI(?s))
    }
  `);
  const corpus = new Map<string, string[]>();
  for (const binding of result.results.bindings) {
    const object = binding.o!;
    const objectText = object.type === 'uri' ? `<${object.value}>` : JSON.stringify(object.value);
    const line = `<${binding.s!.value}> <${binding.p!.value}> ${objectText} .`;
    const lines = corpus.get(binding.s!.value) ?? [];
    lines.push(line);
    corpus.set(binding.s!.value, lines);
  }
  for (const lines of corpus.values()) lines.sort();
  subjectContextCorpora.set(client, corpus);
  return corpus;
}

function contextFromCorpus(corpus: Map<string, string[]>, ball: Set<string>): string {
  return [...ball].flatMap((subject) => corpus.get(subject) ?? []).sort().join('\n');
}

/**
 * Record-level BM25 baseline. Each RDF subject is a document consisting of
 * predicate/object lexical forms. The query is the seeded record text and the
 * parameter called `hops` by the shared CLI is BM25's top-k record count.
 *
 * This intentionally performs no key or schema expansion: a unique shared key
 * literal should rank a direct twin highly, while a multi-link chain requires
 * information absent from the seed document.
 */
export async function bm25Ball(
  client: StorageAdapter, seeds: string[], topK: number,
): Promise<PolicyBall> {
  const corpus = await bm25Corpus(client);
  const { docs, averageLength: avgDl, documentFrequency: df } = corpus;
  const cacheKey = [...seeds].sort().join('\n');
  const cachedRanking = corpus.rankings.get(cacheKey);
  if (cachedRanking) {
    return {
      ball: new Set([...seeds, ...cachedRanking.slice(0, topK)]),
      stats: { nodes: new Set([...seeds, ...cachedRanking.slice(0, topK)]).size, hopsUsed: topK },
    };
  }
  const queryTerms = seeds.flatMap((seed) => docs.get(seed) ?? lexicalTokens(seed));
  // Standard short-query BM25: duplicate terms in the seed record do not
  // multiply their query weight (otherwise repeated namespace tokens swamp a
  // unique identifier such as an email).
  const queryTf = new Map([...new Set(queryTerms)].map((term) => [term, 1]));

  const n = Math.max(1, docs.size);
  const k1 = 1.2;
  const b = 0.75;
  const scores: Array<{ subject: string; score: number }> = [];
  for (const [subject, terms] of docs) {
    if (seeds.includes(subject)) continue;
    const tf = new Map<string, number>();
    for (const term of terms) tf.set(term, (tf.get(term) ?? 0) + 1);
    let score = 0;
    for (const [term, qtf] of queryTf) {
      const f = tf.get(term) ?? 0;
      if (f === 0) continue;
      const dft = df.get(term) ?? 0;
      const idf = Math.log(1 + (n - dft + 0.5) / (dft + 0.5));
      const norm = f + k1 * (1 - b + b * terms.length / Math.max(1, avgDl));
      score += qtf * idf * (f * (k1 + 1) / norm);
    }
    scores.push({ subject, score });
  }
  scores.sort((a, b2) => b2.score - a.score || a.subject.localeCompare(b2.subject));
  const ranking = scores.map((item) => item.subject);
  corpus.rankings.set(cacheKey, ranking);
  const ball = new Set(seeds);
  for (const subject of ranking.slice(0, topK)) ball.add(subject);
  return { ball, stats: { nodes: ball.size, hopsUsed: topK } };
}

export async function ballForPolicy(
  client: StorageAdapter, policy: RetrievalPolicy, seeds: string[], hops: number,
  opts: PolicyBallOptions = {},
): Promise<PolicyBall> {
  if (policy === 'iri-bfs') return iriBfsBall(client, seeds, hops, opts);
  if (policy === 'literal-aware') return literalAwareBall(client, seeds, hops, opts);
  if (policy === 'key-aware') return keyAwareBall(client, seeds, hops, opts);
  return bm25Ball(client, seeds, hops);
}

// ---------------------------------------------------------------------------
// Instance derivation (shared cross-agent data contract) + retrieval scoring
// ---------------------------------------------------------------------------

export type InstanceKind =
  | 'conflict' | 'benign-coreference' | 'benign-shared-value'
  | 'benign-duplicate' | 'benign-multivalued'
  // phase1-v3 hard negatives (pre-registration Amendment A2.2):
  | 'benign-temporal' | 'benign-scoped';

export interface InstanceRecord {
  id: string;
  domain: string;
  kind: InstanceKind;
  subjects: string[];
  key: string | null;
  predicate: string | null;
  goldValues: string[];
  goldWitness: string[];
  isConflict: boolean;
}

export interface PredictionRow {
  instanceId: string;
  domain: string;
  system: string;
  flagged: boolean;
  values: string[];
  witness: string[];
  costMs: number;
  extra: Record<string, unknown>;
}

interface OracleFact { s: string; p: string; o: string; lit?: boolean; episode?: number }
interface OracleConflict { id: string; about: string; predicate: string; values: string[]; episode?: number }
interface OracleCoref { records: string[]; email: string; conflicted: boolean }
interface OracleJson {
  facts: OracleFact[];
  conflicts: OracleConflict[];
  coreference?: OracleCoref[];
  benign?: {
    benignCoreferences?: string[][];
    sharedOfficeSubjects?: string[];
    duplicateReassertions?: OracleFact[];
    multiValuedAdditions?: OracleFact[];
    sharedObjectSubjects?: OracleFact[];
  };
}

/** Triple id per the contract: "s|p|o" with raw (unquoted) terms. */
export const tripleId = (s: string, p: string, o: string): string => `${s}|${p}|${o}`;

const localName = (iri: string): string => iri.split(/[/#]/).pop() ?? iri;

/** Person token of a v2 record local name: "s1-p048" -> "p048" (canonical-manifest id convention). */
const personToken = (iri: string): string => localName(iri).replace(/^s\d+-/, '');

/**
 * Derive the contract's InstanceRecords from a fixture's oracle.json.
 * v2 (cross-record) oracles are detected by the presence of `coreference`;
 * anything else is treated as a v1 same-subject oracle.
 */
export function deriveInstances(domain: string, dir: string): InstanceRecord[] {
  const oracle = JSON.parse(readFileSync(join(dir, 'oracle.json'), 'utf8')) as OracleJson;
  // phase1-v3 oracles: ONE shared derivation for every arm (src/instances/v3.ts).
  if (isV3Oracle(oracle)) return deriveV3Instances(domain, oracle);
  return oracle.coreference ? deriveV2(domain, oracle) : deriveV1(domain, oracle);
}

function deriveV2(domain: string, oracle: OracleJson): InstanceRecord[] {
  const facts = oracle.facts;
  const factVal = (s: string, p: string): string | undefined =>
    facts.find((f) => f.s === s && f.p === p)?.o;
  const factPredOfLiteral = (s: string, o: string): string | undefined =>
    facts.find((f) => f.s === s && f.lit === true && f.o === o)?.p;

  const instances: InstanceRecord[] = [];

  for (const c of (oracle.coreference ?? []).filter((c) => c.conflicted)) {
    const [s1, s2] = c.records as [string, string];
    const pTag = c.email.split('@')[0]!;
    const entries = oracle.conflicts.filter((x) => x.about === s1 || x.about === s2);
    if (entries.length === 0) throw new Error(`no conflict entries for pair ${pTag}`);
    const predicate = entries[0]!.predicate;
    const goldValues = [...new Set(entries.flatMap((x) => x.values))];
    const emailPred = factPredOfLiteral(s1, c.email);
    const witness = [
      tripleId(s1, RDF_TYPE, factVal(s1, RDF_TYPE)!),
      tripleId(s2, RDF_TYPE, factVal(s2, RDF_TYPE)!),
      tripleId(s1, emailPred!, c.email),
      tripleId(s2, emailPred!, c.email),
      tripleId(s1, predicate, factVal(s1, predicate)!),
      tripleId(s2, predicate, factVal(s2, predicate)!),
    ];
    instances.push({
      id: `${domain}#pair-${pTag}`, domain, kind: 'conflict', subjects: [s1, s2],
      key: c.email, predicate, goldValues, goldWitness: witness, isConflict: true,
    });
  }

  for (const pair of oracle.benign?.benignCoreferences ?? []) {
    const [s1, s2] = pair as [string, string];
    const ce = (oracle.coreference ?? []).find(
      (c) => c.records.includes(s1) && c.records.includes(s2),
    );
    const email = ce?.email ?? facts.find((f) => f.s === s1 && f.lit === true)?.o ?? '';
    const pTag = email ? email.split('@')[0]! : localName(s1);
    const emailPred = factPredOfLiteral(s1, email);
    const witness = [
      tripleId(s1, RDF_TYPE, factVal(s1, RDF_TYPE)!),
      tripleId(s2, RDF_TYPE, factVal(s2, RDF_TYPE)!),
      tripleId(s1, emailPred!, email),
      tripleId(s2, emailPred!, email),
    ];
    instances.push({
      id: `${domain}#benign-coreference-${pTag}`, domain, kind: 'benign-coreference',
      subjects: [s1, s2], key: email, predicate: null, goldValues: [],
      goldWitness: witness, isConflict: false,
    });
  }

  // sharedOfficeSubjects are FP probes: each subject shares its (single-valued)
  // office OBJECT with some OTHER record — benign hub sharing, not coreference.
  // The two listed subjects need not share an office with each other.
  const shared = oracle.benign?.sharedOfficeSubjects ?? [];
  if (shared.length >= 2) {
    const [a, b] = shared as [string, string];
    const sharedValueFact = (s: string): OracleFact => {
      const cand = facts.filter((f) => f.s === s && !f.lit && f.p !== RDF_TYPE);
      const f = cand.find((x) => x.p.endsWith('#office'))
        ?? cand.find((x) => facts.some((g) => g.s !== s && g.p === x.p && g.o === x.o))
        ?? cand[0];
      if (!f) throw new Error(`sharedOfficeSubjects: no shared-value fact for ${s}`);
      return f;
    };
    const fa = sharedValueFact(a);
    const fb = sharedValueFact(b);
    instances.push({
      id: `${domain}#benign-shared-value-${personToken(a)}-${personToken(b)}`,
      domain, kind: 'benign-shared-value',
      subjects: [a, b], key: null, predicate: fa.p,
      goldValues: [...new Set([fa.o, fb.o])],
      goldWitness: [tripleId(a, fa.p, fa.o), tripleId(b, fb.p, fb.o)],
      isConflict: false,
    });
  }

  return instances;
}

function deriveV1(domain: string, oracle: OracleJson): InstanceRecord[] {
  const instances: InstanceRecord[] = [];
  for (const c of oracle.conflicts) {
    instances.push({
      id: `${domain}#subject-${localName(c.about)}`, domain, kind: 'conflict',
      subjects: [c.about], key: null, predicate: c.predicate, goldValues: c.values.slice(),
      goldWitness: c.values.map((v) => tripleId(c.about, c.predicate, v)), isConflict: true,
    });
  }
  // multiValuedAdditions are listed one-per-added-object; merge by (s, p) so
  // ids match the canonical manifest (instances/manifest.ts) exactly.
  const multiBySP = new Map<string, OracleFact[]>();
  for (const e of oracle.benign?.multiValuedAdditions ?? []) {
    const k = `${e.s}|${e.p}`;
    multiBySP.set(k, [...(multiBySP.get(k) ?? []), e]);
  }
  const benignKinds: Array<[InstanceKind, string, OracleFact[][]]> = [
    ['benign-duplicate', 'benign-duplicate', (oracle.benign?.duplicateReassertions ?? []).map((e) => [e])],
    ['benign-multivalued', 'benign-multivalued', [...multiBySP.values()]],
    ['benign-shared-value', 'benign-shared-value', (oracle.benign?.sharedObjectSubjects ?? []).map((e) => [e])],
  ];
  for (const [kind, prefix, groups] of benignKinds) {
    for (const group of groups) {
      const e = group[0]!;
      const values = [...new Set(group.map((g) => g.o))];
      instances.push({
        id: `${domain}#${prefix}-${localName(e.s)}`, domain, kind, subjects: [e.s],
        key: null, predicate: e.p, goldValues: values,
        goldWitness: values.map((v) => tripleId(e.s, e.p, v)), isConflict: false,
      });
    }
  }
  return instances;
}

/**
 * Reset kg:tbox + kg:abox, load world.ttl and ALL episodes, seed provenance
 * (harness rule: kg:abox triples must carry confidence before anything else
 * runs, even though these policies never materialize). Returns the schema
 * text (world.ttl) so callers can count context bytes the same way the
 * flat-retrieved arm does.
 */
export async function loadDomainForRetrieval(
  client: StorageAdapter, dir: string, episodes?: number,
): Promise<{ schema: string; episodesLoaded: number }> {
  const schema = readFileSync(join(dir, 'world.ttl'), 'utf8');
  for (const g of ['kg:tbox', 'kg:abox'] as const) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  bm25Corpora.delete(client);
  subjectContextCorpora.delete(client);
  await client.loadTurtle(schema, 'kg:tbox');
  const paths = readdirSync(join(dir, 'episodes'))
    .filter((f) => f.endsWith('.jsonl')).sort()
    .map((f) => join(dir, 'episodes', f));
  const n = Math.min(episodes ?? paths.length, paths.length);
  for (let i = 0; i < n; i++) await applyEpisodeTriples(client, readEpisode(paths[i]!));
  await seedProvenance(client);
  return { schema, episodesLoaded: n };
}

/** Parse a ballContext N-Triples string into triple ids and object values. */
export function parseContext(context: string): { ids: Set<string>; objects: Set<string> } {
  const ids = new Set<string>();
  const objects = new Set<string>();
  for (const line of context.split('\n')) {
    const m = /^<([^>]+)> <([^>]+)> (.+) \.$/.exec(line.trim());
    if (!m) continue;
    const o = m[3]!.startsWith('<') ? m[3]!.slice(1, -1) : (JSON.parse(m[3]!) as string);
    ids.add(tripleId(m[1]!, m[2]!, o));
    objects.add(o);
  }
  return { ids, objects };
}

interface SeedOutcome {
  seed: string; ballNodes: number; contextTriples: number; contextBytes: number;
  ms: number; witnessHits: string[]; valueHits: string[];
}

/**
 * Contract retrieval semantics: seed the ball on EACH subject separately and
 * report the WORST case (fewest witness hits, then fewest value hits, then
 * subject order). flagged := every goldWitness triple retrievable from every
 * seed; values/witness := what the worst seed's context contains.
 */
export async function evaluateInstance(
  client: StorageAdapter, policy: RetrievalPolicy, hops: number,
  inst: InstanceRecord, opts: PolicyBallOptions = {},
): Promise<PredictionRow> {
  const contextCorpus = await subjectContextCorpus(client);
  const outcomes: SeedOutcome[] = [];
  for (const seed of inst.subjects) {
    const t0 = performance.now();
    const pb = await ballForPolicy(client, policy, [seed], hops, opts);
    const context = contextFromCorpus(contextCorpus, pb.ball);
    const ms = performance.now() - t0;
    const { ids, objects } = parseContext(context);
    outcomes.push({
      seed,
      ballNodes: pb.ball.size,
      contextTriples: ids.size,
      // The schema is a shared contract input, not query-returned evidence.
      // Measure only the serialized assertions selected for this query.
      contextBytes: Buffer.byteLength(context, 'utf8'),
      ms,
      witnessHits: inst.goldWitness.filter((w) => ids.has(w)),
      valueHits: inst.goldValues.filter((v) => objects.has(v)),
    });
  }
  const worst = outcomes.reduce((a, b) =>
    b.witnessHits.length < a.witnessHits.length
    || (b.witnessHits.length === a.witnessHits.length && b.valueHits.length < a.valueHits.length)
      ? b : a);
  return {
    instanceId: inst.id,
    domain: inst.domain,
    system: `retrieval:${policy}@${hops}`,
    // `flagged` is the benchmark's conflict-detection field. Retrieval
    // completeness is vacuous on benign instances, but must not be serialized
    // as a positive conflict prediction.
    flagged: inst.isConflict && outcomes.every((o) => o.witnessHits.length === inst.goldWitness.length),
    values: worst.valueHits,
    witness: worst.witnessHits,
    costMs: Math.round(worst.ms * 100) / 100,
    extra: {
      ballNodes: worst.ballNodes,
      contextTriples: worst.contextTriples,
      contextBytes: worst.contextBytes,
      hops,
      policy,
      seededOn: worst.seed,
    },
  };
}
