import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdapter } from '../../src/storage/index.js';
import type { StorageAdapter } from '../../src/storage/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(here, '..', '..', '..', 'predicate-ontology', 'catalog');

/** Load meta + top + codebase + judgment ontologies into kg:tbox. Idempotent. */
export async function withJudgmentTBox(client: StorageAdapter = getAdapter()): Promise<void> {
  const present = await client.ask(`
    PREFIX j:   <https://industriagents.com/predicate/judgment#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    ASK { GRAPH <kg:tbox> { j:Judgment a owl:Class } }
  `);
  if (present) return;
  const meta = readFileSync(join(CATALOG, '..', 'meta', 'predicate-meta.ttl'), 'utf8');
  const top = readFileSync(join(CATALOG, 'top.ttl'), 'utf8');
  const cb = readFileSync(join(CATALOG, 'codebase.ttl'), 'utf8');
  const j = readFileSync(join(CATALOG, 'judgment.ttl'), 'utf8');
  const jShapes = readFileSync(join(CATALOG, 'judgment.shacl.ttl'), 'utf8');
  for (const turtle of [meta, top, cb, j, jShapes]) {
    await client.loadTurtle(turtle, 'kg:tbox');
  }
}
