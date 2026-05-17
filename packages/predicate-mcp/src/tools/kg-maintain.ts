import { SparqlClient } from '../sparql/client.js';
import { escapeLiteral } from '../sparql/escape.js';
import {
  PromotionSweeper, type SweeperResult,
  Generalizer, type GeneralizerResult,
} from 'predicate-agent/src/index.js';
import { runFixpoint } from 'predicate-reasoner/src/fixpoint.js';
import { RULES } from 'predicate-reasoner/src/rules/index.js';

const META = 'https://predicate.dev/meta#';

export interface MaintainInput {
  archiveCutoff?: number;
  ageDays?: number;
  useThreshold?: number;
  generalizerK?: number;
}

export interface MaintainResult {
  archivedCount: number;
  elapsedMs: number;
  eventId: string;
  sweeper?: SweeperResult;
  generalizer?: GeneralizerResult;
  fixpoint?: { iterations: number; inferredCount: number };
  autoProposalsSkipped?: boolean;
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

  const generalizer = await new Generalizer(client, {
    k: input.generalizerK ?? 5,
  }).run();

  const sweeper = await new PromotionSweeper(client, {
    useThreshold: input.useThreshold ?? 3,
  }).run();

  const fixpoint = await runFixpoint(client, RULES, {
    tboxGraph: 'kg:tbox',
    aboxGraphs: ['kg:abox'],
    inferredGraph: 'kg:inferred',
    closureCutoff: 0.5,
  });

  const eventId = `urn:predicate:event:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const elapsedMs = Date.now() - t0;
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:meta> {
      <${eventId}> a pred:MaintenanceRun ;
        pred:at        "${new Date().toISOString()}"^^xsd:dateTime ;
        pred:actor     "kg_maintain" ;
        pred:payload   ${escapeLiteral(JSON.stringify({
          archivedCount, elapsedMs, archiveCutoff, ageDays,
          sweeperDecisions: sweeper.decisions.length,
          generalizerProposals: generalizer.proposals.length,
          fixpointIterations: fixpoint.iterations,
          fixpointInferred: fixpoint.inferredCount,
        }))} .
    } }
  `);

  return {
    archivedCount,
    elapsedMs,
    eventId,
    sweeper,
    generalizer,
    fixpoint,
    autoProposalsSkipped: generalizer.autoProposalsSkipped,
  };
}
