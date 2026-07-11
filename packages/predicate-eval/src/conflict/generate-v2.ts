import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EpisodeTriple } from '../episode-runner.js';
import type { Question } from '../eval-types.js';

/**
 * CONFLICT-BENCH v2 — CROSS-RECORD conflicts that require inference to see.
 *
 * v1's same-subject conflicts are solvable by a strong model reading the KB
 * in-context (measured: perfect tie at every density — see
 * papers/paper1/EXPERIMENT-LOG.md). v2 plants the conflict across TWO records
 * of the same person, co-referent ONLY through a shared email key (a string
 * LITERAL): rec-A from session 1 carries office X; rec-B from session 2 is a
 * sparse update record carrying office Y. By construction the two records
 * share NO IRI object (the second record has no other attributes and its
 * office value differs), so an IRI-frontier k-hop retrieval seeded on either
 * record cannot reach the other for any k <= 2 — literals are not traversable
 * edges. The reasoner is graph-distance-independent: r14 (owl:hasKey) derives
 * owl:sameAs from the shared key, r23 converges j:SingleValued values across
 * the pair, r22 flags both records with j:ValueConflict. Both records and
 * both values are preserved.
 *
 * Schema symmetry (load-bearing, as in v1): world.ttl states in rdfs:comments
 * that email uniquely identifies a person AND which properties are
 * single-valued. Every arm — flat-all, flat-retrieved, reasoner — sees the
 * same schema text. The gap measured against flat-retrieved is therefore
 * attributable to WHAT WAS RETRIEVED, and against flat-all to context
 * capacity/attention, never to hidden schema knowledge.
 *
 * Determinism: fixed SEED through mulberry32; fixtures generated once and
 * COMMITTED under fixtures/conflict-xr-{small,scale}; tests read files.
 */

const CB2 = 'http://ex/cb2#';
const BASE = 'http://ex/cb2/';
const J = 'https://industriagents.com/predicate/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

export const SEED_V2 = 0xbadc0de;

/** Conflicted fraction of persons (fixed; scale is the variable across variants). */
const DENSITY = 0.2;
const MANAGERS = 6;
const OFFICES = 5;
const TEAMS = 6;

