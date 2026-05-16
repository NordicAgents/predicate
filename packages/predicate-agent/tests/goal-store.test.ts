import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { GoalStore } from '../src/goal-store.js';

const client = new SparqlClient(loadConfig());
const store = new GoalStore(client);

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:goals', 'kg:meta']) await reset(g);
});

afterAll(async () => {
  for (const g of ['kg:goals', 'kg:meta']) await reset(g);
});

describe('GoalStore', () => {
  it('creates a goal and emits a GoalCreated event', async () => {
    const g = await store.create({
      statement: 'why did login break',
      source: 'user',
    });
    expect(g.status).toBe('active');
    expect(g.id).toMatch(/^urn:predicate:goal:/);

    const readBack = await store.get(g.id);
    expect(readBack?.statement).toBe('why did login break');

    const events = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?e WHERE { GRAPH <kg:meta> { ?e a pred:GoalCreated } }
    `);
    expect(events.results.bindings).toHaveLength(1);
  });

  it('transitions status active → dormant → done and emits one event per change', async () => {
    const g = await store.create({ statement: 'q', source: 'user' });
    await store.setStatus(g.id, 'dormant');
    await store.setStatus(g.id, 'done');

    const final = await store.get(g.id);
    expect(final?.status).toBe('done');

    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:meta> { ?e a pred:GoalStatusChanged } }
    `);
    expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(2);
  });

  it('returns null for an unknown goal id', async () => {
    expect(await store.get('urn:predicate:goal:does-not-exist')).toBeNull();
  });

  it('lists active goals only', async () => {
    const a = await store.create({ statement: 'a', source: 'user' });
    const b = await store.create({ statement: 'b', source: 'user' });
    await store.setStatus(b.id, 'done');
    const active = await store.listActive();
    expect(active.map((g) => g.id)).toEqual([a.id]);
  });

  it('setStatus on an unknown goal throws', async () => {
    await expect(
      store.setStatus('urn:predicate:goal:missing', 'done'),
    ).rejects.toThrow(/not found/i);
  });
});
