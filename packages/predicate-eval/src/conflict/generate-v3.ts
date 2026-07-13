import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EpisodeTriple } from '../episode-runner.js';
import type { OracleV3, V3Group } from '../instances/v3.js';

/**
 * CONFLICT-BENCH phase1-v3 — the Gate-B fixture family registered in
 * pre-registration Amendment A2.1 (2026-07-13), generated BEFORE any system
 * ran on it. Three designs, five fixtures:
 *
 *  1. conflict-chain-m2 / conflict-chain-m3 — ~K-chains of length m: two
 *     endpoint records carrying the constrained value (cb3:office) joined
 *     through m-1 SPARSE INTERMEDIATE records that carry TWO key values
 *     (cb3:email) each and no constrained value. No single key-value bucket
 *     ever holds two distinct office values, so the single-join detectors
 *     (exact-key-join, sparql-groupby) are structurally insufficient (H6.i);
 *     closing ~K with union-find (exact-key-join-x) or iterating F2 to
 *     fixpoint (reasoner r14/r23/r22) recovers completeness (H6.ii). Every
 *     conflict witness has |W| = 3m+3. Intermediates assert no IRI object, so
 *     they are ISOLATED vertices of the IRI graph: iri-bfs is witness-
 *     incomplete at EVERY hop budget (H6.iv), and key-aware retrieval needs
 *     k >= m (H6.iii).
 *
 *  2. conflict-h3-nk1 / conflict-h3-nk3 — the v2 cross-record twin mechanism
 *     unchanged, PLUS nk in {1,3} non-key shared-literal predicates
 *     (cb3:city; + cb3:title, cb3:building) shared across groups of person
 *     records. literal-aware and key-aware balls provably differ here, making
 *     H3 (context premium, monotone in nk) testable — the required Phase-1
 *     fixture of Amendment A1. Oracle is v2-SHAPED: every v2 code path
 *     (manifest, exact arm, retrieval arm) consumes these fixtures untouched.
 *
 *  3. conflict-tausig — record-level valid-time and scope annotations
 *     (cb3:validFrom / cb3:validTo / cb3:sourceScope; the record-as-snapshot
 *     encoding used by realistic registries). Kinds: conflict (overlapping
 *     tau, sigma equal-or-absent, differing office), benign-temporal
 *     (disjoint tau — temporal supersession), benign-scoped (different
 *     sigma — both values correct), benign-coreference (agreeing values).
 *     tau/sigma-blind detectors are predicted to flag ALL benign-temporal and
 *     benign-scoped instances (H7).
 *
 * Determinism: fixed SEED_V3 through mulberry32; fixtures generated once and
 * COMMITTED under fixtures/<domain>; scripts/build-evidence.sh regenerates
 * into a temp dir and hard-fails on any drift, exactly as for mechanism-v0.
 */

const CB3 = 'http://ex/cb3#';
const BASE = 'http://ex/cb3/';
const J = 'https://industriagents.com/predicate/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

export const SEED_V3 = 0x5eedca7;

const MANAGERS = 6;
const OFFICES = 5;
const TEAMS = 6;

export type V3FixtureKind = 'chain' | 'h3' | 'tausig';

export interface V3Variant {
  kind: V3FixtureKind;
  persons: number;
  /** chain: ~K-chain length m (>= 2). */
  chainLength?: number;
  /** chain/tausig: how many persons are conflicted. */
  conflicted?: number;
  /** h3: number of non-key shared-literal predicates (1 or 3). */
  nonKeyLiterals?: number;
}

