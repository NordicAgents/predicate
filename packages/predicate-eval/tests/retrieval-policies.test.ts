import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import {
  bm25Ball, deriveInstances, evaluateInstance, iriBfsBall, keyAwareBall, keyProperties,
  literalAwareBall, loadDomainForRetrieval, type InstanceRecord,
} from '../src/rigs/retrieval-policies.js';

/**
 * Regression-lock for the retrieval-policy mechanism claim (publication plan
 * §8, fatal objection 2): the conflict is invisible to non-type IRI
 * BFS at practitioner hop counts, becomes visible the moment retrieval can
 * cross the shared key literal (key-aware OR schema-free literal-aware), and
 * This BFS only "recovers" at hops=4 by degenerating into the whole store.
 */

const client = getAdapter();
const DOMAIN = 'conflict-xr-small';
const DIR = join(import.meta.dirname, '..', 'fixtures', DOMAIN);

let keyProps: string[] = [];
let instances: InstanceRecord[] = [];
let conflicts: InstanceRecord[] = [];

beforeAll(async () => {
  await loadDomainForRetrieval(client, DIR);
  keyProps = await keyProperties(client);
  instances = deriveInstances(DOMAIN, DIR);
  conflicts = instances.filter((i) => i.isConflict);
}, 120_000);

async function witnessCompleteCount(
  policy: 'iri-bfs' | 'literal-aware' | 'key-aware', hops: number,
): Promise<number> {
  let flagged = 0;
  for (const inst of conflicts) {
    const row = await evaluateInstance(client, policy, hops, inst, { keyProps });
    if (row.flagged) flagged++;
  }
  return flagged;
}

