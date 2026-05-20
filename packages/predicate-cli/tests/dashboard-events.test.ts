import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { startDashboardServer, type DashboardServerHandle } from '../src/commands/dashboard.js';
import { withCodebaseTBox } from 'predicate-mcp/tests/fixtures/with-codebase.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { SchemaProposer } from 'predicate-agent/src/schema-proposer.js';

// The dashboard server polls Fuseki's HTTP endpoint directly for the digest.
// Tests that verify the change event require Fuseki to see the mutations.
const isFuseki = (process.env['PREDICATE_BACKEND'] ?? 'fuseki') === 'fuseki';

let handle: DashboardServerHandle | undefined;

beforeAll(async () => { await withCodebaseTBox(); });
afterEach(async () => { if (handle) { await handle.close(); handle = undefined; } });

async function readSseUntil(url: string, predicate: (evt: { event: string; data: string }) => boolean, timeoutMs = 5000): Promise<{ event: string; data: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const r = await fetch(url, { signal: ctrl.signal });
  const reader = r.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const ev = { event: 'message', data: '' };
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) ev.event = line.slice(6).trim();
          else if (line.startsWith('data:')) ev.data = line.slice(5).trim();
        }
        if (ev.data && predicate(ev)) {
          ctrl.abort();
          clearTimeout(t);
          return ev;
        }
      }
    }
  } finally {
    clearTimeout(t);
  }
  throw new Error('SSE stream ended without matching event');
}

describe.skipIf(!isFuseki)('GET /api/events', () => {
  it('emits an initial digest event on connect', async () => {
    handle = await startDashboardServer(0);
    const ev = await readSseUntil(handle.url + '/api/events', (e) => e.event === 'digest');
    expect(ev.event).toBe('digest');
    const data = JSON.parse(ev.data) as { sessions: number; staging: number; inferred: number };
    expect(typeof data.sessions).toBe('number');
    expect(typeof data.staging).toBe('number');
  });

  it.skipIf(!isFuseki)('broadcasts a change event when staging count changes', async () => {
    handle = await startDashboardServer(0);
    const url = handle.url + '/api/events';
    const changePromise = readSseUntil(
      url,
      (e) => e.event === 'change' && JSON.parse(e.data).changed.includes('staging'),
      8000,
    );
    // Give the server a moment to attach the client and snapshot the digest.
    await new Promise((r) => setTimeout(r, 1500));
    const client = getAdapter();
    const proposer = new SchemaProposer(client);
    await proposer.propose({
      kind: 'add-property',
      add: [{
        s: 'https://predicate.dev/codebase#sseTest',
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'sse-test' });
    const ev = await changePromise;
    expect(JSON.parse(ev.data).changed).toContain('staging');
  });
});
