import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { decideCounterfactual, ShadowEvaluator } from '../src/shadow-evaluator.js';

describe('decideCounterfactual', () => {
  it('promotes when useCount >= N regardless of age', () => {
    expect(decideCounterfactual({ useCount: 5, ageInStagingDays: 1, n: 3, ttlDays: 7 })).toBe('promote');
  });
  it('expires when past TTL and under N', () => {
    expect(decideCounterfactual({ useCount: 1, ageInStagingDays: 8, n: 3, ttlDays: 7 })).toBe('expire');
  });
  it('waits when under N and within TTL', () => {
    expect(decideCounterfactual({ useCount: 1, ageInStagingDays: 2, n: 3, ttlDays: 7 })).toBe('wait');
  });
});

const client = getAdapter();
const META = 'https://industriagents.com/predicate/meta#';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

describe('ShadowEvaluator', () => {
  beforeEach(async () => {
    for (const g of ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:goals']) await reset(g);
  });

  it('emits a GateShadow event per staging proposal, moving nothing', async () => {
    await client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:goals> { <urn:goal:1> pred:source "inferred" . }
        GRAPH <kg:tbox-staging> {
          <urn:prop:1> a pred:Proposal ;
            pred:kind "add-class" ;
            pred:justification "j" ;
            pred:proposedAt "2026-05-20T00:00:00Z"^^xsd:dateTime ;
            pred:expiresAt  "2026-05-27T00:00:00Z"^^xsd:dateTime ;
            pred:motivatingGoal <urn:goal:1> .
        }
      }`);

    const evaluator = new ShadowEvaluator(client);
    const n = await evaluator.run({ tier: 'Seedling' });
    expect(n).toBe(1);

    const ev = await client.select(`
      PREFIX pred: <${META}>
      SELECT ?payload WHERE { GRAPH <kg:meta> { ?e a pred:GateShadow ; pred:payload ?payload } }`);
    expect(ev.results.bindings.length).toBe(1);
    const rec = JSON.parse(ev.results.bindings[0]!['payload']!.value);
    expect(rec.goalSource).toBe('inferred');
    expect(rec.counterfactual.length).toBe(9);
    const staging = await client.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:tbox-staging> { ?s ?p ?o } }`);
    expect(parseInt(staging.results.bindings[0]!['n']!.value, 10)).toBeGreaterThan(0);
  });

  it('emits goalSource "explicit" for a proposal with no motivatingGoal', async () => {
    await client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:tbox-staging> {
          <urn:prop:nogoal> a pred:Proposal ;
            pred:kind "add-class" ;
            pred:justification "j" ;
            pred:proposedAt "2026-05-20T00:00:00Z"^^xsd:dateTime ;
            pred:expiresAt  "2026-05-27T00:00:00Z"^^xsd:dateTime .
        }
      }`);

    const evaluator = new ShadowEvaluator(client);
    const n = await evaluator.run({ tier: 'Seedling' });
    expect(n).toBe(1);

    const ev = await client.select(`
      PREFIX pred: <${META}>
      SELECT ?payload WHERE { GRAPH <kg:meta> { ?e a pred:GateShadow ; pred:payload ?payload } }`);
    expect(ev.results.bindings.length).toBe(1);
    const rec = JSON.parse(ev.results.bindings[0]!['payload']!.value);
    expect(rec.goalSource).toBe('explicit');
  });

  it('emits goalSource "explicit" when motivatingGoal has source "user"', async () => {
    await client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:goals> { <urn:goal:user> pred:source "user" . }
        GRAPH <kg:tbox-staging> {
          <urn:prop:usergoal> a pred:Proposal ;
            pred:kind "add-class" ;
            pred:justification "j" ;
            pred:proposedAt "2026-05-20T00:00:00Z"^^xsd:dateTime ;
            pred:expiresAt  "2026-05-27T00:00:00Z"^^xsd:dateTime ;
            pred:motivatingGoal <urn:goal:user> .
        }
      }`);

    const evaluator = new ShadowEvaluator(client);
    const n = await evaluator.run({ tier: 'Seedling' });
    expect(n).toBe(1);

    const ev = await client.select(`
      PREFIX pred: <${META}>
      SELECT ?payload WHERE { GRAPH <kg:meta> { ?e a pred:GateShadow ; pred:payload ?payload } }`);
    expect(ev.results.bindings.length).toBe(1);
    const rec = JSON.parse(ev.results.bindings[0]!['payload']!.value);
    expect(rec.goalSource).toBe('explicit');
  });
});