describe('retrieval policies — conflict-xr-small mechanism lock', () => {
  it('derives the contract instances from oracle.json', () => {
    expect(instances.length).toBe(16);
    expect(conflicts.length).toBe(12);
    expect(instances.filter((i) => i.kind === 'benign-coreference').length).toBe(3);
    expect(instances.filter((i) => i.kind === 'benign-shared-value').length).toBe(1);

    const p002 = instances.find((i) => i.id === `${DOMAIN}#pair-p002`)!;
    expect(p002.subjects).toEqual(['http://ex/cb2/s1-p002', 'http://ex/cb2/s2-p002']);
    expect(p002.key).toBe('p002@ex.com');
    expect(p002.predicate).toBe('http://ex/cb2#office');
    expect(new Set(p002.goldValues)).toEqual(
      new Set(['http://ex/cb2/office2', 'http://ex/cb2/office0']),
    );
    // v2 conflict witness = the 6 minimal source triples (types, emails, values).
    expect(p002.goldWitness.length).toBe(6);
    expect(p002.goldWitness).toContain(
      'http://ex/cb2/s1-p002|http://ex/cb2#office|http://ex/cb2/office2',
    );
    expect(p002.goldWitness).toContain(
      'http://ex/cb2/s2-p002|http://ex/cb2#email|p002@ex.com',
    );

    expect(keyProps).toEqual(['http://ex/cb2#email']);
  });

  it('iri-bfs at hops<=2 is witness-complete on 0/12 conflicts (the structural miss)', async () => {
    expect(await witnessCompleteCount('iri-bfs', 1)).toBe(0);
    expect(await witnessCompleteCount('iri-bfs', 2)).toBe(0);
  }, 120_000);

  it('key-aware@1 and literal-aware@1 are witness-complete on 12/12 conflicts', async () => {
    expect(await witnessCompleteCount('key-aware', 1)).toBe(12);
    expect(await witnessCompleteCount('literal-aware', 1)).toBe(12);
  }, 120_000);

  it('BM25 retrieves direct co-key twins without schema knowledge at a finite top-k', async () => {
    for (const inst of conflicts) {
      for (const seed of inst.subjects) {
        const result = await bm25Ball(client, [seed], 16);
        expect(result.ball.has(inst.subjects.find((s) => s !== seed)!)).toBe(true);
      }
      const row = await evaluateInstance(client, 'bm25', 16, inst, { keyProps });
      expect(row.flagged, inst.id).toBe(true);
    }
  }, 120_000);

  it('literal-aware and key-aware balls are IDENTICAL here (email is the only shared literal) — the ball-size cost of schema-free literal joins is exactly 0 in this fixture', async () => {
    // Structural verification of the premise: no literal value is shared
    // between two subjects on any predicate pair other than (email, email).
    const r = await client.select(`
      SELECT DISTINCT ?p1 ?p2 WHERE {
        GRAPH <kg:abox> {
          ?a ?p1 ?lit . ?b ?p2 ?lit .
          FILTER (isLiteral(?lit)) FILTER (?a != ?b)
        }
      }
    `);
    const pairs = r.results.bindings.map((b) => `${b.p1!.value}|${b.p2!.value}`);
    expect(pairs).toEqual(['http://ex/cb2#email|http://ex/cb2#email']);

    // Per-seed precision: for every conflict seed at hops=1, literal ball ==
    // key ball, and both are the iri-bfs ball plus EXACTLY the twin record.
    let litNodes = 0; let keyNodes = 0; let iriNodes = 0;
    for (const inst of conflicts) {
      for (const seed of inst.subjects) {
        const lit = await literalAwareBall(client, [seed], 1);
        const key = await keyAwareBall(client, [seed], 1, { keyProps });
        const iri = await iriBfsBall(client, [seed], 1);
        expect([...lit.ball].sort()).toEqual([...key.ball].sort());
        expect(key.ball.size - iri.ball.size).toBe(1);
        const twin = inst.subjects.find((s) => s !== seed)!;
        expect(key.ball.has(twin)).toBe(true);
        expect(iri.ball.has(twin)).toBe(false);
        litNodes += lit.ball.size; keyNodes += key.ball.size; iriNodes += iri.ball.size;
      }
    }
    // Measured cost (24 conflict seeds): literal == key exactly; +1 node per
    // seed over the control. Locked so a fixture or policy drift is loud.
    expect(litNodes).toBe(keyNodes);
    expect(litNodes - iriNodes).toBe(24);
    expect(keyNodes).toBe(96); // mean 4.0 nodes/seed (s1 seeds: 5, s2 seeds: 3)
  }, 240_000);

  it('iri-bfs@4 only recovers by swallowing the whole store (ball = all 92 IRI nodes, context = all 345 abox triples)', async () => {
    // Seeded on the dense s1 record, hops=4 IS the whole store (92/92 nodes);
    // seeded on the sparse s2 record it reaches 78/92 — still enough to cross
    // office-hub paths into the twin, so 12/12 flip to witness-complete.
    const fromS1 = await iriBfsBall(client, ['http://ex/cb2/s1-p002'], 4);
    expect(fromS1.ball.size).toBe(92);
    const fromS2 = await iriBfsBall(client, ['http://ex/cb2/s2-p002'], 4);
    expect(fromS2.ball.size).toBe(78);
    expect(fromS2.ball.has('http://ex/cb2/s1-p002')).toBe(true);

    const nodes = await client.select(`
      SELECT (COUNT(DISTINCT ?n) AS ?c) WHERE {
        {
          SELECT ?n WHERE { GRAPH <kg:abox> { ?n ?p ?o } }
        } UNION {
          SELECT ?n WHERE {
            GRAPH <kg:abox> { ?s ?p ?n }
            FILTER (isIRI(?n))
            FILTER (?p != <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>)
          }
        }
      }
    `);
    expect(Number(nodes.results.bindings[0]!.c!.value)).toBe(92);

    const triples = await client.select(
      'SELECT (COUNT(*) AS ?c) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }',
    );
    expect(Number(triples.results.bindings[0]!.c!.value)).toBe(345);

    const row = await evaluateInstance(
      client, 'iri-bfs', 4,
      conflicts.find((i) => i.id === `${DOMAIN}#pair-p002`)!, { keyProps },
    );
    expect(row.flagged).toBe(true);
    expect(row.extra.contextTriples).toBe(345);
  }, 120_000);
});
