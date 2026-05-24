import type { EpisodeTriple } from '../episode-runner.js';
import type { GenQuestion } from './generate-org.js';

const C = 'https://industriagents.com/predicate/codebase#';
const BASE = 'https://industriagents.com/predicate/codebase/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const DEP = `${C}dependsOn`;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fileIri = (i: number): string => `${BASE}f${i}.ts`;

export interface HistResult {
  files: number;
  sessions: number;
  triples: EpisodeTriple[];          // structural deps (signal) + accumulated session noise
  signalTriples: number;             // dependsOn + type edges (constant across sessions)
  questions: GenQuestion[];          // transitive-dependency questions on the fixed DAG
}

export interface HistOpts {
  files: number;
  depsPerFile?: number;     // direct deps each file declares on lower-indexed files
  sessions: number;         // simulated capture sessions (each adds noise)
  editsPerSession?: number; // file-modified events per session (noise)
  cmdsPerSession?: number;  // command events per session (noise)
  questions?: number;
  seed?: number;
}

/**
 * A single developer's repo whose CAPTURED HISTORY grows while the codebase stays
 * fixed. The dependency DAG (the signal that answers "what does X depend on") is
 * constant; each session piles on edit/command events (the noise a real agent
 * captures). This is the faithful single-user scaling axis: facts grow, entities don't.
 */
export function generateCodebaseHistory(opts: HistOpts): HistResult {
  const files = opts.files;
  const depsPerFile = opts.depsPerFile ?? 2;
  const editsPerSession = opts.editsPerSession ?? 6;
  const cmdsPerSession = opts.cmdsPerSession ?? 4;
  const nQ = opts.questions ?? 12;
  const rand = mulberry32(opts.seed ?? 1);

  // --- Signal: fixed dependency DAG (fi depends on a few lower-indexed files) ---
  const deps: number[][] = Array.from({ length: files }, () => []);
  const triples: EpisodeTriple[] = [];
  for (let i = 0; i < files; i++) {
    triples.push({ s: fileIri(i), p: RDF_TYPE, o: `${C}File` });
    const k = Math.min(depsPerFile, i);
    const chosen = new Set<number>();
    while (chosen.size < k) chosen.add(Math.floor(rand() * i));
    for (const j of chosen) {
      deps[i]!.push(j);
      triples.push({ s: fileIri(i), p: DEP, o: fileIri(j) });
    }
  }
  const signalTriples = triples.length;

  // transitive closure of deps (the ground-truth answer, fixed across sessions)
  function closure(i: number): Set<string> {
    const out = new Set<string>(); const stack = [...deps[i]!];
    while (stack.length) {
      const j = stack.pop()!;
      if (!out.has(fileIri(j))) { out.add(fileIri(j)); stack.push(...deps[j]!); }
    }
    return out;
  }

  // --- Questions: transitive deps of files with a non-trivial closure ---
  // Generated BEFORE the noise loop so they depend only on the fixed DAG (and are
  // therefore identical for a given files+seed regardless of how many sessions we add).
  const questions: GenQuestion[] = [];
  let attempts = 0;
  while (questions.length < nQ && attempts < nQ * 20) {
    attempts++;
    const x = Math.floor(rand() * files);
    const c = closure(x);
    if (c.size < 2) continue;
    questions.push({
      id: `dep-${x}`,
      text: `What does f${x}.ts depend on (transitively)?`,
      type: 'set',
      expected: { kind: 'set', values: [...c] },
      goldenSparql:
        `SELECT ?d WHERE { { GRAPH <kg:abox> { <${fileIri(x)}> <${DEP}> ?d } } ` +
        `UNION { GRAPH <kg:inferred> { <${fileIri(x)}> <${DEP}> ?d } } }`,
    });
  }

  // --- Noise: per-session edit + command events (grow with `sessions`) ---
  for (let s = 1; s <= opts.sessions; s++) {
    const session = `${BASE}session${s}`;
    for (let e = 0; e < editsPerSession; e++) {
      triples.push({ s: fileIri(Math.floor(rand() * files)), p: `${C}modifiedIn`, o: session });
    }
    for (let c = 0; c < cmdsPerSession; c++) {
      triples.push({ s: `${BASE}cmd-s${s}-${c}`, p: `${C}ranIn`, o: session });
    }
  }

  return { files, sessions: opts.sessions, triples, signalTriples, questions };
}
