import type { StorageAdapter } from '../storage/index.js';
import { GRAPH } from '../graphs.js';
import { escapeIRI, escapeLiteral } from '../sparql/escape.js';

const META = 'https://predicate.dev/meta#';

export interface CaptureInput {
  toolName: string;
  input?: unknown;
  output?: unknown;
  sessionId?: string;
  phase: 'pre' | 'post';
}

export interface CaptureResult {
  captureId: string;
  elapsedMs: number;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const extra = s.length - max;
  return `${s.slice(0, max)} … [truncated, ${extra} more chars]`;
}

function serialize(value: unknown, max: number): string {
  let s: string;
  if (value === undefined || value === null) s = '';
  else if (typeof value === 'string') s = value;
  else {
    try { s = JSON.stringify(value); } catch { s = String(value); }
  }
  return truncate(s, max);
}

export async function kgCapture(
  client: StorageAdapter,
  input: CaptureInput,
): Promise<CaptureResult> {
  const t0 = Date.now();
  const maxChars = parseInt(process.env['PREDICATE_CAPTURE_TRUNCATE'] ?? '500', 10);
  const captureId =
    `urn:predicate:capture:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const inputStr = serialize(input.input, maxChars);
  const hasOutput = input.output !== undefined && input.output !== null;
  const outputStr = hasOutput ? serialize(input.output, maxChars) : '';

  const lines: string[] = [
    `${escapeIRI(captureId)} a <${META}ToolCall> ;`,
    `  <${META}toolName>  ${escapeLiteral(input.toolName)} ;`,
    `  <${META}phase>     ${escapeLiteral(input.phase)} ;`,
    `  <${META}at>        "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime>`,
  ];
  if (inputStr.length > 0) lines.push(`  ; <${META}toolInput>  ${escapeLiteral(inputStr)}`);
  if (hasOutput) lines.push(`  ; <${META}toolOutput> ${escapeLiteral(outputStr)}`);
  if (input.sessionId) lines.push(`  ; <${META}sessionId>  ${escapeLiteral(input.sessionId)}`);
  lines.push('  .');

  await client.update(`
    INSERT DATA { GRAPH ${escapeIRI(GRAPH.usage)} {
      ${lines.join('\n      ')}
    } }
  `);

  return { captureId, elapsedMs: Date.now() - t0 };
}
