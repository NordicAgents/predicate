import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { ballFor, ballContext, type BallOptions } from './flat-retrieved.js';
import { readEpisode, applyEpisodeTriples } from '../episode-runner.js';
import { seedProvenance } from '../provenance.js';

/**
 * Retrieval-policy ball builders (publication plan §8 "Retrieval baselines").
 *
 * The benchmark's structural claim is that the IRI-only BFS baseline
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

export const RETRIEVAL_POLICIES = ['iri-bfs', 'literal-aware', 'key-aware'] as const;
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

/** The control: thin wrapper over the existing IRI-only BFS (flat-retrieved.ts). */
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

export async function ballForPolicy(
  client: StorageAdapter, policy: RetrievalPolicy, seeds: string[], hops: number,
  opts: PolicyBallOptions = {},
): Promise<PolicyBall> {
  if (policy === 'iri-bfs') return iriBfsBall(client, seeds, hops, opts);
  if (policy === 'literal-aware') return literalAwareBall(client, seeds, hops, opts);
  return keyAwareBall(client, seeds, hops, opts);
}

// ---------------------------------------------------------------------------
// Instance derivation (shared cross-agent data contract) + retrieval scoring
// ---------------------------------------------------------------------------

export type InstanceKind =
  | 'conflict' | 'benign-coreference' | 'benign-shared-value'
  | 'benign-duplicate' | 'benign-multivalued';

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
  inst: InstanceRecord, schemaBytes: number, opts: PolicyBallOptions = {},
): Promise<PredictionRow> {
  const outcomes: SeedOutcome[] = [];
  for (const seed of inst.subjects) {
    const t0 = performance.now();
    const pb = await ballForPolicy(client, policy, [seed], hops, opts);
    const context = await ballContext(client, pb.ball);
    const ms = performance.now() - t0;
    const { ids, objects } = parseContext(context);
    outcomes.push({
      seed,
      ballNodes: pb.ball.size,
      contextTriples: ids.size,
      contextBytes: schemaBytes + Buffer.byteLength(context, 'utf8'),
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
    flagged: outcomes.every((o) => o.witnessHits.length === inst.goldWitness.length),
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
