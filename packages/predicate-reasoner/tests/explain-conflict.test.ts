import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { withJudgmentTBox } from 'predicate-mcp/tests/fixtures/with-judgment.js';
import { FusekiConstructAdapter } from '../src/index.js';
import { kgAssert } from 'predicate-mcp/src/tools/kg-assert.js';

const client = getAdapter();
const J = 'https://predicate.dev/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const adapter = new FusekiConstructAdapter(client);

beforeAll(async () => {
  await withJudgmentTBox(client);
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:provenance>');
  await client.update('CREATE SILENT GRAPH <kg:provenance>');
  await client.update('DROP SILENT GRAPH <kg:inferred>');
  await client.update('CREATE SILENT GRAPH <kg:inferred>');

  for (const [jd, team, basis] of [
    ['urn:jd:A', 'urn:teamPlatform', 'urn:reorgDoc'],
    ['urn:jd:B', 'urn:teamCheckout', 'urn:pagerConfig'],
  ] as const) {
    await kgAssert(client, {
      subject: jd,
      predicate: RDF_TYPE,
      object: { type: 'uri', value: `${J}Decision` },
      source: basis,
      confidence: 0.9,
      method: 'test',
    });
    await kgAssert(client, {
      subject: jd,
      predicate: `${J}about`,
      object: { type: 'uri', value: 'urn:payments' },
      source: basis,
      confidence: 0.9,
      method: 'test',
    });
    await kgAssert(client, {
      subject: jd,
      predicate: `${J}settledAs`,
      object: { type: 'uri', value: team },
      source: basis,
      confidence: 0.9,
      method: 'test',
    });
    await kgAssert(client, {
      subject: jd,
      predicate: `${J}rationale`,
      object: { type: 'literal', value: 'owner call' },
      source: basis,
      confidence: 0.9,
      method: 'test',
    });
    await kgAssert(client, {
      subject: jd,
      predicate: `${J}basedOn`,
      object: { type: 'uri', value: basis },
      source: basis,
      confidence: 0.9,
      method: 'test',
    });
  }

  await adapter.materialize({
    tboxGraph: 'kg:tbox',
    aboxGraphs: ['kg:abox'],
    targetGraph: 'kg:inferred',
    closureCutoff: 0.5,
  });

  // Sanity check: UnresolvedConflict must have materialized for urn:jd:A
  const conflictPresent = await client.ask(`
    PREFIX j: <${J}>
    ASK { GRAPH <kg:inferred> { <urn:jd:A> a j:UnresolvedConflict } }
  `);
  if (!conflictPresent) {
    throw new Error(
      'Sanity check failed: urn:jd:A a j:UnresolvedConflict not found in kg:inferred after materialize. ' +
      'r21 may not have fired — check that both judgments are j:Current and j:settledAs values differ.',
    );
  }
});

describe('kg_explain on a materialized conflict (E4)', () => {
  it('explains UnresolvedConflict and cites both bases', async () => {
    // explain(claim: Quad): Promise<InferenceTrace | null>
    // InferenceTrace.citedProvenance: ProvenanceRecord[] where ProvenanceRecord.source: string
    const trace = await adapter.explain({
      s: 'urn:jd:A',
      p: RDF_TYPE,
      o: `${J}UnresolvedConflict`,
    });
    expect(trace).not.toBeNull();
    const cited = trace!.citedProvenance.map((p) => p.source);
    expect(cited).toContain('urn:reorgDoc');
    expect(cited).toContain('urn:pagerConfig');
  });
});
