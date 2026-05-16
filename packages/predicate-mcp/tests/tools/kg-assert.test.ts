import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { kgAssert } from '../../src/tools/kg-assert.js';

const cfg = loadConfig();
const client = new SparqlClient(cfg);

beforeAll(async () => {
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:provenance>');
});

beforeEach(async () => {
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:provenance>');
  await client.update('CREATE SILENT GRAPH <kg:provenance>');
});

describe('kg_assert', () => {
  it('writes the triple to kg:abox', async () => {
    await kgAssert(client, {
      subject: 'https://predicate.dev/codebase/auth.ts',
      predicate: 'https://predicate.dev/codebase#imports',
      object: { type: 'uri', value: 'https://predicate.dev/codebase/jwt.ts' },
      source: 'file:///repo/auth.ts:3',
      confidence: 0.95,
      method: 'static-import-parse',
    });
    const ok = await client.ask(`
      ASK { GRAPH <kg:abox> {
        <https://predicate.dev/codebase/auth.ts>
        <https://predicate.dev/codebase#imports>
        <https://predicate.dev/codebase/jwt.ts> } }
    `);
    expect(ok).toBe(true);
  });

  it('writes RDF-star provenance with source + confidence', async () => {
    await kgAssert(client, {
      subject: 'https://predicate.dev/codebase/a',
      predicate: 'https://predicate.dev/codebase#imports',
      object: { type: 'uri', value: 'https://predicate.dev/codebase/b' },
      source: 'file:///r/a:1',
      confidence: 0.7,
      method: 'parse',
    });
    const r = await client.select(`
      PREFIX prov: <http://www.w3.org/ns/prov#>
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?src ?conf ?method WHERE {
        GRAPH <kg:provenance> {
          <<<https://predicate.dev/codebase/a>
             <https://predicate.dev/codebase#imports>
             <https://predicate.dev/codebase/b>>>
            pred:source ?src ;
            pred:confidence ?conf ;
            pred:method ?method .
        }
      }
    `);
    expect(r.results.bindings).toHaveLength(1);
    expect(r.results.bindings[0]!.src!.value).toBe('file:///r/a:1');
    expect(parseFloat(r.results.bindings[0]!.conf!.value)).toBeCloseTo(0.7);
    expect(r.results.bindings[0]!.method!.value).toBe('parse');
  });

  it('rejects confidence outside [0,1]', async () => {
    await expect(
      kgAssert(client, {
        subject: 'urn:a', predicate: 'urn:b',
        object: { type: 'uri', value: 'urn:c' },
        source: 'x', confidence: 1.5, method: 'm',
      }),
    ).rejects.toThrow(/confidence/);
  });

  it('writes a literal object correctly', async () => {
    await kgAssert(client, {
      subject: 'https://predicate.dev/codebase/c1',
      predicate: 'https://predicate.dev/codebase#sha',
      object: { type: 'literal', value: 'abc123' },
      source: 'git',
      confidence: 1.0,
      method: 'git-log',
    });
    const ok = await client.ask(`
      ASK { GRAPH <kg:abox> {
        <https://predicate.dev/codebase/c1>
        <https://predicate.dev/codebase#sha> "abc123" } }
    `);
    expect(ok).toBe(true);
  });
});
