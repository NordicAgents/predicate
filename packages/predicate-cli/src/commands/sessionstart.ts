import { getAdapter } from 'predicate-mcp/src/storage/index.js';

const META = 'https://predicate.dev/meta#';
const OWL = 'http://www.w3.org/2002/07/owl#';

export async function sessionstart(): Promise<number> {
  const client = getAdapter();

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
    const priorSessionsRes = await client.select(
      `PREFIX pred: <${META}>
       SELECT (COUNT(DISTINCT ?s) AS ?n) WHERE {
         GRAPH <kg:abox> { ?s a pred:Session }
       }`,
    );
    const ontologyRes = await client.select(
      `PREFIX pred: <${META}>
       SELECT ?o WHERE { GRAPH <kg:meta> { <urn:predicate:config> pred:initOntology ?o } }`,
    ).catch(() => ({ results: { bindings: [] as Array<{ o?: { value: string } }> } }));
    const goals = goalsRes.results.bindings[0]?.n?.value ?? '0';
    const classes = classesRes.results.bindings[0]?.n?.value ?? '0';
    const priorSessions = priorSessionsRes.results.bindings[0]?.n?.value ?? '0';
    const ontology = ontologyRes.results.bindings[0]?.o?.value ?? '';
    const sessionHint = priorSessions !== '0'
      ? ` ${priorSessions} prior session(s) in kg:abox — query for past file changes / command outcomes if relevant.`
      : '';
    const ontologyHint = ontology ? ` (${ontology} ontology)` : '';
    console.log(
      `Predicate ready: ${goals} active goals, ${classes} TBox classes${ontologyHint}.${sessionHint} Use kg_explore_schema before drafting SPARQL.`,
    );
    return 0;
  } catch {
    console.log(
      `Predicate: Fuseki not reachable; KG tools may fail. Start it with \`predicate up\`.`,
    );
    return 0;
  }
}
