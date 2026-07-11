import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EpisodeTriple } from '../episode-runner.js';
import type { Question } from '../eval-types.js';

/**
 * CONFLICT-BENCH generator — a deterministic, density-controlled contradiction
 * benchmark. Conflict density d is the independent variable: episode 2 plants a
 * second, different value on a j:SingleValued property for round(d * PEOPLE)
 * subjects, plus a false-positive slice that must NOT be flagged. Fixtures are
 * generated once by this script and COMMITTED under fixtures/conflict-d{05,20,50};
 * tests read the committed files and never regenerate.
 *
 * Determinism: everything flows from a fixed SEED through mulberry32 — no
 * Date.now(), no unseeded Math.random(). The SAME seed is used for every
 * density so the planted subject sets are nested (d05 ⊂ d20 ⊂ d50) and density
 * is the ONLY variable that changes across fixtures.
 */

const CB = 'http://ex/cb#';
const BASE = 'http://ex/cb/';
const J = 'https://industriagents.com/predicate/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const PEOPLE = 40;
const MANAGERS = 5;
const OFFICES = 4;
const TEAMS = 6;

/** Fixed generator seed — exported so the determinism test reproduces the committed bytes. */
export const SEED = 0xc0ffee;

/** domain name -> conflict density (fraction of subjects planted with a contradiction). */
export const DENSITIES: Record<string, number> = {
  'conflict-d05': 0.05,
  'conflict-d20': 0.2,
  'conflict-d50': 0.5,
};

