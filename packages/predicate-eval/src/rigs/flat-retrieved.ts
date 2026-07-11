import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadQuestions } from '../questions.js';
import { readEpisode, applyEpisodeTriples } from '../episode-runner.js';
import type { FlatTask } from './flat-baseline.js';

/**
 * The RETRIEVAL-MEDIATED flat arm: instead of the whole KB (flat-all), each
 * question's context is the k-hop neighbourhood around the entity the question
 * names (`retrieval_seeds`) — the arm a practitioner actually ships once the
 * store outgrows the context window (the repo's own SCALE-FINDINGS conclusion).
 *
 * Retrieval semantics (deliberately conventional, and load-bearing for the
 * benchmark's structural claim):
 *  - BFS over kg:abox treating triples as UNDIRECTED edges between IRI nodes.
 *  - LITERALS are attribute values, not traversable edges — retrieval cannot
 *    walk through a shared email string to a co-referent record.
 *  - rdf:type edges are not expanded (class nodes would act as hubs joining
 *    every instance); type triples still appear as attributes of ball members.
 *  - The context contains EVERY kg:abox triple whose subject is in the ball
 *    (attribute completeness), plus the full schema (world.ttl) — the same
 *    schema text every other arm sees.
 *
 * Questions without retrieval_seeds (global enumerations) get a schema-only
 * context: a retrieval-mediated memory has no entity handle to seed from,
 * which is itself one of the measured limitations.
 */

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const BATCH = 200;

export interface BallOptions { maxBallNodes?: number }

/** Undirected IRI-frontier BFS over kg:abox from the seeds; rdf:type not expanded. */
export async function ballFor(
  client: StorageAdapter, seeds: string[], hops: number, opts: BallOptions = {},
): Promise<Set<string>> {
  const cap = opts.maxBallNodes ?? 10_000;
  const ball = new Set<string>(seeds);
  let frontier = seeds.slice();
  for (let h = 0; h < hops && frontier.length > 0 && ball.size < cap; h++) {
    const next = new Set<string>();
    for (let i = 0; i < frontier.length; i += BATCH) {
      const values = frontier.slice(i, i + BATCH).map((n) => `<${n}>`).join(' ');
      const r = await client.select(`
        SELECT DISTINCT ?n WHERE {
          GRAPH <kg:abox> {
            { VALUES ?f { ${values} } ?f ?p ?n . FILTER (?p != <${RDF_TYPE}>) }
            UNION
            { VALUES ?f { ${values} } ?n ?p ?f . FILTER (?p != <${RDF_TYPE}>) }
          }
          FILTER (isIRI(?n))
        }
      `);
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
  return ball;
}

/** N-Triples of every kg:abox triple whose SUBJECT is a ball member. */
export async function ballContext(client: StorageAdapter, ball: Set<string>): Promise<string> {
  const nodes = [...ball];
  const lines: string[] = [];
  for (let i = 0; i < nodes.length; i += BATCH) {
    const values = nodes.slice(i, i + BATCH).map((n) => `<${n}>`).join(' ');
    const r = await client.select(`
      SELECT ?s ?p ?o WHERE { GRAPH <kg:abox> { VALUES ?s { ${values} } ?s ?p ?o } }
    `);
    for (const b of r.results.bindings) {
      const o = b.o!;
      const oStr = o.type === 'uri' ? `<${o.value}>` : JSON.stringify(o.value);
      lines.push(`<${b.s!.value}> <${b.p!.value}> ${oStr} .`);
    }
  }
  return lines.sort().join('\n');
}

function episodePaths(dir: string): string[] {
  return readdirSync(join(dir, 'episodes'))
    .filter((f) => f.endsWith('.jsonl')).sort()
    .map((f) => join(dir, 'episodes', f));
}

/** Replay episodes, then emit one retrieval-scoped task per question. */
export async function buildRetrievedTasks(
  client: StorageAdapter, domain: string, dir: string, episodes: number, hops: number,
): Promise<FlatTask[]> {
  const questions = loadQuestions(dir);
  const schema = readFileSync(join(dir, 'world.ttl'), 'utf8');
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  const paths = episodePaths(dir);
  for (let i = 0; i < Math.min(episodes, paths.length); i++) {
    await applyEpisodeTriples(client, readEpisode(paths[i]!));
  }
  const tasks: FlatTask[] = [];
  for (const q of questions) {
    let facts: string;
    if (q.retrieval_seeds?.length) {
      const ball = await ballFor(client, q.retrieval_seeds, hops);
      facts = await ballContext(client, ball);
    } else {
      facts = '# (no entity handle to retrieve from — this question has no seeds;\n'
        + '#  answer from the schema and general reasoning only)';
    }
    tasks.push({
      id: q.id,
      domain,
      questionText: q.text,
      type: q.type,
      context: `# Ontology (TBox)\n${schema}\n\n# Retrieved facts (k-hop neighbourhood of the question's entities)\n${facts}`,
    });
  }
  return tasks;
}
