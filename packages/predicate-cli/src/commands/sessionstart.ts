import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

const META = 'https://predicate.dev/meta#';
const OWL = 'http://www.w3.org/2002/07/owl#';

export async function sessionstart(): Promise<number> {
  const cfg = loadConfig();
  const client = new SparqlClient(cfg);

  try {
    const goalsRes = await client.select(
      `PREFIX pred: <${META}>
       SELECT (COUNT(*) AS ?n) WHERE {
         GRAPH <kg:goals> { ?g pred:status "active" }
       }`,
    );
    const classesRes = await client.select(
      `PREFIX owl: <${OWL}>
       SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
         GRAPH <kg:tbox> { ?c a owl:Class }
       }`,
    );
    const goals = goalsRes.results.bindings[0]?.n?.value ?? '0';
    const classes = classesRes.results.bindings[0]?.n?.value ?? '0';
    console.log(
      `Predicate ready: ${goals} active goals, ${classes} TBox classes. Use kg_explore_schema before drafting SPARQL.`,
    );
    return 0;
  } catch {
    console.log(
      `Predicate: Fuseki not reachable; KG tools may fail. Start it with \`predicate up\`.`,
    );
    return 0;
  }
}