export interface XrVariant { persons: number }
export const XR_VARIANTS: Record<string, XrVariant> = {
  'conflict-xr-small': { persons: 60 },
  'conflict-xr-scale': { persons: 300 },
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const pad = (i: number): string => String(i).padStart(3, '0');
/** Session-s record for person i. Sessions give records distinct IRIs. */
const rec = (i: number, session: 1 | 2): string => `${BASE}s${session}-p${pad(i)}`;
const email = (i: number): string => `p${pad(i)}@ex.com`;
const manager = (i: number): string => `${BASE}m${i}`;
const office = (i: number): string => `${BASE}office${i}`;
const team = (i: number): string => `${BASE}team${i}`;

const PERSON_RECORD = `${CB2}PersonRecord`;
const EMAIL = `${CB2}email`;
const REPORTS_TO = `${CB2}reportsTo`;
const OFFICE = `${CB2}office`;
const MEMBER_OF = `${CB2}memberOf`;

const WORLD_TTL = `@prefix cb2:  <${CB2}> .
@prefix j:    <${J}> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cb2:PersonRecord a owl:Class ;
  owl:hasKey ( cb2:email ) ;
  rdfs:comment "one record about a person, captured in some session; a person may have MULTIPLE records. cb2:email is a KEY: two records with the same email describe the SAME person" .
cb2:Office a owl:Class .
cb2:Team   a owl:Class .

cb2:email a owl:DatatypeProperty ;
  rdfs:domain cb2:PersonRecord ;
  rdfs:comment "identifying key: records sharing an email are the same person (see cb2:PersonRecord)" .

cb2:reportsTo a owl:ObjectProperty, j:SingleValued ;
  rdfs:domain cb2:PersonRecord ;
  rdfs:comment "single-valued PER PERSON: a person has exactly one manager; two different values across that person's records indicate a data conflict" .

cb2:office a owl:ObjectProperty, j:SingleValued ;
  rdfs:domain cb2:PersonRecord ; rdfs:range cb2:Office ;
  rdfs:comment "single-valued PER PERSON: a person has exactly one office; two different values across that person's records indicate a data conflict" .

cb2:memberOf a owl:ObjectProperty ;
  rdfs:domain cb2:PersonRecord ; rdfs:range cb2:Team ;
  rdfs:comment "multi-valued: a person may belong to any number of teams; multiple values are normal, not a conflict" .
`;

interface OracleFactJson { s: string; p: string; o: string; lit?: boolean; episode: number }
interface OracleConflictJson {
  id: string; about: string; predicate: string; values: string[]; episode: number;
}

export interface XrFixture {
  world: string;
  episode1: EpisodeTriple[];
  episode2: EpisodeTriple[];
  oracle: {
    facts: OracleFactJson[];
    conflicts: OracleConflictJson[];
    disjoint: Array<{ classes: string[] }>;
    coreference: Array<{ records: [string, string]; email: string; conflicted: boolean }>;
    benign: {
      benignCoreferences: string[][];
      sharedOfficeSubjects: string[];
    };
  };
  questions: Question[];
}

const flagAsk = (s: string): string =>
  `ASK { GRAPH <kg:inferred> { <${s}> <${RDF_TYPE}> <${J}ValueConflict> } }`;

export function generateXrFixture(domain: string, variant: XrVariant, seed: number = SEED_V2): XrFixture {
  const rand = mulberry32(seed);
  const P = variant.persons;

  // Episode 1 — session-1 record for every person: type, email key (LITERAL),
  // office, reportsTo, memberOf. 5 triples per person.
  const e01: EpisodeTriple[] = [];
  for (let i = 0; i < P; i++) {
    const r1 = rec(i, 1);
    e01.push({ s: r1, p: RDF_TYPE, o: PERSON_RECORD });
    e01.push({ s: r1, p: EMAIL, o: email(i), lit: true });
    e01.push({ s: r1, p: OFFICE, o: office(i % OFFICES) });
    e01.push({ s: r1, p: REPORTS_TO, o: manager(i % MANAGERS) });
    e01.push({ s: r1, p: MEMBER_OF, o: team(i % TEAMS) });
  }

  // Seeded roles. Conflicted persons get a session-2 record with a DIFFERENT
  // office; benign-coref persons get a session-2 record re-stating the SAME
  // office; a shared-office pair covers the "same value, different people" FP.
  const k = Math.round(DENSITY * P);
  const order = shuffle(Array.from({ length: P }, (_, i) => i), rand);
  const conflicted = order.slice(0, k).sort((a, b) => a - b);
  const [ben1, ben2, ben3] = order.slice(k, k + 3) as [number, number, number];
  const benign = [ben1, ben2, ben3];
  const [shared1, shared2] = order.slice(k + 3, k + 5) as [number, number];
  const [clean1, clean2] = order.slice(k + 5, k + 7) as [number, number];

  // Episode 2 — sparse session-2 records: type + email + office ONLY. The
  // conflicted second office is offset so it NEVER equals the session-1 office
  // (and, with no other attributes, the two records share no IRI object at
  // all — the co-reference lives ONLY in the literal email key).
  const e02: EpisodeTriple[] = [];
  const conflicts: OracleConflictJson[] = [];
  const coreference: XrFixture['oracle']['coreference'] = [];
  const addSession2 = (i: number, officeIdx: number): void => {
    const r2 = rec(i, 2);
    e02.push({ s: r2, p: RDF_TYPE, o: PERSON_RECORD });
    e02.push({ s: r2, p: EMAIL, o: email(i), lit: true });
    e02.push({ s: r2, p: OFFICE, o: office(officeIdx) });
  };
  for (const i of conflicted) {
    const origIdx = i % OFFICES;
    const secondIdx = (i + 1 + (i % (OFFICES - 1))) % OFFICES === origIdx
      ? (origIdx + 1) % OFFICES
      : (i + 1 + (i % (OFFICES - 1))) % OFFICES;
    addSession2(i, secondIdx);
    coreference.push({ records: [rec(i, 1), rec(i, 2)], email: email(i), conflicted: true });
    // r22+r23 flag BOTH members of the pair; the oracle lists each.
    for (const member of [rec(i, 1), rec(i, 2)]) {
      conflicts.push({
        id: `vc-${member.slice(BASE.length)}`,
        about: member,
        predicate: OFFICE,
        values: [office(origIdx), office(secondIdx)],
        episode: 2,
      });
    }
  }
  for (const i of benign) {
    addSession2(i, i % OFFICES); // SAME office — co-referent, no conflict.
    coreference.push({ records: [rec(i, 1), rec(i, 2)], email: email(i), conflicted: false });
  }

  const facts: OracleFactJson[] = [
    ...e01.map((t) => ({ ...t, episode: 1 })),
    ...e02.map((t) => ({ ...t, episode: 2 })),
  ];

  // Questions. Value questions name the SESSION-2 record (the handle a user
  // holding the latest update would have) — its k-hop ball provably excludes
  // the session-1 record, so a retrieval-mediated arm answers from one side.
  const c0 = conflicted[0]!;
  const c1 = conflicted[1]!;
  const c0offices = conflicts.find((c) => c.about === rec(c0, 2))!.values;
  const qid = (n: number): string => `${domain}-q${String(n).padStart(2, '0')}`;
  const questions: Question[] = [
    {
      id: qid(1),
      text: 'Which person records belong to a person with conflicting values on a single-valued property across their records?',
      type: 'conflict',
      key: { derive: 'all-conflict-subjects' },
      needs_episode: 2,
      rule_under_test: ['r14', 'r23', 'r22'],
      reasoning_dependent: true,
      golden_sparql:
        `SELECT ?x WHERE { GRAPH <kg:inferred> { ?x <${RDF_TYPE}> <${J}ValueConflict> } }`,
    },
    {
      id: qid(2),
      text: `Does the person described by record s2-p${pad(c0)} have conflicting office values across their records?`,
      type: 'boolean',
      key: { derive: 'literal-boolean', since: 2 },
      needs_episode: 2,
      rule_under_test: ['r14', 'r23', 'r22'],
      reasoning_dependent: true,
      golden_sparql: flagAsk(rec(c0, 2)),
      retrieval_seeds: [rec(c0, 2)],
    },
    {
      id: qid(3),
      text: `Does the person described by record s1-p${pad(c1)} have conflicting office values across their records?`,
      type: 'boolean',
      key: { derive: 'literal-boolean', since: 2 },
      needs_episode: 2,
      rule_under_test: ['r14', 'r23', 'r22'],
      reasoning_dependent: true,
      golden_sparql: flagAsk(rec(c1, 1)),
      retrieval_seeds: [rec(c1, 1)],
    },
    {
      // FP probe: co-referent records that AGREE — sameAs derived, no conflict.
      id: qid(4),
      text: `Does the person described by record s2-p${pad(ben1)} have conflicting office values across their records?`,
      type: 'boolean',
      key: { derive: 'boolean-conflict', about: rec(ben1, 2) },
      needs_episode: 2,
      rule_under_test: ['r14', 'r23', 'r22'],
      reasoning_dependent: false,
      golden_sparql: flagAsk(rec(ben1, 2)),
      retrieval_seeds: [rec(ben1, 2)],
    },
    {
      // FP probe: two DIFFERENT people (different emails) sharing an office value.
      id: qid(5),
      text: `Does the person described by record s1-p${pad(shared1)} have conflicting office values across their records?`,
      type: 'boolean',
      key: { derive: 'boolean-conflict', about: rec(shared1, 1) },
      needs_episode: 2,
      rule_under_test: ['r22'],
      reasoning_dependent: false,
      golden_sparql: flagAsk(rec(shared1, 1)),
      retrieval_seeds: [rec(shared1, 1), rec(shared2, 1)],
    },
    {
      // The wrong-answer-avoidance question: BOTH offices are the honest answer.
      id: qid(6),
      text: `According to ALL records for the person described by record s2-p${pad(c0)}, which office(s) are on file for them?`,
      type: 'set',
      key: { derive: 'literal-set', values: c0offices, since: 2 },
      needs_episode: 2,
      rule_under_test: ['r14', 'r23'],
      reasoning_dependent: true,
      golden_sparql: `SELECT ?o WHERE {
        { GRAPH <kg:abox> { <${rec(c0, 2)}> <${OFFICE}> ?o } }
        UNION
        { GRAPH <kg:inferred> { <${rec(c0, 2)}> <${OFFICE}> ?o } }
      }`,
      retrieval_seeds: [rec(c0, 2)],
    },
    {
      id: qid(7),
      text: `Which office is on file for the person described by record s1-p${pad(clean1)} (single record, direct recall)?`,
      type: 'set',
      key: { derive: 'direct', rel: OFFICE, from: rec(clean1, 1) },
      needs_episode: 1,
      rule_under_test: [],
      reasoning_dependent: false,
      golden_sparql: `SELECT ?o WHERE { GRAPH <kg:abox> { <${rec(clean1, 1)}> <${OFFICE}> ?o } }`,
      retrieval_seeds: [rec(clean1, 1)],
    },
    {
      id: qid(8),
      text: `Who does the person described by record s1-p${pad(clean2)} report to (single record, direct recall)?`,
      type: 'set',
      key: { derive: 'direct', rel: REPORTS_TO, from: rec(clean2, 1) },
      needs_episode: 1,
      rule_under_test: [],
      reasoning_dependent: false,
      golden_sparql: `SELECT ?m WHERE { GRAPH <kg:abox> { <${rec(clean2, 1)}> <${REPORTS_TO}> ?m } }`,
      retrieval_seeds: [rec(clean2, 1)],
    },
  ];

  return {
    world: WORLD_TTL,
    episode1: e01,
    episode2: e02,
    oracle: {
      facts,
      conflicts,
      disjoint: [],
      coreference,
      benign: {
        benignCoreferences: benign.map((i) => [rec(i, 1), rec(i, 2)]),
        sharedOfficeSubjects: [rec(shared1, 1), rec(shared2, 1)],
      },
    },
    questions,
  };
}

const toJsonl = (ts: EpisodeTriple[]): string => ts.map((t) => JSON.stringify(t)).join('\n') + '\n';

export function writeXrFixture(dir: string, domain: string, variant: XrVariant, seed: number = SEED_V2): void {
  const fx = generateXrFixture(domain, variant, seed);
  mkdirSync(join(dir, 'episodes'), { recursive: true });
  writeFileSync(join(dir, 'world.ttl'), fx.world);
  writeFileSync(join(dir, 'episodes', 'e01.jsonl'), toJsonl(fx.episode1));
  writeFileSync(join(dir, 'episodes', 'e02.jsonl'), toJsonl(fx.episode2));
  writeFileSync(join(dir, 'oracle.json'), JSON.stringify(fx.oracle, null, 2) + '\n');
  writeFileSync(join(dir, 'questions.json'), JSON.stringify(fx.questions, null, 2) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ?? join(import.meta.dirname, '..', '..', 'fixtures');
  for (const [domain, variant] of Object.entries(XR_VARIANTS)) {
    writeXrFixture(join(root, domain), domain, variant);
    console.log(`wrote ${join(root, domain)} (persons=${variant.persons})`);
  }
}
