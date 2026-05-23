import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import type { CounterfactualCell, GateShadowRecord, ScaleTier } from './types.js';

const META = 'https://industriagents.com/predicate/meta#';

export interface CounterfactualInput {
  useCount: number;
  ageInStagingDays: number;
  n: number;
  ttlDays: number;
}

/** Mirror of PromotionSweeper.decide gate logic, as a pure function. */
export function decideCounterfactual(
  i: CounterfactualInput,
): 'promote' | 'wait' | 'expire' {
  if (i.useCount >= i.n) return 'promote';
  if (i.ageInStagingDays > i.ttlDays) return 'expire';
  return 'wait';
}

export const USAGE_GRID_N = [2, 3, 5];
export const USAGE_GRID_TTL = [3, 7, 14];

export function counterfactualGrid(
  useCount: number,
  ageInStagingDays: number,
): CounterfactualCell[] {
  const cells: CounterfactualCell[] = [];
  for (const n of USAGE_GRID_N) {
    for (const ttlDays of USAGE_GRID_TTL) {
      cells.push({ n, ttlDays, decision: decideCounterfactual({ useCount, ageInStagingDays, n, ttlDays }) });
    }
  }
  return cells;
}

export class ShadowEvaluator {
  constructor(private client: StorageAdapter) {}

  async run(opts: { tier: ScaleTier }): Promise<number> {
    const proposals = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?id ?proposedAt ?expiresAt ?goal WHERE {
        GRAPH <kg:tbox-staging> {
          ?id a pred:Proposal ;
              pred:proposedAt ?proposedAt ;
              pred:expiresAt  ?expiresAt .
          OPTIONAL { ?id pred:motivatingGoal ?goal }
        }
      }
    `);
    const now = Date.now();
    let count = 0;
    for (const b of proposals.results.bindings) {
      const id = b['id']!.value;
      const proposedAt = b['proposedAt']!.value;
      const ageInStagingDays = (now - new Date(proposedAt).getTime()) / 86400_000;
      const useCount = await this.countUses(id);
      const goalSource = await this.goalSource(b['goal']?.value);
      const grid = counterfactualGrid(useCount, ageInStagingDays);
      const live = decideCounterfactual({ useCount, ageInStagingDays, n: 3, ttlDays: 7 });
      const record: GateShadowRecord = {
        proposalId: id,
        passTimestamp: new Date().toISOString(),
        tier: opts.tier,
        goalSource,
        liveDecision: live,
        currentUseCount: useCount,
        ageInStagingDays: Math.round(ageInStagingDays * 100) / 100,
        counterfactual: grid,
      };
      await this.emit(id, record);
      count++;
    }
    return count;
  }

  private async goalSource(goalIri?: string): Promise<'explicit' | 'inferred'> {
    if (!goalIri) return 'explicit';
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?src WHERE { GRAPH <kg:goals> { ${escapeIRI(goalIri)} pred:source ?src } }
    `);
    return r.results.bindings[0]?.['src']?.value === 'inferred' ? 'inferred' : 'explicit';
  }

  private async countUses(proposalId: string): Promise<number> {
    const subjects = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT DISTINCT ?s WHERE {
        GRAPH <kg:tbox-staging> { << ?s ?p ?o >> pred:proposalId ${escapeIRI(proposalId)} . }
      }
    `);
    const iris = subjects.results.bindings.map((b) => b['s']!.value);
    if (iris.length === 0) return 0;
    const filters = iris.map((iri) => `CONTAINS(?sparql, "${iri}")`).join(' || ');
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT (COUNT(*) AS ?n) WHERE {
        GRAPH <kg:usage> { ?q a pred:Query ; pred:sparql ?sparql . FILTER (${filters}) }
      }
    `);
    return parseInt(r.results.bindings[0]!['n']!.value, 10);
  }

  private async emit(proposalId: string, record: GateShadowRecord): Promise<void> {
    const eventId = `urn:predicate:event:gate-shadow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA { GRAPH <kg:meta> {
        ${escapeIRI(eventId)} a pred:GateShadow ;
          pred:at      "${record.passTimestamp}"^^xsd:dateTime ;
          pred:actor   "ShadowEvaluator" ;
          pred:goal    ${escapeIRI(proposalId)} ;
          pred:payload ${escapeLiteral(JSON.stringify(record))} .
      } }
    `);
  }
}
