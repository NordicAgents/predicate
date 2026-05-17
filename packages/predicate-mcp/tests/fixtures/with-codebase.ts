import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';

const here = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(here, '..', '..', '..', 'predicate-ontology', 'catalog');

export async function withCodebaseTBox(client: SparqlClient = new SparqlClient(loadConfig())): Promise<void> {
  // Idempotent: only load if cb:File isn't already present.
  const present = await client.ask(`
    PREFIX cb:  <https://predicate.dev/codebase#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    ASK { GRAPH <kg:tbox> { cb:File a owl:Class } }
  `);
  if (present) return;
  const meta = readFileSync(join(CATALOG, '..', 'meta', 'predicate-meta.ttl'), 'utf8');
  const cb = readFileSync(join(CATALOG, 'codebase.ttl'), 'utf8');
  const shapes = readFileSync(join(CATALOG, 'codebase.shacl.ttl'), 'utf8');
  const auth = 'Basic ' + Buffer.from(`admin:${process.env['PREDICATE_ADMIN_PASSWORD'] ?? 'changeme'}`).toString('base64');
  const cfg = loadConfig();
  for (const turtle of [meta, cb, shapes]) {
    const r = await fetch(`${cfg.fusekiUrl}/${cfg.dataset}/data?graph=kg:tbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/turtle', 'Authorization': auth },
      body: turtle,
    });
    if (!r.ok) throw new Error(`Fuseki TBox load failed: ${r.status} ${await r.text()}`);
  }
}
