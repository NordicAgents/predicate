import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { parseModelSpec, makeProvider } from '../src/model-provider.js';
import { RawLogWriter, fixtureSha256, gitSha, type RawCallEntry, type RunManifest } from '../src/pinned/raw-log.js';
import { PinnedProvider } from '../src/pinned/pinned-provider.js';
import { runPinned } from '../src/pinned/flat-pinned-cli.js';

const FIXTURE_DIR = join(import.meta.dirname, '..', 'fixtures', 'conflict-xr-small');
const FAKE_KEY = 'sk-ant-test-SECRET-abcdef0123456789-DO-NOT-PERSIST';

function anthropicOk(text: string): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_x',
      content: [{ type: 'text', text }],
      usage: { input_tokens: 42, output_tokens: 7 },
    }),
    { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_abc123' } },
  );
}

function readEntries(runDir: string): RawCallEntry[] {
  return readdirSync(runDir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(runDir, f), 'utf8')) as RawCallEntry);
}

function allRawText(runDir: string): string {
  return readdirSync(runDir).map((f) => readFileSync(join(runDir, f), 'utf8')).join('\n');
}

describe('PinnedProvider raw logging (AnthropicProvider path, mock fetch)', () => {
  let savedKey: string | undefined;
  beforeAll(() => {
    savedKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = FAKE_KEY;
  });
  afterAll(() => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
  });

  it('(a) persists the verbatim request body and (b) never persists the API key', async () => {
    const base = mkdtempSync(join(tmpdir(), 'pinned-raw-'));
    const writer = new RawLogWriter(base, 'unit-a');
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const provider = new PinnedProvider(makeProvider(parseModelSpec('anthropic:claude-test-1@unit')), writer, {
      fetchImpl: async (input, init): Promise<Response> => {
        seen.push({ url: String(input), init });
        return anthropicOk('{"answer": ["http://ex/a"]}');
      },
    });

    const text = await provider.complete({ system: 'SYS', prompt: 'PROMPT-BODY-1', maxTokens: 64, temperature: 0 });
    expect(text).toBe('{"answer": ["http://ex/a"]}');
    expect(seen).toHaveLength(1);

    const entry = readEntries(writer.runDir)[0]!;
    expect(entry.seq).toBe(1);
    expect(entry.vendor).toBe('anthropic');
    expect(entry.model).toBe('claude-test-1');
    expect(entry.request.url).toBe('https://api.anthropic.com/v1/messages');
    // Verbatim body: exactly what went over the wire.
    expect(entry.request.body).toEqual(JSON.parse(seen[0]!.init!.body as string));
    const body = entry.request.body as Record<string, unknown>;
    expect(body.model).toBe('claude-test-1');
    expect(body.system).toBe('SYS');
    expect(body.max_tokens).toBe(64);
    expect((body.messages as Array<{ content: string }>)[0]!.content).toBe('PROMPT-BODY-1');
    // Headers never persisted; response captured with usage + request id + latency.
    expect(entry.request.headers).toBe('REDACTED');
    expect(entry.response?.status).toBe(200);
    expect(entry.response?.usage).toEqual({ input_tokens: 42, output_tokens: 7 });
    expect(entry.response?.requestId).toBe('req_abc123');
    expect(typeof entry.response?.latencyMs).toBe('number');
    // (b) the key appears NOWHERE under the raw dir.
    expect(allRawText(writer.runDir)).not.toContain(FAKE_KEY);
  });

  it('(c) logs every retry attempt (HTTP 5xx then success) and network failures as separate entries', async () => {
    const base = mkdtempSync(join(tmpdir(), 'pinned-raw-'));
    const writer = new RawLogWriter(base, 'unit-c');
    let call = 0;
    const provider = new PinnedProvider(makeProvider(parseModelSpec('anthropic:claude-test-1@unit')), writer, {
      fetchImpl: async (): Promise<Response> => {
        call += 1;
        if (call === 1) throw new Error('ECONNRESET simulated');
        if (call === 2) return new Response('{"type":"error","error":{"type":"overloaded_error"}}', { status: 529 });
        return anthropicOk('{"answer": true}');
      },
    });

    const text = await provider.complete({ system: 'SYS', prompt: 'RETRY-PROMPT', maxTokens: 32 });
    expect(text).toBe('{"answer": true}');
    expect(call).toBe(3);

    const entries = readEntries(writer.runDir);
    expect(entries).toHaveLength(3);
    expect(entries[0]!.error).toContain('ECONNRESET simulated');
    expect(entries[0]!.response).toBeUndefined();
    expect(entries[1]!.response?.status).toBe(529);
    expect(entries[2]!.response?.status).toBe(200);
    // Every attempt carries the verbatim request body.
    for (const e of entries) {
      expect((e.request.body as Record<string, unknown>).model).toBe('claude-test-1');
      expect(e.request.headers).toBe('REDACTED');
    }
    expect(allRawText(writer.runDir)).not.toContain(FAKE_KEY);
  }, 30_000); // fetchWithRetry backs off 1s + 2s between the three attempts

  it('(d) manifest carries a real git SHA and the fixture hash', () => {
    const base = mkdtempSync(join(tmpdir(), 'pinned-raw-'));
    const writer = new RawLogWriter(base, 'unit-d');
    const manifest: RunManifest = {
      runId: 'unit-d', startedAt: new Date().toISOString(), gitSha: gitSha(),
      domain: 'conflict-xr-small', arm: 'flat-all', models: ['anthropic:claude-test-1'],
      runs: 1, hops: null, temperature: 0, seedPolicy: 'seed=run-index',
      fixtureSha256: fixtureSha256(FIXTURE_DIR), promptSha256: {}, cliArgv: [],
      env: { backend: 'oxigraph-wasm', storePath: ':memory:', baseUrlHost: { anthropic: 'api.anthropic.com' } },
      dryRun: true,
    };
    writer.writeManifest(manifest);
    const onDisk = JSON.parse(readFileSync(join(writer.runDir, 'manifest.json'), 'utf8')) as RunManifest;
    expect(onDisk.gitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(onDisk.fixtureSha256).toMatch(/^[0-9a-f]{64}$/);
    // Deterministic over the frozen fixture.
    expect(fixtureSha256(FIXTURE_DIR)).toBe(onDisk.fixtureSha256);
    expect(allRawText(writer.runDir)).not.toContain(FAKE_KEY);
  });
});

