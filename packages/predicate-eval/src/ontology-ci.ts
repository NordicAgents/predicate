import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';

async function loadTtl(client: StorageAdapter, path: string, graph: string): Promise<void> {
  const ttl = readFileSync(path, 'utf8');
  await client.loadTurtle(ttl, graph);
}

async function main(): Promise<void> {
  const client = getAdapter();
  const adapter = new FusekiConstructAdapter(client);

  for (const g of ['kg:tbox-staging', 'kg:abox-ci-sample']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }

  const root = resolve(import.meta.dirname, '..', '..', 'predicate-ontology');
  await loadTtl(client, join(root, 'tbox', 'codebase.ttl'),         'kg:tbox-staging');
  await loadTtl(client, join(root, 'meta', 'predicate-meta.ttl'),   'kg:tbox-staging');
  await loadTtl(client, join(root, 'shapes', 'codebase.shacl.ttl'), 'kg:tbox-staging');

  // Minimal sample so validation isn't a no-op
  await client.update(`
    PREFIX c:   <https://predicate.dev/codebase#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT DATA { GRAPH <kg:abox-ci-sample> {
      <https://predicate.dev/codebase/auth.ts> rdf:type c:File ;
        c:path "auth.ts" .
    } }
  `);

  const r = await adapter.validate({
    tboxGraph: 'kg:tbox',                   // empty baseline
    stagingGraph: 'kg:tbox-staging',
    aboxSample: 'kg:abox-ci-sample',
  });

  if (!r.ok) {
    console.error('ONTOLOGY CI FAIL');
    console.error('  unsatisfiable classes:', r.unsatisfiableClasses);
    console.error('  shacl violations:', JSON.stringify(r.shaclViolations, null, 2));
    process.exit(1);
  }
  console.log('ontology-ci: ok');
}

main().catch((e) => { console.error(e); process.exit(1); });
