import type { EpisodeTriple } from '../episode-runner.js';

const ORG = 'http://ex/org#';
const BASE = 'http://ex/org/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

export type GenAnswer = { kind: 'set'; values: string[] } | { kind: 'boolean'; value: boolean };

export interface GenQuestion {
  id: string;
  text: string;
  type: 'set' | 'boolean';
  expected: GenAnswer;
  goldenSparql: string; // reads the reasoner-materialized closure in kg:inferred (+ abox base)
}

export interface GenResult {
  people: number;
  triples: EpisodeTriple[];
  questions: GenQuestion[];
}

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

const iri = (i: number): string => `${BASE}p${i}`;
const parentOf = (i: number, branching: number): number => Math.floor((i - 1) / branching);

/** Ancestors of person i walking up reportsTo to the root (exclusive of i). */
function ancestors(i: number, branching: number): string[] {
  const out: string[] = [];
  let cur = i;
  while (cur > 0) { cur = parentOf(cur, branching); out.push(iri(cur)); }
  return out;
}

export interface GenOpts {
  people: number;       // total nodes in the reporting tree (p0 is the root CEO)
  branching?: number;   // direct reports per manager (controls depth)
  teams?: number;       // memberOf teams, round-robin
  questions?: number;   // number of "management chain" set-questions
  seed?: number;
}

/**
 * Build a balanced reporting tree of `people` nodes (bounded depth via `branching`,
 * so transitive closure stays near-linear, not the pathological O(n^2) of a single
 * chain). Returns the ABox triples, plus templated questions with answer keys
 * computed directly from the tree and golden SPARQL that reads the materialized
 * closure (kg:inferred) — i.e. it tests the reasoner, not a SPARQL property path.
 */
export function generateOrg(opts: GenOpts): GenResult {
  const people = opts.people;
  const branching = opts.branching ?? 4;
  const teams = opts.teams ?? 8;
  const nQ = opts.questions ?? 12;
  const rand = mulberry32(opts.seed ?? 1);

  const triples: EpisodeTriple[] = [];
  for (let i = 0; i < people; i++) {
    triples.push({ s: iri(i), p: RDF_TYPE, o: `${ORG}Person` });
    if (i > 0) triples.push({ s: iri(i), p: `${ORG}reportsTo`, o: iri(parentOf(i, branching)) });
    triples.push({ s: iri(i), p: `${ORG}memberOf`, o: `${BASE}team${i % teams}` });
  }

  const questions: GenQuestion[] = [];
  for (let q = 0; q < nQ; q++) {
    // Prefer deeper people (larger index) so chains are non-trivial.
    const x = 1 + Math.floor(rand() * (people - 1));
    const chain = ancestors(x, branching);
    questions.push({
      id: `gen-chain-${q}`,
      text: `Who is in p${x}'s management chain (transitively)?`,
      type: 'set',
      expected: { kind: 'set', values: chain },
      goldenSparql:
        `SELECT ?a WHERE { { GRAPH <kg:abox> { <${iri(x)}> <${ORG}reportsTo> ?a } } ` +
        `UNION { GRAPH <kg:inferred> { <${iri(x)}> <${ORG}reportsTo> ?a } } }`,
    });
  }
  return { people, triples, questions };
}
