import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { startDashboardServer, type DashboardServerHandle } from '../src/commands/dashboard.js';
import { withCodebaseTBox } from 'predicate-mcp/tests/fixtures/with-codebase.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { SchemaProposer } from 'predicate-agent/src/schema-proposer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let handle: DashboardServerHandle | undefined;
let promotedDir: string;

beforeAll(async () => {
  await withCodebaseTBox();
  // Point the spawned child at the workspace bundle so it has the latest
  // schema verb without depending on the global install being current.
  const skillPkg = resolve(__dirname, '..', '..', 'predicate-skill');
  process.env.PREDICATE_CLI_BIN = 'node';
  process.env.PREDICATE_CLI_ARGS = resolve(skillPkg, 'cli.bundle.mjs');
  promotedDir = mkdtempSync(join(tmpdir(), 'predicate-promoted-'));
  process.env.PREDICATE_PROMOTED_DIR = promotedDir;
}, 60_000);

afterAll(() => {
  delete process.env.PREDICATE_CLI_BIN;
  delete process.env.PREDICATE_CLI_ARGS;
  delete process.env.PREDICATE_PROMOTED_DIR;
  rmSync(promotedDir, { recursive: true, force: true });
});

afterEach(async () => { if (handle) { await handle.close(); handle = undefined; } });

async function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/action', () => {
  it('rejects unknown verbs with 400', async () => {
    handle = await startDashboardServer(0);
    const r = await post(handle.url + '/api/action', { verb: 'evil', proposalId: 'urn:predicate:proposal:x' });
    expect(r.status).toBe(400);
  });

  it('rejects shell-metacharacter IRIs with 400', async () => {
    handle = await startDashboardServer(0);
    const r = await post(handle.url + '/api/action', {
      verb: 'reject',
      proposalId: 'urn:predicate:proposal:`rm -rf /`',
    });
    expect(r.status).toBe(400);
  });

  it('approves a real proposal end-to-end', async () => {
    const client = getAdapter();
    await client.update('DROP SILENT GRAPH <kg:tbox-staging>');
    await client.update('CREATE SILENT GRAPH <kg:tbox-staging>');
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: 'https://predicate.dev/codebase#httpApproveTest',
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'http-test' });

    handle = await startDashboardServer(0);
    const r = await post(handle.url + '/api/action', { verb: 'approve', proposalId: id });
    expect(r.status).toBe(200);
    const json = await r.json() as { ok: boolean; exitCode: number; stdout: string };
    expect(json.ok).toBe(true);
    expect(json.exitCode).toBe(0);
    const parsedCliOutput = JSON.parse(json.stdout) as { outcome: string };
    expect(parsedCliOutput.outcome).toBe('promoted');
  });
});
