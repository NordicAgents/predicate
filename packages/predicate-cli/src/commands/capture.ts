import type { Readable } from 'node:stream';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { kgCapture } from 'predicate-mcp/src/tools/kg-capture.js';

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function help(): void {
  console.log(`predicate capture [options]

Record a tool invocation into kg:usage. Suitable for use from
platform-specific PreToolUse / PostToolUse hook scripts.

Options:
  --tool NAME           Tool name (required unless --from-stdin)
  --phase pre|post      Hook phase (required)
  --input  JSON_OR_STR  Serialized tool input (optional)
  --output JSON_OR_STR  Serialized tool output (optional)
  --session ID          Session identifier (optional)
  --from-stdin          Parse a Claude-Code-shaped JSON object from stdin
                        (keys: session_id, tool_name, tool_input, tool_response).
                        --phase is still required.
  --help                Print this message.

Env:
  PREDICATE_CAPTURE_SKIP       Comma list of tool names to suppress (default "").
  PREDICATE_CAPTURE_TRUNCATE   Max chars per field (default 500).
  FUSEKI_URL, PREDICATE_DATASET   Server location.
`);
}

async function readStdin(stream: Readable): Promise<string> {
  let buf = '';
  for await (const chunk of stream) buf += String(chunk);
  return buf;
}

function shouldSkip(toolName: string): boolean {
  const raw = process.env['PREDICATE_CAPTURE_SKIP'] ?? '';
  if (raw.length === 0) return false;
  return raw.split(',').map((s) => s.trim()).includes(toolName);
}

function parseMaybeJson(s: string | undefined): unknown {
  if (s === undefined) return undefined;
  try { return JSON.parse(s); } catch { return s; }
}

export async function capture(args: string[], stdin: Readable = process.stdin): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  const phase = parseFlag(args, '--phase');
  if (phase !== 'pre' && phase !== 'post') {
    console.error('predicate capture: --phase must be "pre" or "post"');
    return 2;
  }

  let toolName: string | undefined;
  let toolInput: unknown;
  let toolOutput: unknown;
  let sessionId: string | undefined;

  if (hasFlag(args, '--from-stdin')) {
    const raw = await readStdin(stdin);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      console.error(`predicate capture: invalid JSON on stdin: ${(err as Error).message}`);
      return 2;
    }
    toolName = typeof payload['tool_name'] === 'string' ? payload['tool_name'] : undefined;
    toolInput = payload['tool_input'];
    toolOutput = payload['tool_response'];
    sessionId = typeof payload['session_id'] === 'string' ? payload['session_id'] : undefined;
  } else {
    toolName = parseFlag(args, '--tool');
    toolInput = parseMaybeJson(parseFlag(args, '--input'));
    toolOutput = parseMaybeJson(parseFlag(args, '--output'));
    sessionId = parseFlag(args, '--session');
  }

  if (!toolName) {
    console.error('predicate capture: --tool is required (or --from-stdin with payload.tool_name)');
    return 2;
  }
  if (shouldSkip(toolName)) return 0;

  try {
    const client = new SparqlClient(loadConfig());
    await kgCapture(client, { toolName, input: toolInput, output: toolOutput, sessionId, phase });
    return 0;
  } catch (err) {
    console.error(`predicate capture failed: ${(err as Error).message}`);
    return 1;
  }
}
