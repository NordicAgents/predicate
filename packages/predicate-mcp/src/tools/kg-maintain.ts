import type { StorageAdapter } from '../storage/index.js';
import { escapeLiteral } from '../sparql/escape.js';
import {
  PromotionSweeper, type SweeperResult,
  Generalizer, type GeneralizerResult,
  LifecycleController,
} from 'predicate-agent/src/index.js';
import { runFixpoint } from 'predicate-reasoner/src/fixpoint.js';
import { RULES } from 'predicate-reasoner/src/rules/index.js';
import { clearAboxDirty } from '../materialize.js';
import { kgConfigGet } from './kg-config.js';

const META = 'https://industriagents.com/predicate/meta#';

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
  tier: 'Seedling' | 'Active';
  skipped: boolean;
}

export async function kgMaintain(
  client: StorageAdapter,
  input: MaintainInput = {},
): Promise<MaintainResult> {
  const archiveCutoff = input.archiveCutoff ?? 0.6;
  const ageDays = input.ageDays ?? 30;
  const cutoffDate = new Date(Date.now() - ageDays * 86400_000).toISOString();
  const t0 = Date.now();

  const cfg = await kgConfigGet(client, { key: 'scale-gate-triples' });
  const scaleGateTriples = typeof cfg.value === 'number' ? cfg.value : undefined;
  const controller = new LifecycleController(client, { scaleGateTriples });
  const signal = await controller.scaleSignal();

  if (signal.tier === 'Seedling') {
    const skipId = `urn:predicate:event:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA { GRAPH <kg:meta> {
        <${skipId}> a pred:MaintenanceSkipped ;
          pred:at      "${new Date().toISOString()}"^^xsd:dateTime ;
          pred:actor   "kg_maintain" ;
          pred:payload ${escapeLiteral(JSON.stringify({
            reason: 'below-scale-gate',
            tier: signal.tier,
            tripleCount: signal.tripleCount,
            threshold: signal.threshold,
          }))} .
      } }
    `);
    const sweeper = await new PromotionSweeper(client, {
      useThreshold: input.useThreshold ?? 3,
    }).run();
    return {
      archivedCount: 0,
      elapsedMs: Date.now() - t0,
      eventId: skipId,
      tier: signal.tier,
      skipped: true,
      sweeper,
    };
  }

  await client.update(`CREATE SILENT GRAPH <kg:abox-archive>`);

  const before = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }`,
  );
  const beforeCount = parseInt(before.results.bindings[0]!.n!.value, 10);

  await controller.move({
    fromGraph: 'kg:abox',
    toGraph: 'kg:abox-archive',
    selector: {
      kind: 'where',
      whereClause: `
        GRAPH <kg:abox> { ?s ?p ?o }
        GRAPH <kg:provenance> {
          << ?s ?p ?o >> pred:confidence ?conf ;
                         pred:timestamp  ?ts .
          FILTER (?conf < ${archiveCutoff})
          FILTER (?ts < "${cutoffDate}"^^xsd:dateTime)
        }`,
    },
    eventType: 'MaintenanceArchive',
    goalIri: 'urn:predicate:maintenance',
    payload: { archiveCutoff, ageDays },
  });

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

  const tFix = Date.now();
  const fixpoint = await runFixpoint(client, RULES, {
    tboxGraph: 'kg:tbox',
    aboxGraphs: ['kg:abox'],
    inferredGraph: 'kg:inferred',
    closureCutoff: 0.5,
  });
  const fixpointMs = Date.now() - tFix;

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

  const matEventId = `urn:predicate:event:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:meta> {
      <${matEventId}> a pred:MaterializationCompleted ;
        pred:at      "${new Date().toISOString()}"^^xsd:dateTime ;
        pred:actor   "kg_maintain" ;
        pred:payload ${escapeLiteral(JSON.stringify({
          elapsedMs: fixpointMs,
          iterations: fixpoint.iterations,
          inferredCount: fixpoint.inferredCount,
        }))} .
    } }
  `);

  await clearAboxDirty(client);

  return {
    archivedCount,
    elapsedMs,
    eventId,
    sweeper,
    generalizer,
    fixpoint,
    autoProposalsSkipped: generalizer.autoProposalsSkipped,
    tier: signal.tier,
    skipped: false,
  };
}
