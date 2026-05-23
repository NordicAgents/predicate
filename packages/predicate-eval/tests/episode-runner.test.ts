import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { applyEpisodeTriples, rematerialize } from '../src/episode-runner.js';

const client = getAdapter();

beforeEach(async () => {
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:inferred>');
  await client.update('CREATE SILENT GRAPH <kg:inferred>');
});

describe('applyEpisodeTriples', () => {
  it('loads triples into kg:abox', async () => {
    await applyEpisodeTriples(client, [
      { s: 'http://ex/dana', p: 'http://ex/reportsTo', o: 'http://ex/erin' },
    ]);
    const ok = await client.ask(
      'ASK { GRAPH <kg:abox> { <http://ex/dana> <http://ex/reportsTo> <http://ex/erin> } }');
    expect(ok).toBe(true);
  });
});

describe('rematerialize', () => {
  it('control (inference off) leaves kg:inferred empty', async () => {
    await rematerialize(client, false);
    const r = await client.select('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:inferred> { ?s ?p ?o } }');
    expect(Number(r.results.bindings[0]!.n!.value)).toBe(0);
  });
});
