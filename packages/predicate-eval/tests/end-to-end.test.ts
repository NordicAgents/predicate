import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { withCodebaseTBox } from 'predicate-mcp/tests/fixtures/with-codebase.js';
import { main as loadCorpus } from '../src/load-corpus.js';

const client = getAdapter();

beforeAll(async () => {
  await withCodebaseTBox(client);
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:provenance>');
  await client.update('CREATE SILENT GRAPH <kg:provenance>');
  await loadCorpus(client);
});

describe('end-to-end demo', () => {
  it('auth.ts imports jwt.ts is asserted', async () => {
    const ok = await client.ask(`
      ASK { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/auth.ts>
        <https://industriagents.com/predicate/codebase#imports>
        <https://industriagents.com/predicate/codebase/jwt.ts> } }
    `);
    expect(ok).toBe(true);
  });

  it('verifyJwt reads JWT_SECRET (with confidence < 1)', async () => {
    const r = await client.select(`
      PREFIX c: <https://industriagents.com/predicate/codebase#>
      SELECT ?env WHERE { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/jwt.ts#verifyJwt> c:reads ?env } }
    `);
    expect(r.results.bindings.map((b) => b.env!.value)).toContain(
      'https://industriagents.com/predicate/codebase/env/JWT_SECRET',
    );
  });
});