export const V3_VARIANTS: Record<string, V3Variant> = {
  'conflict-chain-m2': { kind: 'chain', persons: 40, chainLength: 2, conflicted: 10 },
  'conflict-chain-m3': { kind: 'chain', persons: 24, chainLength: 3, conflicted: 6 },
  'conflict-h3-nk1': { kind: 'h3', persons: 60, nonKeyLiterals: 1 },
  'conflict-h3-nk3': { kind: 'h3', persons: 60, nonKeyLiterals: 3 },
  'conflict-tausig': { kind: 'tausig', persons: 60, conflicted: 12 },
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
const rec = (i: number, session: number): string => `${BASE}s${session}-p${pad(i)}`;
/** Key literal l of person i: l=0 is the base email, l>=1 are alias emails. */
const email = (i: number, l = 0): string => (l === 0 ? `p${pad(i)}@ex.com` : `p${pad(i)}.alt${l}@ex.com`);
const manager = (i: number): string => `${BASE}m${i}`;
const office = (i: number): string => `${BASE}office${i}`;
const team = (i: number): string => `${BASE}team${i}`;

const PERSON_RECORD = `${CB3}PersonRecord`;
const EMAIL = `${CB3}email`;
const REPORTS_TO = `${CB3}reportsTo`;
const OFFICE = `${CB3}office`;
const MEMBER_OF = `${CB3}memberOf`;
const CITY = `${CB3}city`;
const TITLE = `${CB3}title`;
const BUILDING = `${CB3}building`;
const VALID_FROM = `${CB3}validFrom`;
const VALID_TO = `${CB3}validTo`;
const SOURCE_SCOPE = `${CB3}sourceScope`;

/** Second office index that provably differs from the session-1 office (v2 formula). */
function conflictingOfficeIdx(i: number): number {
  const origIdx = i % OFFICES;
  const cand = (i + 1 + (i % (OFFICES - 1))) % OFFICES;
  return cand === origIdx ? (origIdx + 1) % OFFICES : cand;
}

const CORE_TTL = `@prefix cb3:  <${CB3}> .
@prefix j:    <${J}> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cb3:PersonRecord a owl:Class ;
  owl:hasKey ( cb3:email ) ;
  rdfs:comment "one record about a person, captured in some session; a person may have MULTIPLE records AND multiple email addresses. cb3:email is a KEY: two records sharing ANY email value describe the SAME person" .
cb3:Office a owl:Class .
cb3:Team   a owl:Class .

cb3:email a owl:DatatypeProperty ;
  rdfs:domain cb3:PersonRecord ;
  rdfs:comment "identifying key: records sharing an email are the same person (see cb3:PersonRecord); a record may list more than one email for its person" .

cb3:reportsTo a owl:ObjectProperty, j:SingleValued ;
  rdfs:domain cb3:PersonRecord ;
  rdfs:comment "single-valued PER PERSON: a person has exactly one manager; two different values across that person's records indicate a data conflict" .

cb3:office a owl:ObjectProperty, j:SingleValued ;
  rdfs:domain cb3:PersonRecord ; rdfs:range cb3:Office ;
  rdfs:comment "single-valued PER PERSON: a person has exactly one office; two different values across that person's records indicate a data conflict" .

cb3:memberOf a owl:ObjectProperty ;
  rdfs:domain cb3:PersonRecord ; rdfs:range cb3:Team ;
  rdfs:comment "multi-valued: a person may belong to any number of teams; multiple values are normal, not a conflict" .
`;

const H3_TTL_EXTRA = `
cb3:city a owl:DatatypeProperty ;
  rdfs:domain cb3:PersonRecord ;
  rdfs:comment "NON-IDENTIFYING descriptive literal: many different people share a city; sharing a city does NOT make two records the same person" .

cb3:title a owl:DatatypeProperty ;
  rdfs:domain cb3:PersonRecord ;
  rdfs:comment "NON-IDENTIFYING descriptive literal: many different people share a job title" .

cb3:building a owl:DatatypeProperty ;
  rdfs:domain cb3:PersonRecord ;
  rdfs:comment "NON-IDENTIFYING descriptive literal: many different people share a building" .
`;

const TAUSIG_TTL_EXTRA = `
cb3:validFrom a owl:DatatypeProperty, j:ValidFrom ;
  rdfs:domain cb3:PersonRecord ;
  rdfs:comment "record-level valid-time START (inclusive ISO date): every assertion of this record holds from this date. Absent means unbounded. Records whose intervals do NOT overlap describe different periods — differing values across them are an UPDATE, not a conflict" .

cb3:validTo a owl:DatatypeProperty, j:ValidTo ;
  rdfs:domain cb3:PersonRecord ;
  rdfs:comment "record-level valid-time END (exclusive ISO date). Absent means unbounded" .

cb3:sourceScope a owl:DatatypeProperty, j:SourceScope ;
  rdfs:domain cb3:PersonRecord ;
  rdfs:comment "record-level scope: the system/context this record is valid in. Records with DIFFERENT scopes are not comparable — differing values across them are scoped facts (both may be correct), not a conflict. Absent means unscoped (comparable to everything)" .
`;

interface OracleFactJson { s: string; p: string; o: string; lit?: boolean; episode: number }

export interface V3Fixture {
  world: string;
  /** episodes[k] is episode k+1 (written as episodes/e0<k+1>.jsonl). */
  episodes: EpisodeTriple[][];
  oracle: OracleV3 | Record<string, unknown>;
  questions: [];
}

// ---------------------------------------------------------------------------
// chain fixtures (v3 oracle)
// ---------------------------------------------------------------------------

export function generateChainFixture(domain: string, variant: V3Variant, seed: number = SEED_V3): V3Fixture {
  const rand = mulberry32(seed);
  const P = variant.persons;
  const m = variant.chainLength!;
  const K = variant.conflicted!;
  const sessions = m + 1;

  const order = shuffle(Array.from({ length: P }, (_, i) => i), rand);
  const conflicted = new Set(order.slice(0, K));

  const episodes: EpisodeTriple[][] = Array.from({ length: sessions }, () => []);
  const facts: OracleFactJson[] = [];
  const push = (ep: number, t: EpisodeTriple): void => {
    episodes[ep - 1]!.push(t);
    facts.push({ ...t, episode: ep });
  };

  const groups: V3Group[] = [];
  const conflicts: OracleV3['conflicts'] = [];
  for (let i = 0; i < P; i++) {
    const isConflict = conflicted.has(i);
    const idx1 = i % OFFICES;
    const idx2 = isConflict ? conflictingOfficeIdx(i) : idx1;

    // Endpoint A (session 1): full record. 5 triples.
    push(1, { s: rec(i, 1), p: RDF_TYPE, o: PERSON_RECORD });
    push(1, { s: rec(i, 1), p: EMAIL, o: email(i, 0), lit: true });
    push(1, { s: rec(i, 1), p: OFFICE, o: office(idx1) });
    push(1, { s: rec(i, 1), p: REPORTS_TO, o: manager(i % MANAGERS) });
    push(1, { s: rec(i, 1), p: MEMBER_OF, o: team(i % TEAMS) });

    // Sparse intermediates (sessions 2..m): type + TWO key literals, nothing
    // else — no IRI object at all, so each intermediate is an isolated vertex
    // of the IRI graph.
    for (let s = 2; s <= m; s++) {
      push(s, { s: rec(i, s), p: RDF_TYPE, o: PERSON_RECORD });
      push(s, { s: rec(i, s), p: EMAIL, o: email(i, s - 2), lit: true });
      push(s, { s: rec(i, s), p: EMAIL, o: email(i, s - 1), lit: true });
    }

    // Endpoint B (session m+1): type + last key literal + office. 3 triples.
    push(sessions, { s: rec(i, sessions), p: RDF_TYPE, o: PERSON_RECORD });
    push(sessions, { s: rec(i, sessions), p: EMAIL, o: email(i, m - 1), lit: true });
    push(sessions, { s: rec(i, sessions), p: OFFICE, o: office(idx2) });

    const records = Array.from({ length: sessions }, (_, s) => rec(i, s + 1));
    const keys = Array.from({ length: m }, (_, l) => email(i, l));
    const witness = [
      ...records.map((r) => ({ s: r, p: RDF_TYPE, o: PERSON_RECORD })),
      // Link l joins records[l] and records[l+1] through key literal l.
      ...keys.flatMap((k, l) => [
        { s: records[l]!, p: EMAIL, o: k },
        { s: records[l + 1]!, p: EMAIL, o: k },
      ]),
      { s: records[0]!, p: OFFICE, o: office(idx1) },
      { s: records[sessions - 1]!, p: OFFICE, o: office(idx2) },
    ];
    groups.push({
      person: `p${pad(i)}`,
      kind: isConflict ? 'conflict' : 'benign-coreference',
      records, keys, keyProp: EMAIL, predicate: OFFICE,
      values: isConflict ? [office(idx1), office(idx2)] : [office(idx1)],
      witness,
    });
    if (isConflict) {
      for (const r of records) {
        conflicts.push({
          id: `vc-${r.slice(BASE.length)}`, about: r, predicate: OFFICE,
          values: [office(idx1), office(idx2)], episode: sessions,
        });
      }
    }
  }

  // Shared-value FP probe: the endpoint records of the first two benign
  // persons (in index order) sharing a session-1 office index.
  const benignSorted = order.slice(K).sort((a, b) => a - b);
  let sharedPair: [number, number] | null = null;
  outer: for (let x = 0; x < benignSorted.length && !sharedPair; x++) {
    for (let y = x + 1; y < benignSorted.length; y++) {
      if (benignSorted[x]! % OFFICES === benignSorted[y]! % OFFICES) {
        sharedPair = [benignSorted[x]!, benignSorted[y]!];
        break outer;
      }
    }
  }
  if (!sharedPair) throw new Error(`${domain}: no benign pair shares an office index`);

  const oracle: OracleV3 = {
    version: 3, chainLength: m, facts, conflicts, groups,
    benign: { sharedValueSubjects: [rec(sharedPair[0], 1), rec(sharedPair[1], 1)] },
  };
  return { world: CORE_TTL, episodes, oracle, questions: [] };
}

// ---------------------------------------------------------------------------
// h3 fixtures (v2-shaped oracle: the twin mechanism + non-key shared literals)
// ---------------------------------------------------------------------------

/** v2 conflicted fraction, kept for comparability with conflict-xr-small. */
const H3_DENSITY = 0.2;
/** Group sizes for the shared non-key literals (persons per shared value). */
const CITY_GROUPS = 6;
const TITLE_GROUPS = 5;
const BUILDING_GROUPS = 4;

export function generateH3Fixture(domain: string, variant: V3Variant, seed: number = SEED_V3): V3Fixture {
  const rand = mulberry32(seed);
  const P = variant.persons;
  const nk = variant.nonKeyLiterals!;

  const e01: EpisodeTriple[] = [];
  for (let i = 0; i < P; i++) {
    const r1 = rec(i, 1);
    e01.push({ s: r1, p: RDF_TYPE, o: PERSON_RECORD });
    e01.push({ s: r1, p: EMAIL, o: email(i), lit: true });
    // Non-key shared literals (session-1 records only): the H3 lever.
    e01.push({ s: r1, p: CITY, o: `City-${i % CITY_GROUPS}`, lit: true });
    if (nk >= 3) {
      e01.push({ s: r1, p: TITLE, o: `Title-${i % TITLE_GROUPS}`, lit: true });
      e01.push({ s: r1, p: BUILDING, o: `Building-${i % BUILDING_GROUPS}`, lit: true });
    }
    e01.push({ s: r1, p: OFFICE, o: office(i % OFFICES) });
    e01.push({ s: r1, p: REPORTS_TO, o: manager(i % MANAGERS) });
    e01.push({ s: r1, p: MEMBER_OF, o: team(i % TEAMS) });
  }

  const k = Math.round(H3_DENSITY * P);
  const order = shuffle(Array.from({ length: P }, (_, i) => i), rand);
  const conflicted = order.slice(0, k).sort((a, b) => a - b);
  const benign = order.slice(k, k + 3);
  const [shared1, shared2] = order.slice(k + 3, k + 5) as [number, number];

  const e02: EpisodeTriple[] = [];
  const conflicts: Array<{ id: string; about: string; predicate: string; values: string[]; episode: number }> = [];
  const coreference: Array<{ records: [string, string]; email: string; conflicted: boolean }> = [];
  const addSession2 = (i: number, officeIdx: number): void => {
    const r2 = rec(i, 2);
    e02.push({ s: r2, p: RDF_TYPE, o: PERSON_RECORD });
    e02.push({ s: r2, p: EMAIL, o: email(i), lit: true });
    e02.push({ s: r2, p: OFFICE, o: office(officeIdx) });
  };
  for (const i of conflicted) {
    const origIdx = i % OFFICES;
    const secondIdx = conflictingOfficeIdx(i);
    addSession2(i, secondIdx);
    coreference.push({ records: [rec(i, 1), rec(i, 2)], email: email(i), conflicted: true });
    for (const member of [rec(i, 1), rec(i, 2)]) {
      conflicts.push({
        id: `vc-${member.slice(BASE.length)}`, about: member, predicate: OFFICE,
        values: [office(origIdx), office(secondIdx)], episode: 2,
      });
    }
  }
  for (const i of benign) {
    addSession2(i, i % OFFICES);
    coreference.push({ records: [rec(i, 1), rec(i, 2)], email: email(i), conflicted: false });
  }

  const facts: OracleFactJson[] = [
    ...e01.map((t) => ({ ...t, episode: 1 })),
    ...e02.map((t) => ({ ...t, episode: 2 })),
  ];
  const oracle = {
    facts, conflicts, disjoint: [],
    coreference,
    benign: {
      benignCoreferences: benign.map((i) => [rec(i, 1), rec(i, 2)]),
      sharedOfficeSubjects: [rec(shared1, 1), rec(shared2, 1)],
    },
  };
  return { world: CORE_TTL + H3_TTL_EXTRA, episodes: [e01, e02], oracle, questions: [] };
}

// ---------------------------------------------------------------------------
// tausig fixture (v3 oracle: record-level valid-time and scope annotations)
// ---------------------------------------------------------------------------

const isoMonth = (k: number): string => `2026-${String(k + 1).padStart(2, '0')}-01`;
const SCOPES: [string, string] = ['hr-system', 'field-directory'];

export function generateTausigFixture(domain: string, variant: V3Variant, seed: number = SEED_V3): V3Fixture {
  const rand = mulberry32(seed);
  const P = variant.persons;
  const K = variant.conflicted!; // conflict count; same count for each tau/sigma benign kind

  const order = shuffle(Array.from({ length: P }, (_, i) => i), rand);
  const roleOf = new Map<number, V3Group['kind']>();
  order.slice(0, K).forEach((i) => roleOf.set(i, 'conflict'));
  order.slice(K, 2 * K).forEach((i) => roleOf.set(i, 'benign-temporal'));
  order.slice(2 * K, 3 * K).forEach((i) => roleOf.set(i, 'benign-scoped'));
  order.slice(3 * K).forEach((i) => roleOf.set(i, 'benign-coreference'));

  const e01: EpisodeTriple[] = [];
  const e02: EpisodeTriple[] = [];
  const facts: OracleFactJson[] = [];
  const push = (ep: 1 | 2, t: EpisodeTriple): void => {
    (ep === 1 ? e01 : e02).push(t);
    facts.push({ ...t, episode: ep });
  };

  const groups: V3Group[] = [];
  const conflicts: OracleV3['conflicts'] = [];
  for (let i = 0; i < P; i++) {
    const kind = roleOf.get(i)!;
    const [r1, r2] = [rec(i, 1), rec(i, 2)];
    const idx1 = i % OFFICES;
    const idx2 = kind === 'benign-coreference' ? idx1 : conflictingOfficeIdx(i);

    // Session-1 record: full. Session-2 record: sparse update (as in v2).
    push(1, { s: r1, p: RDF_TYPE, o: PERSON_RECORD });
    push(1, { s: r1, p: EMAIL, o: email(i), lit: true });
    push(1, { s: r1, p: OFFICE, o: office(idx1) });
    push(1, { s: r1, p: REPORTS_TO, o: manager(i % MANAGERS) });
    push(1, { s: r1, p: MEMBER_OF, o: team(i % TEAMS) });
    push(2, { s: r2, p: RDF_TYPE, o: PERSON_RECORD });
    push(2, { s: r2, p: EMAIL, o: email(i), lit: true });
    push(2, { s: r2, p: OFFICE, o: office(idx2) });

    // Record-level tau/sigma annotations, per registered design (A2.1.3).
    const annotations: Array<{ s: string; p: string; o: string }> = [];
    const annotate = (ep: 1 | 2, s: string, p: string, o: string): void => {
      push(ep, { s, p, o, lit: true });
      annotations.push({ s, p, o });
    };
    if (kind === 'conflict') {
      // Overlapping intervals: [j, j+6) and [j+3, j+9), j = i % 3.
      const j = i % 3;
      annotate(1, r1, VALID_FROM, isoMonth(j));
      annotate(1, r1, VALID_TO, isoMonth(j + 6));
      annotate(2, r2, VALID_FROM, isoMonth(j + 3));
      annotate(2, r2, VALID_TO, isoMonth(j + 9));
    } else if (kind === 'benign-temporal') {
      // Disjoint intervals: [j, j+2) then [j+4, j+8), j = i % 2.
      const j = i % 2;
      annotate(1, r1, VALID_FROM, isoMonth(j));
      annotate(1, r1, VALID_TO, isoMonth(j + 2));
      annotate(2, r2, VALID_FROM, isoMonth(j + 4));
      annotate(2, r2, VALID_TO, isoMonth(j + 8));
    } else if (kind === 'benign-scoped') {
      // No tau (unbounded); DIFFERENT scopes.
      annotate(1, r1, SOURCE_SCOPE, SCOPES[0]);
      annotate(2, r2, SOURCE_SCOPE, SCOPES[1]);
    } else {
      // benign-coreference: agreeing values; one bounded record, one open.
      const j = i % 4;
      annotate(1, r1, VALID_FROM, isoMonth(j));
      annotate(1, r1, VALID_TO, isoMonth(j + 3));
    }

    const witness = [
      { s: r1, p: RDF_TYPE, o: PERSON_RECORD },
      { s: r2, p: RDF_TYPE, o: PERSON_RECORD },
      { s: r1, p: EMAIL, o: email(i) },
      { s: r2, p: EMAIL, o: email(i) },
      { s: r1, p: OFFICE, o: office(idx1) },
      { s: r2, p: OFFICE, o: office(idx2) },
      ...annotations,
    ];
    groups.push({
      person: `p${pad(i)}`, kind, records: [r1, r2], keys: [email(i)],
      keyProp: EMAIL, predicate: OFFICE,
      values: idx1 === idx2 ? [office(idx1)] : [office(idx1), office(idx2)],
      witness,
    });
    if (kind === 'conflict') {
      for (const r of [r1, r2]) {
        conflicts.push({
          id: `vc-${r.slice(BASE.length)}`, about: r, predicate: OFFICE,
          values: [office(idx1), office(idx2)], episode: 2,
        });
      }
    }
  }

  const oracle: OracleV3 = { version: 3, chainLength: 1, facts, conflicts, groups };
  return { world: CORE_TTL + TAUSIG_TTL_EXTRA, episodes: [e01, e02], oracle, questions: [] };
}

// ---------------------------------------------------------------------------
// writer + CLI
// ---------------------------------------------------------------------------

export function generateV3Fixture(domain: string, variant: V3Variant, seed: number = SEED_V3): V3Fixture {
  if (variant.kind === 'chain') return generateChainFixture(domain, variant, seed);
  if (variant.kind === 'h3') return generateH3Fixture(domain, variant, seed);
  return generateTausigFixture(domain, variant, seed);
}

const toJsonl = (ts: EpisodeTriple[]): string => ts.map((t) => JSON.stringify(t)).join('\n') + '\n';

export function writeV3Fixture(dir: string, domain: string, variant: V3Variant, seed: number = SEED_V3): void {
  const fx = generateV3Fixture(domain, variant, seed);
  mkdirSync(join(dir, 'episodes'), { recursive: true });
  writeFileSync(join(dir, 'world.ttl'), fx.world);
  fx.episodes.forEach((ep, k) => {
    writeFileSync(join(dir, 'episodes', `e${String(k + 1).padStart(2, '0')}.jsonl`), toJsonl(ep));
  });
  writeFileSync(join(dir, 'oracle.json'), JSON.stringify(fx.oracle, null, 2) + '\n');
  writeFileSync(join(dir, 'questions.json'), JSON.stringify(fx.questions, null, 2) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ?? join(import.meta.dirname, '..', '..', 'fixtures');
  for (const [domain, variant] of Object.entries(V3_VARIANTS)) {
    writeV3Fixture(join(root, domain), domain, variant);
    console.log(`wrote ${join(root, domain)} (kind=${variant.kind}, persons=${variant.persons})`);
  }
}
