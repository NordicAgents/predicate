import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter, materializeScoped } from '../src/index.js';

const client = getAdapter();
const adapter = new FusekiConstructAdapter(client);
const J = 'https://industriagents.com/predicate/judgment#';
const T = 'kg:tbox-test-scoped';
const A = 'kg:abox-test-scoped';
const I_FULL = 'kg:inferred-test-scoped-full';
const I_BALL = 'kg:inferred-test-scoped-ball';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function withProv(graph: string, s: string, p: string, o: string, conf = 1): Promise<void> {
  await client.update(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH <${graph}>      { ${s} ${p} ${o} . }
      GRAPH <kg:provenance> { << ${s} ${p} ${o} >> pred:confidence "${conf}"^^xsd:decimal . }
    }
  `);
}

/** lee: disjoint-class clash (via a subclass hop) + a j:SingleValued double value. */
async function seedLeeCluster(graph: string): Promise<void> {
  await withProv(graph, '<https://ex/lee>', 'a', '<https://ex/Engineer>');
  await withProv(graph, '<https://ex/lee>', 'a', '<https://ex/Contractor>');
  await withProv(graph, '<https://ex/lee>', '<https://ex/reportsTo>', '<https://ex/omar>');
  await withProv(graph, '<https://ex/lee>', '<https://ex/reportsTo>', '<https://ex/nadia>');
}

async function seedNoise(graph: string, n: number): Promise<void> {
  // Disconnected chains, far from lee's cluster; no provenance needed — they
  // only exist to bulk up the abox the BFS must ignore.
  const triples: string[] = [];
  for (let i = 0; i < n; i++) {
    triples.push(`<https://ex/noise${i}> <https://ex/knows> <https://ex/noise${i + 1}> .`);
    if (triples.length === 500) {
      await client.update(`INSERT DATA { GRAPH <${graph}> { ${triples.join('\n')} } }`);
      triples.length = 0;
    }
  }
  if (triples.length > 0) {
    await client.update(`INSERT DATA { GRAPH <${graph}> { ${triples.join('\n')} } }`);
  }
}

const askConflicts = async (g: string): Promise<{ disjoint: boolean; value: boolean }> => ({
  disjoint: await client.ask(`
    PREFIX j: <${J}>
    ASK { GRAPH <${g}> {
      <https://ex/lee> a j:DisjointClassConflict ;
        j:conflictingType <https://ex/Contractor> , <https://ex/Employee> .
    } }
  `),
  value: await client.ask(`
    PREFIX j: <${J}>
    ASK { GRAPH <${g}> { <https://ex/lee> a j:ValueConflict ; j:conflictOn <https://ex/reportsTo> } }
  `),
});

