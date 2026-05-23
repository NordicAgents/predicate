import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { countTriples, unusedConceptRatio, collectMetrics } from '../src/metrics.js';

const client = getAdapter();

beforeEach(async () => {
  for (const g of ['kg:abox', 'kg:inferred', 'kg:tbox', 'kg:usage']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
});

describe('countTriples', () => {
  it('counts triples in a named graph', async () => {
    await client.loadTurtle('<http://ex/a> <http://ex/p> <http://ex/b> .', 'kg:abox');
    expect(await countTriples(client, 'kg:abox')).toBe(1);
  });
});

describe('unusedConceptRatio', () => {
  it('is 1 when a class exists in tbox but is never referenced in usage', async () => {
    await client.loadTurtle(
      '<http://ex/C> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ' +
      '<http://www.w3.org/2002/07/owl#Class> .', 'kg:tbox');
    expect(await unusedConceptRatio(client)).toBe(1);
  });
  it('is 0 when there are no concepts (avoids divide-by-zero)', async () => {
    expect(await unusedConceptRatio(client)).toBe(0);
  });
});

describe('collectMetrics', () => {
  it('assembles a Boundedness record', async () => {
    const m = await collectMetrics(client, 42);
    expect(m).toEqual({ triples: 0, inferred: 0, unusedConceptRatio: 0, materializeMs: 42 });
  });
});
