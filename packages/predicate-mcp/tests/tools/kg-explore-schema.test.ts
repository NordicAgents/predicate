import { describe, it, expect, beforeAll } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { kgExploreSchema } from '../../src/tools/kg-explore-schema.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cfg = loadConfig();
const client = new SparqlClient(cfg);

beforeAll(async () => {
  await client.update('DROP SILENT GRAPH <kg:tbox>');
  await client.update('CREATE SILENT GRAPH <kg:tbox>');
  const tbox = readFileSync(
    resolve(import.meta.dirname, '../../../predicate-ontology/tbox/codebase.ttl'),
    'utf8',
  );
  const auth =
    'Basic ' +
    Buffer.from(
      `${process.env.PREDICATE_ADMIN_USER ?? 'admin'}:${process.env.PREDICATE_ADMIN_PASSWORD ?? 'changeme'}`,
    ).toString('base64');
  await fetch(`${cfg.dataEndpoint}?graph=kg:tbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle', Authorization: auth },
    body: tbox,
  });
});

describe('kg_explore_schema', () => {
  it('returns the Function class slice', async () => {
    const slice = await kgExploreSchema(client, 'https://predicate.dev/codebase#Function');
    expect(slice.classes.map((c) => c.iri)).toContain('https://predicate.dev/codebase#Function');
    expect(slice.classes.find((c) => c.iri.endsWith('#Function'))?.subClassOf).toContain(
      'https://predicate.dev/codebase#Symbol',
    );
    const propIris = slice.properties.map((p) => p.iri);
    expect(propIris).toContain('https://predicate.dev/codebase#calls');
    expect(propIris).toContain('https://predicate.dev/codebase#reads');
  });

  it('returns empty arrays for an unknown concept', async () => {
    const slice = await kgExploreSchema(client, 'https://predicate.dev/codebase#NotAThing');
    expect(slice.classes).toEqual([]);
    expect(slice.properties).toEqual([]);
  });

  it('accepts a short label and resolves it', async () => {
    const slice = await kgExploreSchema(client, 'File');
    expect(slice.classes.some((c) => c.iri.endsWith('#File'))).toBe(true);
  });
});
