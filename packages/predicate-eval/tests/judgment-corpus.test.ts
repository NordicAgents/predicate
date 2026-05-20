import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { withJudgmentTBox } from 'predicate-mcp/tests/fixtures/with-judgment.js';
import { loadJudgmentCorpus, CORPUS_IRIS } from '../src/judgment-corpus.js';

const client = getAdapter();

beforeAll(async () => {
  await withJudgmentTBox(client);
  await client.update('DROP SILENT GRAPH <kg:abox>'); await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:provenance>'); await client.update('CREATE SILENT GRAPH <kg:provenance>');
  await loadJudgmentCorpus(client);
});

describe('judgment corpus', () => {
  it('loads the abandoned-Postgres decision with its rationale', async () => {
    const r = await client.select(`
      PREFIX j: <${CORPUS_IRIS.J}>
      SELECT ?why WHERE { GRAPH <kg:abox> {
        <${CORPUS_IRIS.cb}eventStoreDecision> j:rationale ?why } }
    `);
    expect(r.results.bindings[0]?.why?.value).toMatch(/Postgres/);
  });
});
