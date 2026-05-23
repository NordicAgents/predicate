import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { GapDetector } from '../src/gap-detector.js';
import type { SubQuestion } from '../src/types.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const client = getAdapter();
const detector = new GapDetector(client);

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function loadTbox(file: string): Promise<void> {
  const ttl = readFileSync(resolve(import.meta.dirname, '../../', file), 'utf8');
  await client.loadTurtle(ttl, 'kg:tbox');
}

beforeAll(async () => {
  await reset('kg:tbox');
  await loadTbox('predicate-ontology/catalog/codebase.ttl');
  await loadTbox('predicate-ontology/meta/predicate-meta.ttl');
  await loadTbox('predicate-ontology/catalog/codebase.shacl.ttl');
});

afterAll(async () => {
  // Leave kg:tbox as the seed TBox so subsequent tests see the codebase ontology.
});

describe('GapDetector', () => {
  it('reports answerable=true for find-callers with :calls in TBox', async () => {
    const sq: SubQuestion = {
      id: 'SQ-1', text: 'find callers of x',
      intent: { kind: 'find-callers', payload: { symbol: 'x', transitive: false } },
    };
    const r = await detector.detect(sq);
    expect(r.answerable).toBe(true);
    expect(r.missingPredicates).toEqual([]);
  });

  it('reports answerable=true for find-dependencies transitive (uses :dependsOn)', async () => {
    const sq: SubQuestion = {
      id: 'SQ-2', text: 'transitive deps',
      intent: { kind: 'find-dependencies', payload: { symbol: 'x', transitive: true } },
    };
    const r = await detector.detect(sq);
    expect(r.answerable).toBe(true);
  });

  it('reports answerable=true for find-readers-of (uses :reads)', async () => {
    const sq: SubQuestion = {
      id: 'SQ-3', text: 'who reads SECRET',
      intent: { kind: 'find-readers-of', payload: { envVar: 'SECRET' } },
    };
    const r = await detector.detect(sq);
    expect(r.answerable).toBe(true);
  });

  it('reports answerable=false and lists missing predicates when TBox lacks them', async () => {
    // Drop :calls from kg:tbox to simulate a missing predicate
    await client.update(`
      PREFIX c: <https://industriagents.com/predicate/codebase#>
      DELETE { GRAPH <kg:tbox> { c:calls ?p ?o } }
      INSERT { GRAPH <kg:meta> { <urn:test:saved-calls> ?p ?o } }
      WHERE  { GRAPH <kg:tbox> { c:calls ?p ?o } }
    `);
    const sq: SubQuestion = {
      id: 'SQ-4', text: 'find callers of f',
      intent: { kind: 'find-callers', payload: { symbol: 'f' } },
    };
    const r = await detector.detect(sq);
    expect(r.answerable).toBe(false);
    expect(r.missingPredicates.map((m) => m.iri)).toContain('https://industriagents.com/predicate/codebase#calls');

    // Restore :calls so subsequent tests see it. Re-load the TBox.
    await client.update(`DROP SILENT GRAPH <kg:tbox>`);
    await client.update(`CREATE SILENT GRAPH <kg:tbox>`);
    await loadTbox('predicate-ontology/catalog/codebase.ttl');
    await loadTbox('predicate-ontology/meta/predicate-meta.ttl');
    await loadTbox('predicate-ontology/catalog/codebase.shacl.ttl');
  });

  it('reports answerable=false for "unknown" sub-questions with a generic gap', async () => {
    const sq: SubQuestion = {
      id: 'SQ-5', text: 'random text',
      intent: { kind: 'unknown', payload: { raw: 'random text' } },
    };
    const r = await detector.detect(sq);
    expect(r.answerable).toBe(false);
    expect(r.missingPredicates).toHaveLength(1);
    expect(r.missingPredicates[0]!.reason).toMatch(/cannot decompose/i);
  });
});
