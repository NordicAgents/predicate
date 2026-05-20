import type { StorageAdapter } from '../storage/index.js';
import type { KgStats } from 'predicate-agent/src/index.js';

async function countGraph(client: StorageAdapter, graph: string): Promise<number> {
  const r = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${graph}> { ?s ?p ?o } }`,
  );
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

async function countClasses(client: StorageAdapter): Promise<number> {
  const r = await client.select(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
      GRAPH <kg:tbox> { ?c a owl:Class }
    }
  `);
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

async function unusedConceptRatio(
  client: StorageAdapter, classCount: number,
): Promise<number> {
  if (classCount === 0) return 0;
  const r = await client.select(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
      GRAPH <kg:tbox> { ?c a owl:Class }
      FILTER NOT EXISTS {
        { GRAPH <kg:abox>     { ?x rdf:type ?c } }
        UNION
        { GRAPH <kg:inferred> { ?x rdf:type ?c } }
      }
    }
  `);
  const unused = parseInt(r.results.bindings[0]!.n!.value, 10);
  return unused / classCount;
}

async function materializationLatencyP95(client: StorageAdapter): Promise<number> {
  // Select payload strings and parse elapsedMs in JS to avoid heavy SPARQL regex escaping
  const r = await client.select(`
    PREFIX pred: <https://predicate.dev/meta#>
    SELECT ?payload WHERE {
      GRAPH <kg:meta> {
        ?e a pred:MaterializationCompleted ;
           pred:payload ?payload .
      }
    }
  `);
  const values = r.results.bindings
    .map((b) => {
      const raw = b.payload?.value ?? '';
      const m = raw.match(/"elapsedMs"\s*:\s*(\d+)/);
      return m ? parseInt(m[1]!, 10) : 0;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const idx = Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1);
  return values[Math.max(idx, 0)]!;
}

export async function kgStats(client: StorageAdapter): Promise<KgStats> {
  const [abox, inferred, tbox] = await Promise.all([
    countGraph(client, 'kg:abox'),
    countGraph(client, 'kg:inferred'),
    countGraph(client, 'kg:tbox'),
  ]);
  const classes = await countClasses(client);
  const triples = abox + inferred + tbox;
  const denom = abox + inferred;
  const inferredRatio = denom === 0 ? 0 : inferred / denom;
  const unused = await unusedConceptRatio(client, classes);
  const p95 = await materializationLatencyP95(client);
  return {
    triples,
    abox,
    inferred,
    tbox,
    classes,
    inferredRatio,
    unusedConceptRatio: unused,
    materializationLatencyMsP95: p95,
  };
}