beforeAll(async () => {
  await reset(T);
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX j:    <${J}>
    INSERT DATA { GRAPH <${T}> {
      ex:Engineer   rdfs:subClassOf ex:Employee .
      ex:Contractor owl:disjointWith ex:Employee .
      ex:reportsTo  a j:SingleValued .
      ex:partOf     a owl:TransitiveProperty .
    } }
  `);
});
beforeEach(async () => {
  await reset(A);
  await reset(I_FULL);
  await reset(I_BALL);
});

describe('materializeScoped — neighbourhood-scoped materialization', () => {
  it('parity on conflicts: hops=1 around the conflicted subject flags exactly what a full run flags', async () => {
    await seedLeeCluster(A);
    await seedNoise(A, 10);

    await adapter.materialize({
      tboxGraph: T, aboxGraphs: [A], targetGraph: I_FULL, closureCutoff: 0.5,
    });
    const r = await materializeScoped(client, {
      seeds: ['https://ex/lee'], hops: 1,
      tboxGraph: T, aboxGraphs: [A], targetGraph: I_BALL, closureCutoff: 0.5,
    });

    const full = await askConflicts(I_FULL);
    const ball = await askConflicts(I_BALL);
    expect(full).toEqual({ disjoint: true, value: true });
    expect(ball).toEqual(full);
    expect(r.truncated).toBe(false);
    // The ball is lee + its direct neighbours — the 10 noise entities stay out.
    expect(r.ballNodes).toBeLessThanOrEqual(6);
    expect(r.ballTriples).toBe(4);
    // Leave-in-place contract: after the run the scratch graph still holds the
    // ball facts (callers query scratch UNION target); a future fixpoint change
    // must not start dropping it.
    const scratchIntact = await client.ask(`
      ASK { GRAPH <${I_BALL}-scope> { <https://ex/lee> ?p ?o } }
    `);
    expect(scratchIntact).toBe(true);
  });

  it('multi-batch BFS: a 450-neighbour frontier (batch size 200 → 3 batches) collects every node exactly once', async () => {
    const AB = 'kg:abox-test-scoped-batch';
    await reset(AB);
    const lines: string[] = [];
    for (let i = 0; i < 450; i++) {
      lines.push(`<https://ex/bigHub> <https://ex/spoke> <https://ex/bleaf${i}> .`);
    }
    await client.update(`INSERT DATA { GRAPH <${AB}> { ${lines.join('\n      ')} } }`);
    const r = await materializeScoped(client, {
      seeds: ['https://ex/bigHub'], hops: 1,
      tboxGraph: T, aboxGraphs: [AB], targetGraph: I_BALL, closureCutoff: 0.5,
    });
    expect(r.truncated).toBe(false);
    expect(r.ballNodes).toBe(451); // hub + 450 leaves, no dupes, no omissions
    expect(r.ballTriples).toBe(450);
  });

  it('recall cliff: a transitive conclusion whose premises lie beyond the radius is MISSED at hops=1 and found at hops=3', async () => {
    await withProv(A, '<https://ex/s1>', '<https://ex/partOf>', '<https://ex/pa>');
    await withProv(A, '<https://ex/pa>', '<https://ex/partOf>', '<https://ex/pb>');
    await withProv(A, '<https://ex/pb>', '<https://ex/partOf>', '<https://ex/pc>');
    const reached = (): Promise<boolean> => client.ask(`
      ASK { GRAPH <${I_BALL}> { <https://ex/s1> <https://ex/partOf> <https://ex/pc> } }
    `);

    await materializeScoped(client, {
      seeds: ['https://ex/s1'], hops: 1,
      tboxGraph: T, aboxGraphs: [A], targetGraph: I_BALL, closureCutoff: 0.5,
    });
    expect(await reached()).toBe(false);

    await materializeScoped(client, {
      seeds: ['https://ex/s1'], hops: 3,
      tboxGraph: T, aboxGraphs: [A], targetGraph: I_BALL, closureCutoff: 0.5,
    });
    expect(await reached()).toBe(true);
  });

  it('constant cost: the same neighbourhood yields an identical ball whether embedded in 200 or 2000 noise triples', async () => {
    const A200 = 'kg:abox-test-scoped-n200';
    const A2000 = 'kg:abox-test-scoped-n2000';
    await reset(A200);
    await reset(A2000);
    await seedLeeCluster(A200);
    await seedNoise(A200, 200);
    await seedLeeCluster(A2000);
    await seedNoise(A2000, 2000);

    const run = (abox: string): Promise<Awaited<ReturnType<typeof materializeScoped>>> =>
      materializeScoped(client, {
        seeds: ['https://ex/lee'], hops: 1,
        tboxGraph: T, aboxGraphs: [abox], targetGraph: I_BALL, closureCutoff: 0.5,
      });
    const small = await run(A200);
    const large = await run(A2000);

    expect(large.ballNodes).toBe(small.ballNodes);
    expect(large.ballTriples).toBe(small.ballTriples);
    expect(large.inferredCount).toBe(small.inferredCount);
    // Reasoning cost tracks the (identical) ball, not total abox size. Timing
    // is reported rather than tightly asserted — CI variance — but a 10x noise
    // increase must not blow reasoning up by orders of magnitude.
    expect(large.reasoningMs).toBeLessThan(Math.max(2000, small.reasoningMs * 20));
  });

  it('truncation: maxBallNodes=3 on a star graph sets truncated=true without throwing', async () => {
    for (let i = 0; i < 6; i++) {
      await client.update(`
        INSERT DATA { GRAPH <${A}> { <https://ex/hub> <https://ex/spoke> <https://ex/leaf${i}> . } }
      `);
    }
    const r = await materializeScoped(client, {
      seeds: ['https://ex/hub'], hops: 1, maxBallNodes: 3,
      tboxGraph: T, aboxGraphs: [A], targetGraph: I_BALL, closureCutoff: 0.5,
    });
    expect(r.truncated).toBe(true);
    expect(r.ballNodes).toBeLessThanOrEqual(3);
  });
});
