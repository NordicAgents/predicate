import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';

import { kgAssert } from '../../src/tools/kg-assert.js';
import { withCodebaseTBox } from '../fixtures/with-codebase.js';

const client = getAdapter();

beforeAll(async () => {
  await withCodebaseTBox(client);
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
      subject: 'https://industriagents.com/predicate/codebase/auth.ts',
      predicate: 'https://industriagents.com/predicate/codebase#imports',
      object: { type: 'uri', value: 'https://industriagents.com/predicate/codebase/jwt.ts' },
      source: 'file:///repo/auth.ts:3',
      confidence: 0.95,
      method: 'static-import-parse',
    });
    const ok = await client.ask(`
      ASK { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/auth.ts>
        <https://industriagents.com/predicate/codebase#imports>
        <https://industriagents.com/predicate/codebase/jwt.ts> } }
    `);
    expect(ok).toBe(true);
  });

  it('writes RDF-star provenance with source + confidence', async () => {
    await kgAssert(client, {
      subject: 'https://industriagents.com/predicate/codebase/a',
      predicate: 'https://industriagents.com/predicate/codebase#imports',
      object: { type: 'uri', value: 'https://industriagents.com/predicate/codebase/b' },
      source: 'file:///r/a:1',
      confidence: 0.7,
      method: 'parse',
    });
    const r = await client.select(`
      PREFIX prov: <http://www.w3.org/ns/prov#>
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT ?src ?conf ?method WHERE {
        GRAPH <kg:provenance> {
          <<<https://industriagents.com/predicate/codebase/a>
             <https://industriagents.com/predicate/codebase#imports>
             <https://industriagents.com/predicate/codebase/b>>>
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
      subject: 'https://industriagents.com/predicate/codebase/c1',
      predicate: 'https://industriagents.com/predicate/codebase#sha',
      object: { type: 'literal', value: 'abc123' },
      source: 'git',
      confidence: 1.0,
      method: 'git-log',
    });
    const ok = await client.ask(`
      ASK { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/c1>
        <https://industriagents.com/predicate/codebase#sha> "abc123" } }
    `);
    expect(ok).toBe(true);
  });
});

describe('kg_assert TBox-membership check', () => {
  it('rejects a triple whose predicate is not declared in kg:tbox', async () => {
    await expect(
      kgAssert(client, {
        subject: 'urn:test:a',
        predicate: 'https://industriagents.com/predicate/codebase#totallyMadeUp',
        object: { type: 'uri', value: 'urn:test:b' },
        source: 'test', confidence: 1, method: 'test',
      }),
    ).rejects.toThrow(/not declared/);
  });

  it('accepts rdf:type as a universally-legal predicate', async () => {
    await kgAssert(client, {
      subject: 'urn:test:c',
      predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      object: { type: 'uri', value: 'https://industriagents.com/predicate/codebase#File' },
      source: 'test', confidence: 1, method: 'test',
    });
    const ok = await client.ask(`
      ASK { GRAPH <kg:abox> { <urn:test:c>
            <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
            <https://industriagents.com/predicate/codebase#File> } }
    `);
    expect(ok).toBe(true);
  });

  it('accepts a triple whose predicate is in kg:tbox-staging', async () => {
    await client.update(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      INSERT DATA { GRAPH <kg:tbox-staging> {
        <https://industriagents.com/predicate/codebase#stagedProp> a owl:ObjectProperty .
      } }
    `);
    await kgAssert(client, {
      subject: 'urn:test:d',
      predicate: 'https://industriagents.com/predicate/codebase#stagedProp',
      object: { type: 'uri', value: 'urn:test:e' },
      source: 'test', confidence: 1, method: 'test',
    });
  });
});
