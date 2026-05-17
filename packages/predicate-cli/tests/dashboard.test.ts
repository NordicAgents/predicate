import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { startDashboardServer, type DashboardServerHandle } from '../src/commands/dashboard.js';
import { withCodebaseTBox } from 'predicate-mcp/tests/fixtures/with-codebase.js';

let handle: DashboardServerHandle | undefined;

beforeAll(async () => { await withCodebaseTBox(); });

afterEach(async () => {
  if (handle) { await handle.close(); handle = undefined; }
});

describe('predicate dashboard server', () => {
  it('serves the dashboard HTML on GET /', async () => {
    handle = await startDashboardServer(0);  // port 0 = OS-assigned
    const r = await fetch(handle.url + '/');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/html');
    const body = await r.text();
    expect(body).toContain('<title>Predicate Dashboard</title>');
    expect(body).toContain('/api/query');
  });

  it('returns 404 for unknown paths', async () => {
    handle = await startDashboardServer(0);
    const r = await fetch(handle.url + '/nope');
    expect(r.status).toBe(404);
  });

  it('proxies SPARQL queries to Fuseki on POST /api/query', async () => {
    handle = await startDashboardServer(0);
    const r = await fetch(handle.url + '/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'query=' + encodeURIComponent('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:tbox> { ?s ?p ?o } }'),
    });
    expect(r.status).toBe(200);
    const json = await r.json() as { results: { bindings: Array<{ n: { value: string } }> } };
    expect(parseInt(json.results.bindings[0]!.n.value, 10)).toBeGreaterThan(0);
  });
});
