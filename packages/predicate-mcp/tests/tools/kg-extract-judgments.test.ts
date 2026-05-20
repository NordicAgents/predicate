import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';
import { withJudgmentTBox } from '../fixtures/with-judgment.js';
import { kgExtractJudgments } from '../../src/tools/kg-extract-judgments.js';
import { kgAssert } from '../../src/tools/kg-assert.js';

const client = getAdapter();
const J = 'https://predicate.dev/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

beforeAll(async () => {
  await withJudgmentTBox(client);
  await client.update('DROP SILENT GRAPH <kg:abox>'); await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:inferred>'); await client.update('CREATE SILENT GRAPH <kg:inferred>');
  await client.update('DROP SILENT GRAPH <kg:provenance>'); await client.update('CREATE SILENT GRAPH <kg:provenance>');
});

describe('kg_extract_judgments', () => {
  it('returns the j: schema slice and a brief, makes no LLM call, never throws on empty graph', async () => {
    const out = await kgExtractJudgments(client, {});
    const classIris = out.judgmentSchema.classes.map((c) => c.iri);
    expect(classIris).toContain(`${J}Decision`);
    expect(out.brief).toMatch(/j:basedOn/);
    expect(Array.isArray(out.currentJudgments)).toBe(true);
    expect(out.currentJudgments).toHaveLength(0);
  });

  it('returns existing current judgments about a touched entity', async () => {
    await kgAssert(client, { subject: 'urn:jd:x', predicate: RDF_TYPE, object: { type: 'uri', value: `${J}Decision` }, source: 's', confidence: 0.9, method: 'test' });
    await kgAssert(client, { subject: 'urn:jd:x', predicate: `${J}about`, object: { type: 'uri', value: 'urn:entity1' }, source: 's', confidence: 0.9, method: 'test' });
    await kgAssert(client, { subject: 'urn:jd:x', predicate: `${J}settledAs`, object: { type: 'uri', value: 'urn:opt' }, source: 's', confidence: 0.9, method: 'test' });
    await kgAssert(client, { subject: 'urn:jd:x', predicate: `${J}rationale`, object: { type: 'literal', value: 'r' }, source: 's', confidence: 0.9, method: 'test' });
    await kgAssert(client, { subject: 'urn:jd:x', predicate: `${J}basedOn`, object: { type: 'uri', value: 'urn:b' }, source: 's', confidence: 0.9, method: 'test' });
    const { FusekiConstructAdapter } = await import('predicate-reasoner/src/index.js');
    await new FusekiConstructAdapter(client).materialize({ tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5 });

    const out = await kgExtractJudgments(client, { touchedEntities: ['urn:entity1'] });
    expect(out.currentJudgments.map((j) => j.judgment)).toContain('urn:jd:x');
  });
});
