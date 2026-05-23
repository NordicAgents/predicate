import { describe, it, expect, beforeEach } from 'vitest';
import { OxigraphAdapter } from '../src/storage/index.js';
import { kgExploreSchema } from '../src/tools/kg-explore-schema.js';

const TBOX = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix cb: <https://industriagents.com/predicate/codebase#> .
cb:Function a owl:Class ; rdfs:label "Function" .
cb:EnvVar   a owl:Class ; rdfs:label "EnvVar" .
cb:reads a owl:ObjectProperty ; rdfs:domain cb:Function ; rdfs:range cb:EnvVar ; rdfs:label "reads env var" .
`;

describe('kgExploreSchema concept resolution', () => {
  let client: OxigraphAdapter;
  beforeEach(async () => {
    client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.loadTurtle(TBOX, 'kg:tbox');
  });

  it('resolves a property by its local name even when the label differs', async () => {
    const slice = await kgExploreSchema(client, 'reads');
    expect(slice.concept).toBe('https://industriagents.com/predicate/codebase#reads');
    expect(slice.properties.map((p) => p.iri)).toContain('https://industriagents.com/predicate/codebase#reads');
  });

  it('returns an empty slice (no throw) for an unknown concept', async () => {
    const slice = await kgExploreSchema(client, 'doesNotExist');
    expect(slice.classes).toEqual([]);
    expect(slice.properties).toEqual([]);
  });

  it('still resolves a class by label', async () => {
    const slice = await kgExploreSchema(client, 'Function');
    expect(slice.concept).toBe('https://industriagents.com/predicate/codebase#Function');
  });
});
