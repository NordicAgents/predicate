import { describe, it, expect, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { Generalizer } from '../src/generalizer.js';

const client = new SparqlClient(loadConfig());

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function insertAbox(triples: string): Promise<void> {
  await client.update(`INSERT DATA { GRAPH <kg:abox> { ${triples} } }`);
}

beforeEach(async () => {
  for (const g of ['kg:abox', 'kg:tbox-staging', 'kg:meta', 'kg:inferred']) {
    await reset(g);
  }
});

describe('Generalizer', () => {
  it('proposes a class when ≥K untyped instances share a fingerprint', async () => {
    for (let i = 0; i < 5; i++) {
      await insertAbox(`<urn:item${i}> <urn:p> "v${i}" . <urn:item${i}> <urn:q> "w${i}" .`);
    }
    const gen = new Generalizer(client, { k: 5 });
    const result = await gen.run();
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]!.members).toHaveLength(5);
    expect(result.proposals[0]!.fingerprint).toEqual(['urn:p', 'urn:q']);
    expect(result.proposals[0]!.className).toMatch(/^urn:predicate:gen:/);

    const proposalIri = result.proposals[0]!.proposalId;
    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?kind WHERE { GRAPH <kg:tbox-staging> { <${proposalIri}> pred:kind ?kind } }
    `);
    expect(r.results.bindings[0]!.kind!.value).toBe('add-class');
  });

  it('skips subjects that already have rdf:type', async () => {
    await insertAbox(`
      <urn:typed> <urn:p> "x" .
      <urn:typed> <urn:q> "y" .
      <urn:typed> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <urn:SomeClass> .
    `);
    for (let i = 0; i < 4; i++) {
      await insertAbox(`<urn:untyped${i}> <urn:p> "x" . <urn:untyped${i}> <urn:q> "y" .`);
    }
    const gen = new Generalizer(client, { k: 5 });
    const result = await gen.run();
    expect(result.proposals).toHaveLength(0);
  });

  it('does not propose when fewer than K instances share a fingerprint', async () => {
    for (let i = 0; i < 3; i++) {
      await insertAbox(`<urn:item${i}> <urn:p> "v" . <urn:item${i}> <urn:q> "w" .`);
    }
    const gen = new Generalizer(client, { k: 5 });
    const result = await gen.run();
    expect(result.proposals).toHaveLength(0);
  });

  it('is idempotent — re-running with the same data produces the same className', async () => {
    for (let i = 0; i < 5; i++) {
      await insertAbox(`<urn:s${i}> <urn:p> "v" . <urn:s${i}> <urn:q> "w" .`);
    }
    const gen = new Generalizer(client, { k: 5 });
    const a = await gen.run();
    const b = await gen.run();
    expect(a.proposals[0]!.className).toBe(b.proposals[0]!.className);
  });

  it('groups separately when subjects have different fingerprints', async () => {
    for (let i = 0; i < 5; i++) {
      await insertAbox(`<urn:a${i}> <urn:p> "v" .`);
    }
    for (let i = 0; i < 5; i++) {
      await insertAbox(`<urn:b${i}> <urn:p> "v" . <urn:b${i}> <urn:q> "w" .`);
    }
    const gen = new Generalizer(client, { k: 5 });
    const result = await gen.run();
    expect(result.proposals).toHaveLength(2);
    const fps = result.proposals.map((p) => p.fingerprint.join(','));
    expect(new Set(fps)).toEqual(new Set(['urn:p', 'urn:p,urn:q']));
  });
});
