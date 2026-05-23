import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import type { Boundedness } from './eval-types.js';

export async function countTriples(client: StorageAdapter, graph: string): Promise<number> {
  const r = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${graph}> { ?s ?p ?o } }`);
  return Number(r.results.bindings[0]?.n?.value ?? 0);
}

/** Fraction of declared TBox classes+properties never referenced by a logged usage query. */
export async function unusedConceptRatio(client: StorageAdapter): Promise<number> {
  const total = await client.select(`
    SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { GRAPH <kg:tbox> {
      ?c a ?t .
      FILTER(?t IN (
        <http://www.w3.org/2002/07/owl#Class>,
        <http://www.w3.org/2002/07/owl#ObjectProperty>,
        <http://www.w3.org/2002/07/owl#DatatypeProperty>)) } }`);
  const totalN = Number(total.results.bindings[0]?.n?.value ?? 0);
  if (totalN === 0) return 0;
  const used = await client.select(`
    SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
      GRAPH <kg:tbox> {
        ?c a ?t .
        FILTER(?t IN (
          <http://www.w3.org/2002/07/owl#Class>,
          <http://www.w3.org/2002/07/owl#ObjectProperty>,
          <http://www.w3.org/2002/07/owl#DatatypeProperty>)) }
      GRAPH <kg:usage> { ?u ?up ?sparql . FILTER(isLiteral(?sparql) && CONTAINS(STR(?sparql), STR(?c))) } }`);
  const usedN = Number(used.results.bindings[0]?.n?.value ?? 0);
  return (totalN - usedN) / totalN;
}

export async function collectMetrics(
  client: StorageAdapter, materializeMs: number,
): Promise<Boundedness> {
  return {
    triples: await countTriples(client, 'kg:abox'),
    inferred: await countTriples(client, 'kg:inferred'),
    unusedConceptRatio: await unusedConceptRatio(client),
    materializeMs,
  };
}
