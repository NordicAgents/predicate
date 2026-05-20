import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';

import { kgAsk } from '../../src/tools/kg-ask.js';
import { kgAssert } from '../../src/tools/kg-assert.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const client = getAdapter();
const C = 'https://predicate.dev/codebase#';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeAll(async () => {
  await reset('kg:tbox');
  const tbox = readFileSync(
    resolve(import.meta.dirname, '../../../predicate-ontology/catalog/codebase.ttl'),
    'utf8',
  );
  await client.loadTurtle(tbox, 'kg:tbox');
});

beforeEach(async () => {
  await reset('kg:abox');
  await reset('kg:provenance');
  await reset('kg:usage');
  await kgAssert(client, {
    subject: 'https://predicate.dev/codebase/auth.ts',
    predicate: `${C}imports`,
    object: { type: 'uri', value: 'https://predicate.dev/codebase/jwt.ts' },
    source: 'parse', confidence: 1, method: 'parse',
  });
});

describe('kg_ask', () => {
  it('executes a caller-drafted SELECT and returns bindings', async () => {
    const r = await kgAsk(client, {
      question: 'what does auth.ts import?',
      sparql: `
        PREFIX c: <${C}>
        SELECT ?o WHERE { GRAPH <kg:abox> {
          <https://predicate.dev/codebase/auth.ts> c:imports ?o } }
      `,
    });
    expect(r.bindings).toHaveLength(1);
    expect(r.bindings[0]!.o!.value).toBe('https://predicate.dev/codebase/jwt.ts');
    expect(r.truncated).toBe(false);
  });

  it('truncates results to maxRows and sets truncated flag', async () => {
    for (let i = 0; i < 5; i++) {
      await kgAssert(client, {
        subject: `https://predicate.dev/codebase/auth.ts`,
        predicate: `${C}imports`,
        object: { type: 'uri', value: `https://predicate.dev/codebase/dep${i}.ts` },
        source: 'p', confidence: 1, method: 'p',
      });
    }
    const r = await kgAsk(client, {
      question: 'deps',
      sparql: `
        PREFIX c: <${C}>
        SELECT ?o WHERE { GRAPH <kg:abox> {
          <https://predicate.dev/codebase/auth.ts> c:imports ?o } }
      `,
      maxRows: 3,
    });
    expect(r.bindings).toHaveLength(3);
    expect(r.truncated).toBe(true);
  });

  it('logs the query into kg:usage', async () => {
    await kgAsk(client, {
      question: 'q',
      sparql: 'SELECT * WHERE { ?s ?p ?o } LIMIT 1',
    });
    const u = await client.select(
      'SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:usage> { ?s ?p ?o } }',
    );
    expect(parseInt(u.results.bindings[0]!.n!.value, 10)).toBeGreaterThan(0);
  });

  it('rejects UPDATE queries (read-only tool)', async () => {
    await expect(
      kgAsk(client, { question: 'x', sparql: 'INSERT DATA { <a:a> <a:b> <a:c> }' }),
    ).rejects.toThrow(/read-only/);
  });
});
