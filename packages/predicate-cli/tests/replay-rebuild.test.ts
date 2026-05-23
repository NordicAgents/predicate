import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { kgAssert } from 'predicate-mcp/src/tools/kg-assert.js';
import { deleteExtractedSlice } from '../src/commands/replay-rebuild.js';

const client = getAdapter();
const C = 'https://industriagents.com/predicate/codebase#';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function aboxCount(): Promise<number> {
  const r = await client.select('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }');
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}
async function provCount(): Promise<number> {
  const r = await client.select('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:provenance> { ?x ?y ?z } }');
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

beforeEach(async () => {
  await reset('kg:tbox'); await reset('kg:abox'); await reset('kg:provenance');
  await client.loadTurtle(
    `@prefix c: <${C}> . @prefix owl: <http://www.w3.org/2002/07/owl#> . c:imports a owl:ObjectProperty .`,
    'kg:tbox',
  );
});

describe('deleteExtractedSlice', () => {
  it('removes only triples whose sole provenance source is the session URI', async () => {
    await kgAssert(client, {
      subject: `${C}a.ts`, predicate: `${C}imports`,
      object: { type: 'uri', value: `${C}b.ts` },
      source: 'urn:predicate:session:S1', confidence: 0.95, method: 'tool-parse',
    });
    expect(await aboxCount()).toBe(1);
    await deleteExtractedSlice(client, 'S1');
    expect(await aboxCount()).toBe(0);
    expect(await provCount()).toBe(0); // provenance fully cleaned, no orphans
  });

  it('preserves a triple that also has a non-session source (shared triple)', async () => {
    const triple = {
      subject: `${C}a.ts`, predicate: `${C}imports`,
      object: { type: 'uri' as const, value: `${C}b.ts` },
    };
    await kgAssert(client, { ...triple, source: 'urn:predicate:session:S1', confidence: 0.95, method: 'tool-parse' });
    await kgAssert(client, { ...triple, source: 'manual', confidence: 1, method: 'human' });
    await deleteExtractedSlice(client, 'S1');
    expect(await aboxCount()).toBe(1); // shared triple survives
  });
});
