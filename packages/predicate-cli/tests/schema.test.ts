import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { SchemaProposer } from 'predicate-agent/src/schema-proposer.js';
import { schema } from '../src/commands/schema.js';

const client = getAdapter();
const C = 'https://predicate.dev/codebase';

let promotedDir: string;

beforeAll(() => {
  promotedDir = mkdtempSync(join(tmpdir(), 'predicate-promoted-'));
  process.env['PREDICATE_PROMOTED_DIR'] = promotedDir;
});

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

const RESET_GRAPHS = ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:inferred', 'kg:tbox'];

beforeEach(async () => {
  for (const g of RESET_GRAPHS) { await reset(g); }
});

afterAll(async () => {
  for (const g of RESET_GRAPHS) { await reset(g); }
  delete process.env['PREDICATE_PROMOTED_DIR'];
  rmSync(promotedDir, { recursive: true, force: true });
});

async function captureStdout<T>(fn: () => Promise<T>): Promise<{ result: T; out: string }> {
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((c: string | Uint8Array) => {
    chunks.push(typeof c === 'string' ? c : Buffer.from(c).toString('utf8'));
    return true;
  }) as typeof process.stdout.write;
  try {
    const result = await fn();
    return { result, out: chunks.join('') };
  } finally {
    process.stdout.write = orig;
  }
}

describe('predicate schema list', () => {
  it('returns proposals as a JSON array', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#listed`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'test' });

    const { result: code, out } = await captureStdout(() => schema(['list']));
    expect(code).toBe(0);

    const parsed = JSON.parse(out) as Array<{ id: string; kind: string; useCount: number }>;
    expect(parsed.some((p) => p.id === id && p.kind === 'add-property' && p.useCount === 0)).toBe(true);
  });
});

describe('predicate schema approve', () => {
  it('promotes the proposal and prints {ok:true,outcome:"promoted"}', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#approveTest`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'test' });

    const { result: code, out } = await captureStdout(() => schema(['approve', id]));
    expect(code).toBe(0);
    const result = JSON.parse(out) as { ok: boolean; outcome: string };
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('promoted');
  });

  it('exits 2 and prints usage when the id is missing', async () => {
    const code = await schema(['approve']);
    expect(code).toBe(2);
  });
});

describe('predicate schema reject', () => {
  it('removes the proposal and prints {ok:true,outcome:"rejected-expired"}', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#rejectTest`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'test' });

    const { result: code, out } = await captureStdout(() => schema(['reject', id]));
    expect(code).toBe(0);
    const result = JSON.parse(out) as { ok: boolean; outcome: string };
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('rejected-expired');
  });
});
