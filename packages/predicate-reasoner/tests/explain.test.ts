import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { FusekiConstructAdapter } from '../src/index.js';

const client = new SparqlClient(loadConfig());
const adapter = new FusekiConstructAdapter(client);

beforeAll(async () => {
  for (const g of ['kg:tbox', 'kg:abox', 'kg:provenance', 'kg:inferred']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    INSERT DATA {
      GRAPH <kg:tbox> {
        ex:Dog    rdfs:subClassOf ex:Mammal .
        ex:Mammal rdfs:subClassOf ex:Animal .
        ex:Animal rdfs:subClassOf ex:LivingThing .
      }
    }
  `);
  await adapter.materialize({
    tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'],
    targetGraph: 'kg:inferred', closureCutoff: 0.5,
  });
});

afterAll(async () => {
  await client.update(`DROP SILENT GRAPH <kg:tbox>`);
  await client.update(`CREATE SILENT GRAPH <kg:tbox>`);
  const cfg2 = loadConfig();
  const auth = 'Basic ' + Buffer.from(
    `${process.env.PREDICATE_ADMIN_USER ?? 'admin'}:${process.env.PREDICATE_ADMIN_PASSWORD ?? 'changeme'}`,
  ).toString('base64');
  for (const path of [
    '../../predicate-ontology/tbox/codebase.ttl',
    '../../predicate-ontology/meta/predicate-meta.ttl',
    '../../predicate-ontology/shapes/codebase.shacl.ttl',
  ]) {
    const ttl = readFileSync(resolve(import.meta.dirname, path), 'utf8');
    await fetch(`${cfg2.dataEndpoint}?graph=kg:tbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/turtle', Authorization: auth },
      body: ttl,
    });
  }
});

describe('kg_explain', () => {
  it('returns a derivation for Dog rdfs:subClassOf Animal', async () => {
    const trace = await adapter.explain({
      s: 'https://ex/Dog',
      p: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      o: 'https://ex/Animal',
    });
    expect(trace).not.toBeNull();
    expect(trace!.derivation.length).toBeGreaterThan(0);
    expect(trace!.derivation[trace!.derivation.length - 1]!.conclusion.s).toBe('https://ex/Dog');
  });

  it('returns null for an unprovable claim', async () => {
    const trace = await adapter.explain({
      s: 'https://ex/Dog',
      p: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      o: 'https://ex/Plant',
    });
    expect(trace).toBeNull();
  });
});
