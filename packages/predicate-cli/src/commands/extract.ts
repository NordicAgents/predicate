import type { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { kgAssert } from 'predicate-mcp/src/tools/kg-assert.js';
import {
  extractDeterministic,
  lastAssistantText,
  summarizeToolCalls,
  type ExtractedTriple,
  type Transcript,
} from 'predicate-agent/src/turn-extractor.js';
import { extractSemantic, type SemanticTriple } from 'predicate-agent/src/semantic-extractor.js';
import {
  adaptClaudeCodeTranscript,
  adaptGeminiTranscript,
  adaptOpenCodeTranscript,
} from 'predicate-agent/src/transcript-adapters.js';

const SUPPORTED_PLATFORMS = ['claude-code', 'gemini', 'opencode'] as const;
type Platform = (typeof SUPPORTED_PLATFORMS)[number];

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function adapterFor(platform: Platform): (events: Array<Record<string, unknown>>) => Array<Record<string, unknown>> {
  switch (platform) {
    case 'gemini':
      return adaptGeminiTranscript;
    case 'opencode':
      return adaptOpenCodeTranscript;
    case 'claude-code':
    default:
      return adaptClaudeCodeTranscript;
  }
}

async function readStdin(stream: Readable): Promise<string> {
  let buf = '';
  for await (const chunk of stream) buf += String(chunk);
  return buf;
}

function help(): void {
  console.log(`predicate extract --from-stdin [--platform <p>]

Read a Stop-hook payload from stdin and extract typed triples for
what the turn LEARNED. Triples go through kg_assert so SHACL
validation and TBox predicate-discipline apply.

Expected stdin payload (Stop hook):
  { "session_id": "...", "transcript_path": "/abs/path.jsonl",
    "stop_hook_active": true }

The CLI:
  1. Reads the transcript JSONL.
  2. Runs the platform-specific adapter to map events into the
     canonical assistant/user tool_use/tool_result shape.
  3. Runs the deterministic extractor (TS, no LLM, fast).
  4. Runs the semantic extractor (Claude Haiku, only if
     ANTHROPIC_API_KEY is set).
  5. Asserts all triples via kg_assert.

Options:
  --from-stdin         Required.
  --platform <name>    One of: claude-code (default), gemini, opencode.
                       Selects the transcript adapter for the platform.
  --help               Print this message.

Env:
  ANTHROPIC_API_KEY    Enables the semantic extractor (default: off).
  FUSEKI_URL, PREDICATE_DATASET    Graph server.
`);
}

export interface ExtractTranscriptResult {
  deterministic: number;
  semantic: number;
  asserted: number;
  rejected: number;
}

export async function extractTranscript(
  client: StorageAdapter,
  opts: { sessionId: string; transcriptPath: string; platform: Platform },
): Promise<ExtractTranscriptResult> {
  const lines = readFileSync(opts.transcriptPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  const events = lines.map((l) => JSON.parse(l) as Record<string, unknown>);

  const adapted = adapterFor(opts.platform)(events);
  const transcript: Transcript = { sessionId: opts.sessionId, events: adapted };
  const deterministic = extractDeterministic(transcript);

  let semantic: { triples: SemanticTriple[]; skipped: string[] } = { triples: [], skipped: [] };
  if (process.env['ANTHROPIC_API_KEY']) {
    const tboxSlice = await buildTBoxSlice(client);
    semantic = await extractSemantic({
      sessionId: opts.sessionId,
      finalMessage: lastAssistantText(adapted),
      toolSummary: summarizeToolCalls(adapted),
      tboxSlice,
    });
  }

  let asserted = 0;
  let rejected = 0;
  for (const t of [...deterministic.triples, ...semantic.triples] as Array<ExtractedTriple | SemanticTriple>) {
    try { await kgAssert(client, t); asserted++; } catch { rejected++; }
  }
  return {
    deterministic: deterministic.triples.length,
    semantic: semantic.triples.length,
    asserted,
    rejected,
  };
}

async function buildTBoxSlice(client: StorageAdapter): Promise<string> {
  // Naive slice: list every declared predicate. Good enough for v1.5;
  // future versions can scope by concept.
  const r = await client.select(
    `PREFIX owl: <http://www.w3.org/2002/07/owl#>
     SELECT DISTINCT ?p ?kind WHERE {
       GRAPH <kg:tbox> {
         ?p a ?kind .
         FILTER (?kind IN (owl:ObjectProperty, owl:DatatypeProperty))
       }
     } ORDER BY ?p`,
  );
  return r.results.bindings.map((b) => `${b['p']!.value} a ${b['kind']!.value} .`).join('\n');
}

export async function extract(args: string[], stdin: Readable = process.stdin): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  if (!hasFlag(args, '--from-stdin')) {
    console.error('predicate extract: --from-stdin is required.');
    return 2;
  }

  const platformRaw = parseFlag(args, '--platform') ?? 'claude-code';
  if (!(SUPPORTED_PLATFORMS as readonly string[]).includes(platformRaw)) {
    console.error(
      `predicate extract: unsupported --platform "${platformRaw}". Supported: ${SUPPORTED_PLATFORMS.join(', ')}.`,
    );
    return 2;
  }
  const platform = platformRaw as Platform;

  const raw = await readStdin(stdin);
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    console.error(`predicate extract: invalid JSON on stdin: ${(err as Error).message}`);
    return 2;
  }

  const sessionId = typeof payload['session_id'] === 'string' ? payload['session_id'] : undefined;
  const transcriptPath = typeof payload['transcript_path'] === 'string' ? payload['transcript_path'] : undefined;
  if (!sessionId || !transcriptPath) {
    console.error('predicate extract: payload must include session_id and transcript_path.');
    return 2;
  }

  let result: ExtractTranscriptResult;
  try {
    result = await extractTranscript(getAdapter(), { sessionId, transcriptPath, platform });
  } catch (err) {
    console.error(`predicate extract: failed to process transcript: ${(err as Error).message}`);
    return 1;
  }

  console.log(
    `predicate extract: session=${sessionId} deterministic=${result.deterministic} semantic=${result.semantic} asserted=${result.asserted} rejected=${result.rejected}`,
  );
  return 0;
}
