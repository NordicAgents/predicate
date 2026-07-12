/**
 * Complete raw logging for pinned-model eval runs (publication plan §9/§10:
 * "publish all prompts, raw responses, versions, seeds, token counts, and
 * failures"). Every HTTP attempt a provider makes — including retries and
 * network failures — becomes one numbered JSON file under
 * results/raw/<runId>/NNNN.json, and the run's full configuration (git SHA,
 * fixture hash, per-task prompt hashes, CLI argv, env summary) is written to
 * results/raw/<runId>/manifest.json.
 *
 * Secrets policy: request headers are NEVER persisted (stored as the literal
 * string "REDACTED"), and every serialized byte is additionally scrubbed
 * against the values of the known API-key env vars before hitting disk.
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Env vars whose values must never appear anywhere under results/raw. */
const SECRET_ENV_VARS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'] as const;
/** Any env var matching this is treated as a secret too (gateway keys, OPENROUTER_API_KEY, ...). */
const SECRET_ENV_PATTERN = /(_API_KEY|_TOKEN|_SECRET|_PASSWORD|_CREDENTIALS?)$/;

function secretEnvValues(): string[] {
  const values = new Set<string>();
  for (const name of SECRET_ENV_VARS) {
    const v = process.env[name];
    if (v && v.length >= 8) values.add(v);
  }
  for (const [name, v] of Object.entries(process.env)) {
    if (SECRET_ENV_PATTERN.test(name) && v && v.length >= 8) values.add(v);
  }
  return [...values];
}

/**
 * Persistable form of a request URL: origin + pathname only. Userinfo and the
 * query string are dropped entirely — OPENAI_BASE_URL gateway configs can
 * carry credentials in either (user:pass@host, ?api_key=...), and no vendor
 * request we log needs the query to be reproducible.
 */
export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const dropped = u.search !== '' || u.username !== '' || u.password !== '';
    return `${u.origin}${u.pathname}${dropped ? ' [userinfo/query REDACTED]' : ''}`;
  } catch {
    return 'UNPARSEABLE_URL_REDACTED';
  }
}

export interface RawCallRequest {
  /** Sanitized via sanitizeUrl(): origin + pathname only, never userinfo or query. */
  url: string;
  /** Verbatim request body (parsed JSON when possible). Never contains keys — those live in headers. */
  body: unknown;
  /** Headers are never persisted. */
  headers: 'REDACTED';
}

export interface RawCallResponse {
  status: number;
  /** Verbatim response body (parsed JSON when possible, else the raw text). */
  body: unknown;
  latencyMs: number;
  /** Token usage as reported by the vendor (anthropic: input/output_tokens; openai: prompt/completion_tokens). */
  usage?: unknown;
  /** Provider request id (anthropic `request-id`, openai `x-request-id`) when present. */
  requestId?: string;
}

export interface RawCallEntry {
  seq: number;
  timestamp: string;
  vendor: string;
  model: string;
  request: RawCallRequest;
  response?: RawCallResponse;
  /** Set when the fetch attempt itself failed (network error) — the response is then absent. */
  error?: string;
}

export interface RunManifest {
  runId: string;
  startedAt: string;
  gitSha: string;
  domain: string;
  arm: string;
  models: string[];
  runs: number;
  hops: number | null;
  temperature: number;
  seedPolicy: string;
  /** sha256 over world.ttl + episodes/*.jsonl + oracle.json + questions.json. */
  fixtureSha256: string;
  /** taskId -> sha256 of the exact prompt string sent for that task. */
  promptSha256: Record<string, string>;
  cliArgv: string[];
  env: {
    backend: string | null;
    storePath: string | null;
    /** Host component only — never the full base URL (may embed credentials). */
    baseUrlHost: Record<string, string>;
  };
  dryRun: boolean;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Deterministic hash of the frozen fixture inputs: world.ttl + episodes/*.jsonl (sorted) + oracle.json + questions.json. */
export function fixtureSha256(fixtureDir: string): string {
  const h = createHash('sha256');
  const files = [
    'world.ttl',
    ...readdirSync(join(fixtureDir, 'episodes'))
      .filter((f) => f.endsWith('.jsonl'))
      .sort()
      .map((f) => join('episodes', f)),
    'oracle.json',
    'questions.json',
  ];
  for (const rel of files) {
    h.update(rel);
    h.update('\n');
    h.update(readFileSync(join(fixtureDir, rel)));
    h.update('\n');
  }
  return h.digest('hex');
}

/** Current commit SHA, or "unknown" outside a git checkout. */
export function gitSha(cwd?: string): string {
  try {
    return execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export class RawLogWriter {
  readonly runId: string;
  readonly runDir: string;
  private seq = 0;
  /** seq of the most recently written call entry (0 = none yet). */
  lastSeq = 0;

  /** rawBaseDir is typically <package>/results/raw; the writer owns rawBaseDir/<runId>/. */
  constructor(rawBaseDir: string, runId: string) {
    this.runId = runId;
    this.runDir = join(rawBaseDir, runId);
    mkdirSync(this.runDir, { recursive: true });
  }

  /** Belt-and-braces: strip any known secret value from a serialized payload. */
  private scrub(text: string): string {
    let out = text;
    for (const value of secretEnvValues()) {
      out = out.split(value).join('REDACTED');
      // Values also appear JSON-escaped inside serialized bodies; scrub that form too.
      out = out.split(JSON.stringify(value).slice(1, -1)).join('REDACTED');
    }
    return out;
  }

  /** Persist one HTTP attempt as NNNN.json; returns the assigned seq. */
  logCall(entry: Omit<RawCallEntry, 'seq' | 'timestamp'>): number {
    this.seq += 1;
    this.lastSeq = this.seq;
    const full: RawCallEntry = { seq: this.seq, timestamp: new Date().toISOString(), ...entry };
    const file = join(this.runDir, `${String(this.seq).padStart(4, '0')}.json`);
    writeFileSync(file, this.scrub(JSON.stringify(full, null, 2)) + '\n');
    return this.seq;
  }

  writeManifest(manifest: RunManifest): void {
    writeFileSync(join(this.runDir, 'manifest.json'), this.scrub(JSON.stringify(manifest, null, 2)) + '\n');
  }
}
