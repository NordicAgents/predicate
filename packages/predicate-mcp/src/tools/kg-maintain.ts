import { SparqlClient } from '../sparql/client.js';
import { escapeLiteral } from '../sparql/escape.js';

const META = 'https://predicate.dev/meta#';

export interface MaintainInput {
  archiveCutoff?: number;   // default 0.6
  ageDays?: number;         // default 30
}

export interface MaintainResult {
  archivedCount: number;
  elapsedMs: number;
  eventId: string;
}

export async function kgMaintain(
  client: SparqlClient,
  input: MaintainInput = {},
): Promise<MaintainResult> {
  const archiveCutoff = input.archiveCutoff ?? 0.6;
  const ageDays = input.ageDays ?? 30;
  const cutoffDate = new Date(Date.now() - ageDays * 86400_000).toISOString();
  const t0 = Date.now();

  await client.update(`CREATE SILENT GRAPH <kg:abox-archive>`);

  const before = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }`,
  );
  const beforeCount = parseInt(before.results.bindings[0]!.n!.value, 10);

  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    DELETE { GRAPH <kg:abox> { ?s ?p ?o } }
    INSERT { GRAPH <kg:abox-archive> { ?s ?p ?o } }
    WHERE {
      GRAPH <kg:abox> { ?s ?p ?o }
      GRAPH <kg:provenance> {
        << ?s ?p ?o >> pred:confidence ?conf ;
                       pred:timestamp  ?ts .
        FILTER (?conf < ${archiveCutoff})
        FILTER (?ts < "${cutoffDate}"^^xsd:dateTime)
      }
    }
  `);

  const after = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }`,
  );
  const afterCount = parseInt(after.results.bindings[0]!.n!.value, 10);
  const archivedCount = beforeCount - afterCount;

  const eventId = `urn:predicate:event:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const elapsedMs = Date.now() - t0;
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:meta> {
      <${eventId}> a pred:MaintenanceRun ;
        pred:at        "${new Date().toISOString()}"^^xsd:dateTime ;
        pred:actor     "kg_maintain" ;
        pred:payload   ${escapeLiteral(JSON.stringify({ archivedCount, elapsedMs, archiveCutoff, ageDays }))} .
    } }
  `);

  return { archivedCount, elapsedMs, eventId };
}
