import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { researchGoal } from '../src/research-goal.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const client = new SparqlClient(loadConfig());

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function loadTbox(file: string): Promise<void> {
  const ttl = readFileSync(resolve(import.meta.dirname, '../../', file), 'utf8');
  const cfg = loadConfig();
  const auth = 'Basic ' + Buffer.from(
    `${process.env.PREDICATE_ADMIN_USER ?? 'admin'}:${process.env.PREDICATE_ADMIN_PASSWORD ?? 'changeme'}`,
  ).toString('base64');
  await fetch(`${cfg.dataEndpoint}?graph=kg:tbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle', Authorization: auth },
    body: ttl,
  });
}

beforeAll(async () => {
  await reset('kg:tbox');
  await loadTbox('predicate-ontology/tbox/codebase.ttl');
  await loadTbox('predicate-ontology/meta/predicate-meta.ttl');
});

beforeEach(async () => {
  for (const g of ['kg:goals', 'kg:meta']) await reset(g);
});

describe('researchGoal', () => {
  it('creates a goal, decomposes it, returns sub-questions + gaps', async () => {
    const plan = await researchGoal(client, {
      goal: 'why did login break',
      source: 'user',
    });
    expect(plan.goalId).toMatch(/^urn:predicate:goal:/);
    expect(plan.subQuestions.length).toBeGreaterThan(0);
    expect(plan.gaps).toHaveLength(plan.subQuestions.length);
    expect(plan.gaps.every((g) => g.answerable)).toBe(true);
  });

  it('reports gaps when the TBox is missing a required predicate', async () => {
    await client.update(`
      PREFIX c: <https://predicate.dev/codebase#>
      DELETE { GRAPH <kg:tbox> { c:calls ?p ?o } }
      INSERT { GRAPH <kg:meta> { <urn:test:saved> ?p ?o } }
      WHERE  { GRAPH <kg:tbox> { c:calls ?p ?o } }
    `);
    const plan = await researchGoal(client, {
      goal: 'what calls validateToken',
      source: 'user',
    });
    expect(plan.gaps[0]!.answerable).toBe(false);
    expect(plan.gaps[0]!.missingPredicates[0]!.iri)
      .toBe('https://predicate.dev/codebase#calls');
    // Restore so later tests pass.
    await reset('kg:tbox');
    await loadTbox('predicate-ontology/tbox/codebase.ttl');
    await loadTbox('predicate-ontology/meta/predicate-meta.ttl');
  });

  it('the created goal exists in kg:goals with GoalCreated in kg:meta', async () => {
    const plan = await researchGoal(client, { goal: 'why did x break', source: 'user' });
    const ok = await client.ask(`
      PREFIX pred: <https://predicate.dev/meta#>
      ASK { GRAPH <kg:goals> { <${plan.goalId}> a pred:Goal } }
    `);
    expect(ok).toBe(true);
    const evt = await client.ask(`
      PREFIX pred: <https://predicate.dev/meta#>
      ASK { GRAPH <kg:meta> { ?e a pred:GoalCreated ; pred:goal <${plan.goalId}> } }
    `);
    expect(evt).toBe(true);
  });
});
