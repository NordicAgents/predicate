import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';

import { kgExploreSchema } from '../../src/tools/kg-explore-schema.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const client = getAdapter();

beforeAll(async () => {
  await client.update('DROP SILENT GRAPH <kg:tbox>');
  await client.update('CREATE SILENT GRAPH <kg:tbox>');
  const tbox = readFileSync(
    resolve(import.meta.dirname, '../../../predicate-ontology/catalog/codebase.ttl'),
    'utf8',
  );
  await client.loadTurtle(tbox, 'kg:tbox');
});

describe('kg_explore_schema', () => {
  it('returns the Function class slice', async () => {
    const slice = await kgExploreSchema(client, 'https://industriagents.com/predicate/codebase#Function');
    expect(slice.classes.map((c) => c.iri)).toContain('https://industriagents.com/predicate/codebase#Function');
    expect(slice.classes.find((c) => c.iri.endsWith('#Function'))?.subClassOf).toContain(
      'https://industriagents.com/predicate/codebase#Symbol',
    );
    const propIris = slice.properties.map((p) => p.iri);
    expect(propIris).toContain('https://industriagents.com/predicate/codebase#calls');
    expect(propIris).toContain('https://industriagents.com/predicate/codebase#reads');
  });

  it('returns empty arrays for an unknown concept', async () => {
    const slice = await kgExploreSchema(client, 'https://industriagents.com/predicate/codebase#NotAThing');
    expect(slice.classes).toEqual([]);
    expect(slice.properties).toEqual([]);
  });

  it('accepts a short label and resolves it', async () => {
    const slice = await kgExploreSchema(client, 'File');
    expect(slice.classes.some((c) => c.iri.endsWith('#File'))).toBe(true);
  });
});
