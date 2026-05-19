import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';

import { ld } from '../src/commands/ld.js';
import { peer } from '../src/commands/peer.js';

const client = getAdapter();

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:peers>`);
  await client.update(`CREATE SILENT GRAPH <kg:peers>`);
}

describe('predicate ld', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  const realFetch = global.fetch;

  beforeEach(async () => {
    await reset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    global.fetch = realFetch;
  });

  it('ld init adds DBpedia + Wikidata to kg:peers with peerKind=external-ld', async () => {
    const code = await ld(['init']);
    expect(code).toBe(0);

    const r = await client.select(
      `PREFIX pred: <https://predicate.dev/meta#>
       SELECT ?name ?endpoint ?kind WHERE {
         GRAPH <kg:peers> {
           ?p a pred:Peer ;
              pred:peerName ?name ;
              pred:peerEndpoint ?endpoint ;
              pred:peerKind ?kind .
         }
       } ORDER BY ?name`,
    );
    const rows = r.results.bindings.map((b) => ({
      name: b['name']!.value,
      endpoint: b['endpoint']!.value,
      kind: b['kind']!.value,
    }));
    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe('dbpedia');
    expect(rows[0]!.endpoint).toBe('https://dbpedia.org/sparql');
    expect(rows[0]!.kind).toBe('external-ld');
    expect(rows[1]!.name).toBe('wikidata');
    expect(rows[1]!.endpoint).toBe('https://query.wikidata.org/sparql');
    expect(rows[1]!.kind).toBe('external-ld');
  });

  it('ld init is idempotent (second call adds nothing)', async () => {
    await ld(['init']);
    logSpy.mockClear();
    const code = await ld(['init']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('0 added');
    expect(out).toContain('2 already present');

    // Still only 2 rows after second init.
    const r = await client.select(
      `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:peers> { ?p a <https://predicate.dev/meta#Peer> } }`,
    );
    expect(r.results.bindings[0]!['n']!.value).toBe('2');
  });

  it('ld list shows only external-ld peers, filters out team peers', async () => {
    // Add a team peer + run ld init.
    await peer(['add', 'alice', 'http://alice.local:3030/predicate/query']);
    await ld(['init']);
    logSpy.mockClear();

    const code = await ld(['list', '--json']);
    expect(code).toBe(0);
    const jsonCall = logSpy.mock.calls.map((c) => c[0] as string).find((s) => s.trim().startsWith('['));
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall!) as Array<{ name: string; endpoint: string }>;
    expect(parsed).toHaveLength(2);
    expect(parsed.map((p) => p.name).sort()).toEqual(['dbpedia', 'wikidata']);
    // alice (team peer) must not appear in ld list.
    expect(parsed.find((p) => p.name === 'alice')).toBeUndefined();
  });

  it('ld ask errors with exit 2 if no LD peers registered', async () => {
    const code = await ld(['ask', 'SELECT * WHERE { ?s ?p ?o } LIMIT 1']);
    expect(code).toBe(2);
    const err = errSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(err).toContain('no external-ld peers registered');
  });

  it('ld ask parses mocked response and prints rows (fetch is mocked — no real network)', async () => {
    await ld(['init']);
    logSpy.mockClear();

    // Mock global.fetch — pass through Fuseki calls (used by SparqlClient
    // to look up the registered LD peers), intercept the external LD
    // endpoints with a canned SPARQL JSON results payload. This keeps the
    // test offline-safe: nothing reaches real DBpedia/Wikidata.
    const mockResponse = {
      head: { vars: ['label'] },
      results: {
        bindings: [
          { label: { type: 'literal', value: 'JavaScript Object Notation' } },
        ],
      },
    };
    const ldCalls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('dbpedia.org') || u.includes('query.wikidata.org')) {
        ldCalls.push({ url: u, init });
        return {
          ok: true,
          status: 200,
          json: async () => mockResponse,
        } as unknown as Response;
      }
      return realFetch(url, init);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const code = await ld(['ask', 'SELECT ?label WHERE { ?s rdfs:label ?label } LIMIT 1', '--json']);
    expect(code).toBe(0);
    // One LD fetch per registered external-ld peer (2 of them).
    expect(ldCalls).toHaveLength(2);
    for (const call of ldCalls) {
      expect(call.url).toMatch(/^https:\/\/(dbpedia\.org|query\.wikidata\.org)\/sparql$/);
    }
    const jsonCall = logSpy.mock.calls.map((c) => c[0] as string).find((s) => s.trim().startsWith('['));
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall!) as Array<{ peer: string; binding: Record<string, { value: string }> }>;
    expect(parsed).toHaveLength(2);
    expect(parsed.map((r) => r.peer).sort()).toEqual(['dbpedia', 'wikidata']);
    expect(parsed[0]!.binding['label']!.value).toBe('JavaScript Object Notation');
  });

  it('--help prints usage and returns 0', async () => {
    const code = await ld(['--help']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('predicate ld');
    expect(out).toContain('init');
    expect(out).toContain('list');
    expect(out).toContain('ask');
  });
});
