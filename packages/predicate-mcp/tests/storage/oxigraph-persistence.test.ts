import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OxigraphAdapter } from '../../src/storage/oxigraph.js';

describe('OxigraphAdapter file-backed persistence', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'predicate-oxi-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('persists asserted triples across adapter restarts', async () => {
    const a = new OxigraphAdapter({ storePath: dir });
    await a.ready();
    await a.update(`INSERT DATA { GRAPH <kg:abox> { <urn:x> <urn:p> "persisted" } }`);
    await a.close();

    const b = new OxigraphAdapter({ storePath: dir });
    await b.ready();
    const r = await b.select(`SELECT ?o WHERE { GRAPH <kg:abox> { <urn:x> <urn:p> ?o } }`);
    expect(r.results.bindings.map((x) => x['o']!.value)).toEqual(['persisted']);
    await b.close();
  });

  it('clearGraph removes data and survives restart', async () => {
    const a = new OxigraphAdapter({ storePath: dir });
    await a.ready();
    await a.update(`INSERT DATA { GRAPH <kg:abox> { <urn:x> <urn:p> "temp" } }`);
    await a.clearGraph('kg:abox');
    await a.close();

    const b = new OxigraphAdapter({ storePath: dir });
    await b.ready();
    const r = await b.ask(`ASK { GRAPH <kg:abox> { ?s ?p ?o } }`);
    expect(r).toBe(false);
    await b.close();
  });

  it('reloads persisted data on first query even when ready() is never called', async () => {
    const a = new OxigraphAdapter({ storePath: dir });
    await a.ready();
    await a.update(`INSERT DATA { GRAPH <kg:abox> { <urn:x> <urn:p> "persisted" } }`);
    await a.close();

    // Production code (MCP server boot, read CLIs) never calls ready().
    // A fresh adapter must still surface persisted data lazily.
    const b = new OxigraphAdapter({ storePath: dir });
    const r = await b.select(`SELECT ?o WHERE { GRAPH <kg:abox> { <urn:x> <urn:p> ?o } }`);
    expect(r.results.bindings.map((x) => x['o']!.value)).toEqual(['persisted']);
    await b.close();
  });

  it('lazy-loads the same data only once across multiple queries', async () => {
    const a = new OxigraphAdapter({ storePath: dir });
    await a.ready();
    await a.update(`INSERT DATA { GRAPH <kg:abox> { <urn:x> <urn:p> "v" } }`);
    await a.close();

    const b = new OxigraphAdapter({ storePath: dir });
    await b.select(`SELECT * WHERE { GRAPH <kg:abox> { ?s ?p ?o } }`);
    const r = await b.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }`);
    expect(r.results.bindings[0]!['n']!.value).toBe('1');
    await b.close();
  });

  it(':memory: writes no files', async () => {
    const a = new OxigraphAdapter({ storePath: ':memory:' });
    await a.ready();
    await a.update(`INSERT DATA { GRAPH <kg:abox> { <urn:x> <urn:p> "v" } }`);
    await a.close();
    expect(readdirSync(dir)).toEqual([]);
  });
});