describe('dry-run end-to-end (conflict-xr-small, MockProvider, zero network)', () => {
  it('writes >=1 raw file per task, a valid manifest, and scoreboard rows with rawRef', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'pinned-results-'));
    const { rows, writer, scoreboardFile, manifest } = await runPinned(getAdapter(), {
      domain: 'conflict-xr-small', arm: 'flat-all', modelsCsv: 'anthropic:claude-mock-1@weak',
      runs: 1, hops: 2, dryRun: true, resultsDir, cliArgv: ['conflict-xr-small', '--arm', 'flat-all', '--dry-run'],
    });

    const taskCount = 8; // conflict-xr-small has 8 questions
    expect(rows).toHaveLength(taskCount);

    // Raw tree: one call per task (mock never retries) + manifest.
    const entries = readEntries(writer.runDir);
    expect(entries.length).toBeGreaterThanOrEqual(taskCount);
    expect(existsSync(join(writer.runDir, 'manifest.json'))).toBe(true);
    for (const e of entries) {
      expect(e.response?.status).toBe(200);
      expect(e.response?.usage).toBeDefined();
      expect(e.request.headers).toBe('REDACTED');
    }

    // Manifest validity.
    const onDisk = JSON.parse(readFileSync(join(writer.runDir, 'manifest.json'), 'utf8')) as RunManifest;
    expect(onDisk.runId).toBe(manifest.runId);
    expect(onDisk.gitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(onDisk.fixtureSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(onDisk.promptSha256)).toHaveLength(taskCount);
    for (const sha of Object.values(onDisk.promptSha256)) expect(sha).toMatch(/^[0-9a-f]{64}$/);
    expect(onDisk.models).toEqual(['anthropic:claude-mock-1']);
    expect(onDisk.dryRun).toBe(true);
    expect(onDisk.env.baseUrlHost).toEqual({ anthropic: 'api.anthropic.com' });

    // Scoreboard rows: parsed deterministic answers, rawRef points at a real file.
    const lines = readFileSync(scoreboardFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as (typeof rows)[number]);
    expect(lines).toHaveLength(taskCount);
    for (const row of lines) {
      expect(row.parsed).toBe(true); // canned answers always parse
      expect(row.rawRef?.runId).toBe(manifest.runId);
      const seq = row.rawRef!.seq;
      expect(existsSync(join(writer.runDir, `${String(seq).padStart(4, '0')}.json`))).toBe(true);
    }
    // Boolean questions get {"answer": false}: t1F1 for a true-keyed boolean must then
    // exceed the flat score — sanity that scoring really ran against Tier 1.
    expect(rows.some((r) => r.reasonerAdvantage > 0)).toBe(true);
  }, 240_000);
});
