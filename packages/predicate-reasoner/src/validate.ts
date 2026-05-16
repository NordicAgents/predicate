import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import type {
  ValidateInput, ValidationResult,
} from './types.js';
import { runShacl } from './shacl.js';
import { FusekiConstructAdapter } from './index.js';

async function fetchTurtle(client: SparqlClient, graph: string): Promise<string> {
  const r = await client.select(`
    SELECT ?s ?p ?o WHERE { GRAPH <${graph}> { ?s ?p ?o } } LIMIT 100000
  `);
  // Serialize as N-Triples (handles all term kinds).
  return r.results.bindings.map((b) => {
    const s = b.s!.type === 'uri' ? `<${b.s!.value}>` : `_:${b.s!.value}`;
    const p = `<${b.p!.value}>`;
    const o =
      b.o!.type === 'uri'
        ? `<${b.o!.value}>`
        : b.o!.type === 'bnode'
          ? `_:${b.o!.value}`
          : `"${b.o!.value.replace(/"/g, '\\"')}"`;
    return `${s} ${p} ${o} .`;
  }).join('\n');
}

export async function runValidation(
  client: SparqlClient,
  input: ValidateInput,
): Promise<ValidationResult> {
  const sandboxInferred = `kg:inferred-validate-${Date.now()}`;
  const adapter = new FusekiConstructAdapter(client);

  // Build a temporary TBox view = tbox ∪ staging
  const tboxView = `kg:tbox-view-${Date.now()}`;
  await client.update(`CREATE SILENT GRAPH <${tboxView}>`);
  await client.update(`COPY SILENT GRAPH <${input.tboxGraph}>   TO GRAPH <${tboxView}>`);
  await client.update(`ADD SILENT GRAPH  <${input.stagingGraph}> TO GRAPH <${tboxView}>`);

  try {
    const m = await adapter.materialize({
      tboxGraph: tboxView,
      aboxGraphs: [input.aboxSample],
      targetGraph: sandboxInferred,
      closureCutoff: 0.5,
    });

    const unsatisfiable = await unsatisfiableClasses(client, tboxView, sandboxInferred);

    const dataTtl   = await fetchTurtle(client, input.aboxSample) + '\n' +
                      await fetchTurtle(client, sandboxInferred);
    const shapesTtl = await fetchTurtle(client, tboxView);
    const shacl     = await runShacl(dataTtl, shapesTtl);

    const impactedTriples = m.inferredCount;
    const impactedQ = await client.select(`
      SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:usage> { ?q ?p ?o } }
    `);
    const impactedQueries = parseInt(impactedQ.results.bindings[0]!.n!.value, 10);

    return {
      ok: m.inconsistencies.length === 0 && unsatisfiable.length === 0 && shacl.ok,
      unsatisfiableClasses: unsatisfiable,
      shaclViolations: shacl.violations,
      impactedTriples,
      impactedQueries,
    };
  } finally {
    await client.update(`DROP SILENT GRAPH <${sandboxInferred}>`);
    await client.update(`DROP SILENT GRAPH <${tboxView}>`);
  }
}

async function unsatisfiableClasses(
  client: SparqlClient,
  tboxView: string,
  inferred: string,
): Promise<string[]> {
  // An unsatisfiable class C has both (C rdfs:subClassOf A) and (C rdfs:subClassOf B)
  // with (A owl:disjointWith B) anywhere in the closure.
  // We also treat C=A as satisfying "C subClassOf A" (OWL reflexive subClassOf).
  const r = await client.select(`
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT DISTINCT ?C WHERE {
      {
        # Pattern 1: C is subClassOf both A and B (explicit subClassOf triples)
        { GRAPH <${tboxView}> { ?A owl:disjointWith ?B } }
        {
          { GRAPH <${tboxView}> { ?C rdfs:subClassOf ?A } }
          UNION
          { GRAPH <${inferred}> { ?C rdfs:subClassOf ?A } }
        }
        {
          { GRAPH <${tboxView}> { ?C rdfs:subClassOf ?B } }
          UNION
          { GRAPH <${inferred}> { ?C rdfs:subClassOf ?B } }
        }
        FILTER (?A != ?B)
      }
      UNION
      {
        # Pattern 2: C itself is declared disjoint with D,
        # and C rdfs:subClassOf D (C=A in the disjoint pair, subClassOf makes it unsatisfiable)
        { GRAPH <${tboxView}> { ?C owl:disjointWith ?D } }
        {
          { GRAPH <${tboxView}> { ?C rdfs:subClassOf ?D } }
          UNION
          { GRAPH <${inferred}> { ?C rdfs:subClassOf ?D } }
        }
        FILTER (?C != ?D)
      }
      UNION
      {
        # Pattern 3: C is disjoint with D (D declared disjoint with C),
        # and C rdfs:subClassOf D
        { GRAPH <${tboxView}> { ?D owl:disjointWith ?C } }
        {
          { GRAPH <${tboxView}> { ?C rdfs:subClassOf ?D } }
          UNION
          { GRAPH <${inferred}> { ?C rdfs:subClassOf ?D } }
        }
        FILTER (?C != ?D)
      }
    }
  `);
  return r.results.bindings.map((b) => b.C!.value);
}
