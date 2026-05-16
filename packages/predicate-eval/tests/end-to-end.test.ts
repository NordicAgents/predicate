import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

const client = new SparqlClient(loadConfig());

beforeAll(async () => {
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:provenance>');
  execSync('pnpm tsx src/load-corpus.ts', { cwd: import.meta.dirname + '/..', stdio: 'inherit' });
});

describe('end-to-end demo', () => {
  it('auth.ts imports jwt.ts is asserted', async () => {
    const ok = await client.ask(`
      ASK { GRAPH <kg:abox> {
        <https://predicate.dev/codebase/auth.ts>
        <https://predicate.dev/codebase#imports>
        <https://predicate.dev/codebase/jwt.ts> } }
    `);
    expect(ok).toBe(true);
  });

  it('verifyJwt reads JWT_SECRET (with confidence < 1)', async () => {
    const r = await client.select(`
      PREFIX c: <https://predicate.dev/codebase#>
      SELECT ?env WHERE { GRAPH <kg:abox> {
        <https://predicate.dev/codebase/jwt.ts#verifyJwt> c:reads ?env } }
    `);
    expect(r.results.bindings.map((b) => b.env!.value)).toContain(
      'https://predicate.dev/codebase/env/JWT_SECRET',
    );
  });
});
