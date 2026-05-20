import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getAdapter } from '../src/storage/index.js';


const CATALOG_DIR = join(__dirname, '..', '..', 'predicate-ontology', 'catalog');
const client = getAdapter();

interface CatalogEntry { name: string; files: string[]; shapes?: string }
interface Catalog { ontologies: CatalogEntry[] }

const catalog: Catalog = JSON.parse(readFileSync(join(CATALOG_DIR, 'catalog.json'), 'utf8'));

async function resetTbox(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:tbox>`);
  await client.update(`CREATE SILENT GRAPH <kg:tbox>`);
}

async function loadTtl(path: string): Promise<void> {
  const turtle = readFileSync(path, 'utf8');
  await client.loadTurtle(turtle, 'kg:tbox');
}

describe('catalog.json', () => {
  it('declares at least 5 ontologies', () => {
    expect(catalog.ontologies.length).toBeGreaterThanOrEqual(5);
  });

  it('every ontology has a name, description, license, and files array', () => {
    for (const o of catalog.ontologies) {
      expect(o.name).toBeTypeOf('string');
      expect((o as { description?: string }).description).toBeTypeOf('string');
      expect((o as { license?: string }).license).toBeTypeOf('string');
      expect(Array.isArray(o.files)).toBe(true);
      expect(o.files.length).toBeGreaterThan(0);
    }
  });

  it('every declared file actually exists on disk', () => {
    const onDisk = new Set(readdirSync(CATALOG_DIR));
    for (const o of catalog.ontologies) {
      for (const f of o.files) {
        expect(onDisk.has(f), `${o.name} declares ${f} but it's not in catalog/`).toBe(true);
      }
      if (o.shapes) expect(onDisk.has(o.shapes), `${o.name} declares shapes ${o.shapes} missing`).toBe(true);
    }
  });
});

describe('each catalog ontology parses and loads into a fresh kg:tbox', () => {
  beforeEach(resetTbox);

  for (const o of catalog.ontologies) {
    it(`loads ${o.name} without errors`, async () => {
      for (const f of o.files) {
        await loadTtl(join(CATALOG_DIR, f));
      }
      const r = await client.select(
        `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:tbox> { ?s ?p ?o } }`,
      );
      const n = parseInt(r.results.bindings[0]!.n!.value, 10);
      expect(n).toBeGreaterThan(0);
    });
  }
});
