import { describe, it, expect } from 'vitest';
import { OxigraphAdapter } from '../src/storage/index.js';
import { kgAsk } from '../src/tools/kg-ask.js';

describe('kg_ask without a question', () => {
  it('runs sparql-only and still logs usage', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.update(`INSERT DATA { GRAPH <kg:abox> { <urn:s> <urn:p> <urn:o> } }`);
    const r = await kgAsk(client, {
      sparql: `SELECT ?s WHERE { GRAPH <kg:abox> { ?s <urn:p> <urn:o> } }`,
    });
    expect(r.bindings.map((b) => b['s']!.value)).toContain('urn:s');
    const log = await client.ask(`PREFIX pred: <https://predicate.dev/meta#> ASK { GRAPH <kg:usage> { ?q a pred:Query } }`);
    expect(log).toBe(true);
  });
});
