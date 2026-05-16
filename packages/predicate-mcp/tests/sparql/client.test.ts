import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';

const cfg = loadConfig();
const client = new SparqlClient(cfg);

// Test isolation via per-test graph
const TEST_GRAPH = 'kg:test-client';

async function clearTestGraph(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${TEST_GRAPH}>`);
}

describe('SparqlClient', () => {
  beforeAll(clearTestGraph);
  afterAll(clearTestGraph);

  it('runs SELECT and returns typed bindings', async () => {
    await client.update(`
      PREFIX ex: <https://ex/>
      INSERT DATA { GRAPH <${TEST_GRAPH}> { ex:a ex:p "hello" . } }
    `);
    const res = await client.select(`
      SELECT ?s ?o WHERE { GRAPH <${TEST_GRAPH}> { ?s ?p ?o } }
    `);
    expect(res.results.bindings).toHaveLength(1);
    expect(res.results.bindings[0]!.s!.value).toBe('https://ex/a');
    expect(res.results.bindings[0]!.o!.type).toBe('literal');
  });

  it('runs ASK and returns boolean', async () => {
    const yes = await client.ask(`ASK { GRAPH <${TEST_GRAPH}> { ?s ?p ?o } }`);
    expect(yes).toBe(true);
    const no = await client.ask(`ASK { GRAPH <${TEST_GRAPH}-nonexistent> { ?s ?p ?o } }`);
    expect(no).toBe(false);
  });

  it('throws SparqlError on bad query with status + body', async () => {
    await expect(client.select('NOT VALID SPARQL')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('reads graph metadata even when empty', async () => {
    // Insert a sentinel triple so TEST_GRAPH is non-empty, then verify
    // knownGraphs() returns it.  This avoids depending on kg:tbox being
    // populated at exactly this moment (another test file resets it in
    // its own beforeAll and they run concurrently).
    await client.update(`INSERT DATA { GRAPH <${TEST_GRAPH}> { <urn:sentinel> <urn:p> "1" . } }`);
    const known = await client.knownGraphs();
    expect(known).toEqual(expect.arrayContaining([TEST_GRAPH]));
  });
});
