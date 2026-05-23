import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { LifecycleController } from '../src/lifecycle-controller.js';

const client = getAdapter();

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function insertAbox(n: number): Promise<void> {
  const triples = Array.from({ length: n }, (_, i) =>
    `<urn:test:s${i}> <urn:test:p> <urn:test:o${i}> .`).join('\n');
  await client.update(`INSERT DATA { GRAPH <kg:abox> { ${triples} } }`);
}

describe('LifecycleController.scaleSignal', () => {
  beforeEach(async () => {
    for (const g of ['kg:abox', 'kg:tbox', 'kg:inferred', 'kg:goals', 'kg:usage']) {
      await reset(g);
    }
  });

  it('returns Seedling below the threshold', async () => {
    await insertAbox(5);
    const ctrl = new LifecycleController(client, { scaleGateTriples: 10 });
    const sig = await ctrl.scaleSignal();
    expect(sig.tier).toBe('Seedling');
    expect(sig.tripleCount).toBe(5);
  });

  it('returns Active at/above the threshold', async () => {
    await insertAbox(10);
    const ctrl = new LifecycleController(client, { scaleGateTriples: 10 });
    const sig = await ctrl.scaleSignal();
    expect(sig.tier).toBe('Active');
    expect(sig.tripleCount).toBe(10);
  });

  it('aggregates triples across multiple graphs', async () => {
    // Insert 3 triples into kg:abox and 4 into kg:tbox
    await insertAbox(3);
    const tboxTriples = Array.from({ length: 4 }, (_, i) =>
      `<urn:test:ts${i}> <urn:test:tp> <urn:test:to${i}> .`).join('\n');
    await client.update(`INSERT DATA { GRAPH <kg:tbox> { ${tboxTriples} } }`);

    const ctrl = new LifecycleController(client, { scaleGateTriples: 100 });
    const sig = await ctrl.scaleSignal();
    expect(sig.tripleCount).toBe(7);
  });

  afterAll(async () => {
    for (const g of ['kg:abox', 'kg:tbox', 'kg:inferred', 'kg:goals', 'kg:usage']) {
      await reset(g);
    }
  });
});