/** Deterministic 32-bit PRNG so a seed fully reproduces a fixture. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher–Yates shuffle (returns a new array). */
function shuffle<T>(xs: T[], rand: () => number): T[] {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const person = (i: number): string => `${BASE}p${String(i).padStart(2, '0')}`;
const pname = (i: number): string => `p${String(i).padStart(2, '0')}`;
const manager = (i: number): string => `${BASE}m${i}`;
const office = (i: number): string => `${BASE}office${i}`;
const team = (i: number): string => `${BASE}team${i}`;

// The two SINGLE-VALUED properties under test (r22) and the two multi-valued distractors.
const REPORTS_TO = `${CB}reportsTo`;
const OFFICE = `${CB}office`;
const MEMBER_OF = `${CB}memberOf`;
const COLLABORATES = `${CB}collaboratesWith`;

// The single-valued/multi-valued semantics below are stated in rdfs:comment IN
// THE SCHEMA ITSELF. buildFlatTasks embeds this raw world.ttl into the flat
// baseline's context, so the flat (in-context) arm sees exactly the same
// schema knowledge the reasoner does — the benchmark is SCHEMA-SYMMETRIC BY
// CONSTRUCTION. This is deliberate and load-bearing: any detection gap
// measured against the flat arm is attributable to mechanized reasoning, not
// to the reasoner having been told which properties are single-valued.
const WORLD_TTL = `@prefix cb:   <${CB}> .
@prefix j:    <${J}> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cb:Person a owl:Class .
cb:Office a owl:Class .
cb:Team   a owl:Class .

cb:reportsTo a owl:ObjectProperty, j:SingleValued ;
  rdfs:domain cb:Person ; rdfs:range cb:Person ;
  rdfs:comment "single-valued: a person has exactly one manager (reportsTo); two different values indicate a data conflict" .

cb:office a owl:ObjectProperty, j:SingleValued ;
  rdfs:domain cb:Person ; rdfs:range cb:Office ;
  rdfs:comment "single-valued: a person has exactly one office; two different values indicate a data conflict" .

cb:memberOf a owl:ObjectProperty ;
  rdfs:domain cb:Person ; rdfs:range cb:Team ;
  rdfs:comment "multi-valued: a person may belong to any number of teams; multiple values are normal, not a conflict" .

cb:collaboratesWith a owl:ObjectProperty ;
  rdfs:domain cb:Person ; rdfs:range cb:Person ;
  rdfs:comment "multi-valued: a person may collaborate with any number of people; multiple values are normal, not a conflict" .
`;

interface OracleFactJson { s: string; p: string; o: string; episode: number }
interface OracleConflictJson {
  id: string; about: string; predicate: string; values: string[]; episode: number;
}

export interface ConflictFixture {
  world: string;
  episode1: EpisodeTriple[];
  episode2: EpisodeTriple[];
  oracle: {
    facts: OracleFactJson[];
    conflicts: OracleConflictJson[];
    disjoint: Array<{ classes: string[] }>;
    // Documentation of the false-positive slice: assertions in episode 2 that
    // superficially resemble contradictions but must NOT produce j:ValueConflict.
    benign: {
      duplicateReassertions: EpisodeTriple[];
      multiValuedAdditions: EpisodeTriple[];
      sharedObjectSubjects: EpisodeTriple[];
    };
  };
  questions: Question[];
}

const flagAsk = (s: string): string =>
  `ASK { GRAPH <kg:inferred> { <${s}> <${RDF_TYPE}> <${J}ValueConflict> } }`;

export function generateConflictFixture(domain: string, density: number, seed: number = SEED): ConflictFixture {
  const rand = mulberry32(seed);

  // Episode 1 — base facts: exactly one value per single-valued property per
  // person, plus one multi-valued memberOf. 3 * PEOPLE = 120 base facts.
  const e01: EpisodeTriple[] = [];
  for (let i = 0; i < PEOPLE; i++) {
    e01.push({ s: person(i), p: REPORTS_TO, o: manager(i % MANAGERS) });
    e01.push({ s: person(i), p: OFFICE, o: office(i % OFFICES) });
    e01.push({ s: person(i), p: MEMBER_OF, o: team(i % TEAMS) });
  }

  // Seeded subject roles. Planted subjects get a contradiction; the next four
  // form the false-positive slice; the next three are clean recall controls.
  const k = Math.round(density * PEOPLE);
  const order = shuffle(Array.from({ length: PEOPLE }, (_, i) => i), rand);
  const planted = order.slice(0, k).sort((a, b) => a - b);
  const [dupA, dupB, memA, colA] = order.slice(k, k + 4) as [number, number, number, number];
  const [clean1, clean2, clean3] = order.slice(k + 4, k + 7) as [number, number, number];

  // Episode 2 — the contradictions: a SECOND, different value on one
  // single-valued property per planted subject (alternating property).
  const e02: EpisodeTriple[] = [];
  const conflicts: OracleConflictJson[] = [];
  planted.forEach((i, idx) => {
    const onReportsTo = idx % 2 === 0;
    const p = onReportsTo ? REPORTS_TO : OFFICE;
    const orig = onReportsTo ? manager(i % MANAGERS) : office(i % OFFICES);
    const second = onReportsTo ? manager((i + 1) % MANAGERS) : office((i + 1) % OFFICES);
    e02.push({ s: person(i), p, o: second });
    conflicts.push({
      id: `vc-${pname(i)}`, about: person(i), predicate: p, values: [orig, second], episode: 2,
    });
  });

  // False-positive slice (must NOT be flagged):
  // (a) exact re-assertions of episode-1 triples — RDF graphs are sets, so no second value exists;
  const duplicateReassertions: EpisodeTriple[] = [
    { s: person(dupA), p: OFFICE, o: office(dupA % OFFICES) },
    { s: person(dupB), p: REPORTS_TO, o: manager(dupB % MANAGERS) },
  ];
  // (b) additional values on MULTI-valued properties — plural values are normal there;
  const multiValuedAdditions: EpisodeTriple[] = [
    { s: person(memA), p: MEMBER_OF, o: team((memA + 1) % TEAMS) },
    { s: person(colA), p: COLLABORATES, o: person((colA + 1) % PEOPLE) },
    { s: person(colA), p: COLLABORATES, o: person((colA + 2) % PEOPLE) },
  ];
  // (c) DISTINCT subjects sharing the same object value — conflicts are per-subject.
  const sharedObjectSubjects: EpisodeTriple[] = [
    { s: `${BASE}x0`, p: REPORTS_TO, o: manager(0) },
    { s: `${BASE}x1`, p: REPORTS_TO, o: manager(0) },
  ];
  e02.push(...duplicateReassertions, ...multiValuedAdditions, ...sharedObjectSubjects);

  // Oracle facts: every assertion tagged with the episode it becomes true.
  // Exact duplicates are excluded (they were already true at episode 1) and
  // documented under `benign` instead.
  const facts: OracleFactJson[] = [
    ...e01.map((t) => ({ ...t, episode: 1 })),
    ...e02
      .filter((t) => !duplicateReassertions.some((d) => d.s === t.s && d.p === t.p && d.o === t.o))
      .map((t) => ({ ...t, episode: 2 })),
  ];

  // Questions. Planted subjects >= 2 at every density (d05 -> 2), so the two
  // planted boolean probes below always exist; planted[0] conflicts on
  // reportsTo and planted[1] on office by the alternation above.
  const qid = (n: number): string => `${domain}-q${String(n).padStart(2, '0')}`;
  const questions: Question[] = [
    {
      id: qid(1),
      text: 'Which people have conflicting values on a single-valued property (reportsTo or office)?',
      type: 'conflict',
      key: { derive: 'all-conflict-subjects' },
      needs_episode: 2,
      rule_under_test: ['r22'],
      reasoning_dependent: true,
      golden_sparql:
        `SELECT ?x WHERE { GRAPH <kg:inferred> { ?x <${RDF_TYPE}> <${J}ValueConflict> } }`,
    },
    {
      id: qid(2),
      text: `Does ${pname(planted[0]!)} have two conflicting values for reportsTo (single-valued)?`,
      type: 'boolean',
      key: { derive: 'literal-boolean', since: 2 },
      needs_episode: 2,
      rule_under_test: ['r22'],
      reasoning_dependent: true,
      golden_sparql: flagAsk(person(planted[0]!)),
    },
    {
      id: qid(3),
      text: `Does ${pname(planted[1]!)} have two conflicting values for office (single-valued)?`,
      type: 'boolean',
      key: { derive: 'literal-boolean', since: 2 },
      needs_episode: 2,
      rule_under_test: ['r22'],
      reasoning_dependent: true,
      golden_sparql: flagAsk(person(planted[1]!)),
    },
    {
      // False-positive probe: a second value arrived, but on MULTI-valued
      // memberOf. boolean-conflict over the oracle stays false forever (no
      // conflict record exists for this subject). The question text must NOT
      // explain why — that would leak the expected answer to a flat/prompted
      // arm; the single- vs multi-valued semantics live in world.ttl's schema
      // comments, which every arm sees (schema symmetry).
      id: qid(4),
      text: `Does ${pname(memA)} have conflicting values on a single-valued property?`,
      type: 'boolean',
      key: { derive: 'boolean-conflict', about: person(memA) },
      needs_episode: 2,
      rule_under_test: ['r22'],
      reasoning_dependent: false,
      golden_sparql: flagAsk(person(memA)),
    },
    {
      // False-positive probe: an exact duplicate re-assertion is not a second
      // value. Text stays explanation-free — see q04's leak note.
      id: qid(5),
      text: `Does ${pname(dupA)} have conflicting values on a single-valued property?`,
      type: 'boolean',
      key: { derive: 'boolean-conflict', about: person(dupA) },
      needs_episode: 2,
      rule_under_test: ['r22'],
      reasoning_dependent: false,
      golden_sparql: flagAsk(person(dupA)),
    },
    {
      id: qid(6),
      text: `Which office is ${pname(clean1)} in (direct recall, no reasoning)?`,
      type: 'set',
      key: { derive: 'direct', rel: OFFICE, from: person(clean1) },
      needs_episode: 1,
      rule_under_test: [],
      reasoning_dependent: false,
      golden_sparql: `SELECT ?o WHERE { GRAPH <kg:abox> { <${person(clean1)}> <${OFFICE}> ?o } }`,
    },
    {
      id: qid(7),
      text: `Who does ${pname(clean2)} report to (direct recall, no reasoning)?`,
      type: 'set',
      key: { derive: 'direct', rel: REPORTS_TO, from: person(clean2) },
      needs_episode: 1,
      rule_under_test: [],
      reasoning_dependent: false,
      golden_sparql: `SELECT ?m WHERE { GRAPH <kg:abox> { <${person(clean2)}> <${REPORTS_TO}> ?m } }`,
    },
    {
      id: qid(8),
      text: `Which teams is ${pname(clean3)} a member of (direct recall, no reasoning)?`,
      type: 'set',
      key: { derive: 'direct', rel: MEMBER_OF, from: person(clean3) },
      needs_episode: 1,
      rule_under_test: [],
      reasoning_dependent: false,
      golden_sparql: `SELECT ?t WHERE { GRAPH <kg:abox> { <${person(clean3)}> <${MEMBER_OF}> ?t } }`,
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
      benign: { duplicateReassertions, multiValuedAdditions, sharedObjectSubjects },
    },
    questions,
  };
}

const toJsonl = (ts: EpisodeTriple[]): string => ts.map((t) => JSON.stringify(t)).join('\n') + '\n';

/** Write one density's fixture directory (world.ttl, episodes/, oracle.json, questions.json). */
export function writeConflictFixture(dir: string, domain: string, density: number, seed: number = SEED): void {
  const fx = generateConflictFixture(domain, density, seed);
  mkdirSync(join(dir, 'episodes'), { recursive: true });
  writeFileSync(join(dir, 'world.ttl'), fx.world);
  writeFileSync(join(dir, 'episodes', 'e01.jsonl'), toJsonl(fx.episode1));
  writeFileSync(join(dir, 'episodes', 'e02.jsonl'), toJsonl(fx.episode2));
  writeFileSync(join(dir, 'oracle.json'), JSON.stringify(fx.oracle, null, 2) + '\n');
  writeFileSync(join(dir, 'questions.json'), JSON.stringify(fx.questions, null, 2) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ?? join(import.meta.dirname, '..', '..', 'fixtures');
  for (const [domain, density] of Object.entries(DENSITIES)) {
    writeConflictFixture(join(root, domain), domain, density);
    console.log(`wrote ${join(root, domain)} (density=${density})`);
  }
}
