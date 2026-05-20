import type { Readable } from 'node:stream';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';
import { deleteExtractedSlice } from './replay-rebuild.js';
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
  --from-stdin         Required (unless --replay is used).
  --replay <path>   Rebuild the extracted abox slice from a transcript file or
                    a directory of <session-id>.jsonl files (re-materializes inferred).
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

async function replay(pathArg: string, platform: Platform): Promise<number> {
  let files: string[];
  try {
    const st = statSync(pathArg);
    files = st.isDirectory()
      ? readdirSync(pathArg).filter((f) => f.endsWith('.jsonl')).map((f) => join(pathArg, f))
      : [pathArg];
  } catch (err) {
    console.error(`predicate extract --replay: cannot read ${pathArg}: ${(err as Error).message}`);
    return 2;
  }
  if (files.length === 0) {
    console.error(`predicate extract --replay: no .jsonl transcripts in ${pathArg}`);
    return 2;
  }

  const client = getAdapter();
  let sessions = 0, asserted = 0, rejected = 0, errors = 0;
  for (const file of files) {
    const sessionId = basename(file, '.jsonl');
    try {
      await deleteExtractedSlice(client, sessionId);
      const r = await extractTranscript(client, { sessionId, transcriptPath: file, platform });
      asserted += r.asserted; rejected += r.rejected; sessions++;
    } catch (err) {
      console.error(`predicate extract --replay: session ${sessionId} failed: ${(err as Error).message}`);
      errors++;
    }
  }

  if (sessions > 0) {
    await client.update('DROP SILENT GRAPH <kg:inferred>');
    await new FusekiConstructAdapter(client).materialize({
      tboxGraph: 'kg:tbox',
      aboxGraphs: ['kg:abox'],
      targetGraph: 'kg:inferred',
      closureCutoff: 0.5,
    });
  }

  console.log(
    `predicate extract --replay: replayed ${sessions} sessions, asserted ${asserted}, rejected ${rejected}, errors ${errors}`,
  );
  return sessions === 0 && errors > 0 ? 1 : 0;
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

  const platformRaw = parseFlag(args, '--platform') ?? 'claude-code';
  if (!(SUPPORTED_PLATFORMS as readonly string[]).includes(platformRaw)) {
    console.error(
      `predicate extract: unsupported --platform "${platformRaw}". Supported: ${SUPPORTED_PLATFORMS.join(', ')}.`,
    );
    return 2;
  }
  const platform = platformRaw as Platform;

  const replayPath = parseFlag(args, '--replay');
  if (replayPath !== undefined) {
    return replay(replayPath, platform);
  }

  if (!hasFlag(args, '--from-stdin')) {
    console.error('predicate extract: --from-stdin or --replay <path> is required.');
    return 2;
  }

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
