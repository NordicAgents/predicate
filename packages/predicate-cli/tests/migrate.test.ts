import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FusekiAdapter } from 'predicate-mcp/src/storage/fuseki.js';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/oxigraph.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { migrate } from '../src/commands/migrate.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';

let tmpDir: string;
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'predicate-migrate-'));
  process.env.PREDICATE_STORE_PATH = tmpDir;
});
afterEach(() => {
  delete process.env.PREDICATE_STORE_PATH;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('migrate fuseki → oxigraph', () => {
  it('round-trips a 1k-triple ABox with count parity', async () => {
    const cfg = loadConfig();
    const src = new FusekiAdapter(cfg);
    await src.ready();
    await src.clearGraph(GRAPH.abox);

    // Seed 1k triples.
    const inserts: string[] = [];
    for (let i = 0; i < 1000; i++) {
      inserts.push(`<urn:s${i}> <urn:p> "v${i}" .`);
    }
    await src.loadTurtle(inserts.join('\n'), GRAPH.abox);

    const rc = await migrate(['--from', 'fuseki', '--to', 'oxigraph']);
    expect(rc).toBe(0);

    const dst = new OxigraphAdapter({ storePath: cfg.oxigraphStorePath });
    await dst.ready();
    const r = await dst.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${GRAPH.abox}> { ?s ?p ?o } }`);
    expect(r.results.bindings[0]?.n?.value).toBe('1000');
  });
});
