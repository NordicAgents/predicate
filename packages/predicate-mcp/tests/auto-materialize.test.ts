import { describe, it, expect } from 'vitest';
import { OxigraphAdapter } from '../src/storage/index.js';
import { kgAssert } from '../src/tools/kg-assert.js';
import { kgAsk } from '../src/tools/kg-ask.js';
import { isAboxDirty } from '../src/materialize.js';

const TBOX = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix cb: <https://industriagents.com/predicate/codebase#> .
cb:calls a owl:ObjectProperty , owl:TransitiveProperty .
`;
const C = 'https://industriagents.com/predicate/codebase#calls';
const F = 'https://industriagents.com/predicate/codebase/x#';
const assert = (client: OxigraphAdapter, s: string, o: string) =>
  kgAssert(client, { subject: s, predicate: C, object: { type: 'uri', value: o },
    source: 't', confidence: 0.95, method: 'm' });

describe('auto-materialization on read', () => {
  it('kg_ask returns inferred rows WITHOUT an explicit kg_maintain', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.loadTurtle(TBOX, 'kg:tbox');
    await assert(client, `${F}a`, `${F}b`);
    await assert(client, `${F}b`, `${F}c`);
    expect(await isAboxDirty(client)).toBe(true);

    const r = await kgAsk(client, {
      question: 'transitive closure',
      sparql: `SELECT ?o WHERE { GRAPH <kg:inferred> { <${F}a> <${C}> ?o } }`,
    });
    const objs = r.bindings.map((b) => b['o']!.value);
    expect(objs).toContain(`${F}c`);
    expect(await isAboxDirty(client)).toBe(false);
  });
});
