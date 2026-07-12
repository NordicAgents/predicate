/**
 * PinnedProvider: wraps any ModelProvider from src/model-provider.ts and gives
 * it complete raw logging (publication plan §10) WITHOUT modifying the provider
 * code. Interception happens at the fetch level — the providers resolve the
 * global `fetch` on every attempt, so swapping it for the duration of a single
 * `complete()` call captures each retry attempt and each network failure as its
 * own raw-log entry, with verbatim request/response bodies and latency.
 *
 * The measurement loop is strictly sequential (one in-flight completion at a
 * time — same shape as flat-auto), so the patch/restore of globalThis.fetch is
 * safe. Do not use this class with concurrent complete() calls.
 *
 * MockProvider: the --dry-run arm. It routes the REAL provider's request
 * construction through a canned, deterministic, zero-network fetch, so the
 * dry run exercises the exact production request/response/logging path.
 */
import type { CompletionRequest, ModelProvider, ModelSpec } from '../model-provider.js';
import { makeProvider } from '../model-provider.js';
import { sanitizeUrl, type RawLogWriter } from './raw-log.js';

type FetchInput = Parameters<typeof fetch>[0];
type FetchLike = (input: FetchInput, init?: RequestInit) => Promise<Response>;

export interface PinnedProviderOptions {
  /** Underlying transport. Defaults to the real global fetch; tests and --dry-run inject their own. */
  fetchImpl?: FetchLike;
}

function urlOf(input: FetchInput): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function parseMaybeJson(text: string | undefined): unknown {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class PinnedProvider implements ModelProvider {
  readonly spec: ModelSpec;
  readonly keyEnv: string;

  constructor(
    private readonly inner: ModelProvider,
    readonly writer: RawLogWriter,
    private readonly opts: PinnedProviderOptions = {},
  ) {
    this.spec = inner.spec;
    this.keyEnv = inner.keyEnv;
  }

  isAvailable(): boolean {
    return this.inner.isAvailable();
  }

  /** Log one attempt (request always; response when the transport answered). */
  private record(
    url: string,
    init: RequestInit | undefined,
    outcome: { status: number; bodyText: string; latencyMs: number; headers: Headers } | { error: string },
  ): void {
    const requestBody = parseMaybeJson(typeof init?.body === 'string' ? init.body : undefined);
    if ('error' in outcome) {
      this.writer.logCall({
        vendor: this.spec.vendor,
        model: this.spec.model,
        request: { url: sanitizeUrl(url), body: requestBody, headers: 'REDACTED' },
        error: outcome.error,
      });
      return;
    }
    const responseBody = parseMaybeJson(outcome.bodyText);
    const usage =
      responseBody && typeof responseBody === 'object' && 'usage' in responseBody
        ? (responseBody as { usage: unknown }).usage
        : undefined;
    const requestId = outcome.headers.get('request-id') ?? outcome.headers.get('x-request-id') ?? undefined;
    this.writer.logCall({
      vendor: this.spec.vendor,
      model: this.spec.model,
      request: { url: sanitizeUrl(url), body: requestBody, headers: 'REDACTED' },
      response: {
        status: outcome.status,
        body: responseBody,
        latencyMs: outcome.latencyMs,
        ...(usage !== undefined ? { usage } : {}),
        ...(requestId ? { requestId } : {}),
      },
    });
  }

  async complete(req: CompletionRequest): Promise<string> {
    const transport: FetchLike = this.opts.fetchImpl ?? globalThis.fetch;
    const loggingFetch: FetchLike = async (input, init) => {
      const url = urlOf(input);
      const started = Date.now();
      let res: Response;
      try {
        res = await transport(input, init);
      } catch (e) {
        this.record(url, init, { error: String(e) });
        throw e;
      }
      const latencyMs = Date.now() - started;
      const bodyText = await res.text();
      this.record(url, init, { status: res.status, bodyText, latencyMs, headers: res.headers });
      // The inner provider still needs to consume the body — hand it a clone.
      return new Response(bodyText.length ? bodyText : null, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    };

    const saved = globalThis.fetch;
    globalThis.fetch = loggingFetch as typeof globalThis.fetch;
    try {
      return await this.inner.complete(req);
    } finally {
      globalThis.fetch = saved;
    }
  }
}

/**
 * Canned deterministic transport for --dry-run: parses the outgoing request to
 * decide the answer shape (boolean questions get {"answer": false}, set /
 * conflict questions get {"answer": []}), and answers in the vendor's wire
 * format (chosen by URL) with synthetic usage numbers and a mock request id.
 * Zero network.
 */
export const mockFetch: FetchLike = async (input, init) => {
  const url = urlOf(input);
  const bodyText = typeof init?.body === 'string' ? init.body : '';
  const answer = bodyText.includes('Question (boolean)') ? '{"answer": false}' : '{"answer": []}';
  const inTokens = Math.ceil(bodyText.length / 4);
  const body = url.includes('api.anthropic.com')
    ? {
        id: 'msg_mock',
        model: 'mock',
        content: [{ type: 'text', text: answer }],
        usage: { input_tokens: inTokens, output_tokens: 8 },
      }
    : {
        id: 'chatcmpl_mock',
        model: 'mock',
        choices: [{ index: 0, message: { role: 'assistant', content: answer } }],
        usage: { prompt_tokens: inTokens, completion_tokens: 8, total_tokens: inTokens + 8 },
      };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', 'request-id': 'mock-request-id' },
  });
};

/**
 * The --dry-run provider: the REAL vendor provider (verbatim request bodies,
 * production response parsing) wired to the canned mockFetch transport, fully
 * raw-logged. No API key and no network required.
 */
export class MockProvider extends PinnedProvider {
  constructor(spec: ModelSpec, writer: RawLogWriter) {
    super(makeProvider(spec), writer, { fetchImpl: mockFetch });
  }

  override isAvailable(): boolean {
    return true; // canned transport — no key needed
  }
}
