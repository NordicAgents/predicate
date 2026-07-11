/**
 * E1 (AAAI plan §5): a pinned, vendor-agnostic model provider for unattended,
 * reproducible multi-model eval runs.
 *
 * Deliberately dependency-free — it talks to the Anthropic and OpenAI REST APIs
 * over the global `fetch` (Node 18+), so the eval harness can sweep model tiers
 * without pulling an SDK into `predicate-eval` or touching the workspace install.
 * Every request pins {vendor, model, temperature=0, seed?} and records enough to
 * reproduce the run.
 *
 * A model is named by a spec string:  "<vendor>:<model>"  (vendor defaults to
 * anthropic).  Optionally append "@<tier>" for a display label:
 *   anthropic:claude-haiku-4-5-20251001@weak
 *   anthropic:claude-opus-4-8@frontier
 *   openai:gpt-4o@frontier
 * For OpenAI-compatible gateways (OpenRouter, Together, a local server), set
 * OPENAI_BASE_URL and use the `openai:` vendor.
 */

export type Vendor = 'anthropic' | 'openai';

export interface ModelSpec {
  spec: string; // canonical "vendor:model"
  vendor: Vendor;
  model: string;
  label: string; // short display label
  tier: string; // informational: weak | mid | frontier | <custom>
}

export interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  temperature?: number; // default 0
  seed?: number; // honored where the vendor supports it (OpenAI); ignored by Anthropic
}

export interface ModelProvider {
  readonly spec: ModelSpec;
  /** Whether the required API key is present in the environment. */
  isAvailable(): boolean;
  /** The env var this provider needs (for a helpful error message). */
  readonly keyEnv: string;
  complete(req: CompletionRequest): Promise<string>;
}

const ANTHROPIC_VERSION = '2023-06-01';
const MAX_RETRIES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry on 429 / 5xx (incl. Anthropic's 529 overloaded) with exponential backoff. */
async function fetchWithRetry(url: string, init: RequestInit, label: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status === 529 || (res.status >= 500 && res.status < 600)) {
        if (attempt === MAX_RETRIES) return res;
        const backoff = 1000 * 2 ** attempt;
        process.stderr.write(`  [${label}] HTTP ${res.status}, retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})\n`);
        await sleep(backoff);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt === MAX_RETRIES) break;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw new Error(`[${label}] network failure after ${MAX_RETRIES} retries: ${String(lastErr)}`);
}

class AnthropicProvider implements ModelProvider {
  readonly keyEnv = 'ANTHROPIC_API_KEY';
  constructor(readonly spec: ModelSpec) {}

  isAvailable(): boolean {
    return Boolean(process.env[this.keyEnv]);
  }

  async complete(req: CompletionRequest): Promise<string> {
    const res = await fetchWithRetry(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'x-api-key': process.env[this.keyEnv] ?? '',
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.spec.model,
          max_tokens: req.maxTokens,
          temperature: req.temperature ?? 0,
          system: req.system,
          messages: [{ role: 'user', content: req.prompt }],
        }),
      },
      this.spec.label,
    );
    if (!res.ok) {
      throw new Error(`[${this.spec.spec}] Anthropic API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    return (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n');
  }
}

class OpenAiProvider implements ModelProvider {
  readonly keyEnv = 'OPENAI_API_KEY';
  constructor(readonly spec: ModelSpec) {}

  isAvailable(): boolean {
    return Boolean(process.env[this.keyEnv]);
  }

  async complete(req: CompletionRequest): Promise<string> {
    const base = process.env['OPENAI_BASE_URL'] ?? 'https://api.openai.com/v1';
    const body: Record<string, unknown> = {
      model: this.spec.model,
      max_tokens: req.maxTokens,
      temperature: req.temperature ?? 0,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.prompt },
      ],
    };
    if (typeof req.seed === 'number') body['seed'] = req.seed;
    const res = await fetchWithRetry(
      `${base.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env[this.keyEnv] ?? ''}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      this.spec.label,
    );
    if (!res.ok) {
      throw new Error(`[${this.spec.spec}] OpenAI API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }
}

/** Parse "vendor:model@tier" (vendor optional, defaults anthropic; @tier optional). */
export function parseModelSpec(raw: string): ModelSpec {
  const [specPart, tierPart] = raw.split('@');
  const trimmed = (specPart ?? '').trim();
  let vendor: Vendor = 'anthropic';
  let model = trimmed;
  const colon = trimmed.indexOf(':');
  if (colon > 0) {
    const v = trimmed.slice(0, colon).trim().toLowerCase();
    if (v === 'anthropic' || v === 'openai') {
      vendor = v;
      model = trimmed.slice(colon + 1).trim();
    }
  }
  if (!model) throw new Error(`invalid model spec: "${raw}"`);
  const label = model.replace(/-\d{8}$/, '').replace(/^(claude|gpt)-/, '');
  return { spec: `${vendor}:${model}`, vendor, model, label, tier: (tierPart ?? '').trim() || 'unspecified' };
}

export function makeProvider(spec: ModelSpec): ModelProvider {
  return spec.vendor === 'openai' ? new OpenAiProvider(spec) : new AnthropicProvider(spec);
}

/**
 * The default weak→frontier ladder for the decisive first experiment. These are
 * Anthropic tiers (one vendor, three strengths) — enough to kill the "single weak
 * model" confound. IDs follow the current model naming; adjust with --models if a
 * pinned dated id is required. Add a cross-vendor frontier tier via
 * `--models ...,openai:gpt-4o@frontier` to also break the single-vendor confound.
 */
export const DEFAULT_LADDER: string[] = [
  'anthropic:claude-haiku-4-5-20251001@weak',
  'anthropic:claude-sonnet-5@mid',
  'anthropic:claude-opus-4-8@frontier',
];

export function resolveModels(csv: string | undefined): ModelProvider[] {
  const specs = (csv ?? DEFAULT_LADDER.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  return specs.map((s) => makeProvider(parseModelSpec(s)));
}
