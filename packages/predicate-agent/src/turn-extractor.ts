import { createHash } from 'node:crypto';

const META = 'https://predicate.dev/meta#';
const CB   = 'https://predicate.dev/codebase#';
const RDF  = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD  = 'http://www.w3.org/2001/XMLSchema#';

export interface Transcript {
  sessionId: string;
  events: Array<Record<string, unknown>>;
}

export interface ExtractedTriple {
  subject: string;
  predicate: string;
  object: { type: 'uri' | 'literal'; value: string; datatype?: string };
  source: string;
  confidence: number;
  method: string;
}

export interface ExtractorResult {
  triples: ExtractedTriple[];
}

function uri(value: string): ExtractedTriple['object'] {
  return { type: 'uri', value };
}

function literal(value: string, datatype?: string): ExtractedTriple['object'] {
  return datatype ? { type: 'literal', value, datatype } : { type: 'literal', value };
}

function hash12(s: string): string {
  return createHash('sha1').update(s).digest('hex').slice(0, 12);
}

interface ToolUseBlock {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultRef {
  isError: boolean;
}

function extractMessageContent(ev: Record<string, unknown>): unknown[] {
  const msg = ev['message'];
  if (typeof msg !== 'object' || msg === null) return [];
  const content = (msg as Record<string, unknown>)['content'];
  if (Array.isArray(content)) return content;
  return [];
}

function collectToolResults(events: Array<Record<string, unknown>>): Map<string, ToolResultRef> {
  const out = new Map<string, ToolResultRef>();
  for (const ev of events) {
    if (ev['type'] !== 'user') continue;
    for (const block of extractMessageContent(ev)) {
      if (typeof block !== 'object' || block === null) continue;
      const b = block as Record<string, unknown>;
      if (b['type'] !== 'tool_result') continue;
      const id = typeof b['tool_use_id'] === 'string' ? b['tool_use_id'] : undefined;
      if (!id) continue;
      out.set(id, { isError: b['is_error'] === true });
    }
  }
  return out;
}

function collectToolUses(events: Array<Record<string, unknown>>): ToolUseBlock[] {
  const out: ToolUseBlock[] = [];
  for (const ev of events) {
    if (ev['type'] !== 'assistant') continue;
    for (const block of extractMessageContent(ev)) {
      if (typeof block !== 'object' || block === null) continue;
      const b = block as Record<string, unknown>;
      if (b['type'] !== 'tool_use') continue;
      const id = typeof b['id'] === 'string' ? b['id'] : '';
      const name = typeof b['name'] === 'string' ? b['name'] : '';
      if (!id || !name) continue;
      const input = (b['input'] ?? {}) as Record<string, unknown>;
      out.push({ id, name, input });
    }
  }
  return out;
}

export function extractDeterministic(transcript: Transcript): ExtractorResult {
  const sessionUri = `urn:predicate:session:${transcript.sessionId}`;
  const triples: ExtractedTriple[] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();

  function push(t: ExtractedTriple): void {
    const key = `${t.subject}|${t.predicate}|${t.object.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    triples.push(t);
  }

  const base = { source: sessionUri, confidence: 0.95, method: 'tool-parse' };
  push({ subject: sessionUri, predicate: `${RDF}type`, object: uri(`${META}Session`), ...base });
  push({ subject: sessionUri, predicate: `${META}sessionId`, object: literal(transcript.sessionId), ...base });
  push({ subject: sessionUri, predicate: `${META}at`, object: literal(now, `${XSD}dateTime`), ...base });

  const results = collectToolResults(transcript.events);
  const uses = collectToolUses(transcript.events);

  for (const use of uses) {
    const result = results.get(use.id);
    const failed = result?.isError === true;

    if (use.name === 'Edit' || use.name === 'Write') {
      if (failed) continue;
      const filePath = typeof use.input['file_path'] === 'string' ? use.input['file_path'] : undefined;
      if (!filePath) continue;
      const fileUri = `file://${filePath}`;
      push({ subject: fileUri, predicate: `${RDF}type`, object: uri(`${CB}File`), ...base });
      push({ subject: fileUri, predicate: `${CB}modifiedIn`, object: uri(sessionUri), ...base });
    } else if (use.name === 'Bash') {
      const cmd = typeof use.input['command'] === 'string' ? use.input['command'] : undefined;
      if (!cmd) continue;
      const cmdUri = `urn:bash:${hash12(cmd)}`;
      const rel = failed ? `${CB}failedIn` : `${CB}succeededIn`;
      push({ subject: cmdUri, predicate: `${RDF}type`, object: uri(`${CB}Command`), ...base });
      push({ subject: cmdUri, predicate: `${CB}commandText`, object: literal(cmd), ...base });
      push({ subject: cmdUri, predicate: rel, object: uri(sessionUri), ...base });
    }
    // Read/Grep/Glob and other read-only tools: no triples.
  }

  return { triples };
}

export function lastAssistantText(events: Array<Record<string, unknown>>): string {
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (!ev || ev['type'] !== 'assistant') continue;
    const text = extractMessageContent(ev)
      .filter((b): b is { type: 'text'; text: string } =>
        typeof b === 'object' && b !== null &&
        (b as Record<string, unknown>)['type'] === 'text' &&
        typeof (b as Record<string, unknown>)['text'] === 'string')
      .map((b) => b.text)
      .join('\n');
    if (text.length > 0) return text;
  }
  return '';
}

export function summarizeToolCalls(events: Array<Record<string, unknown>>): string {
  const results = collectToolResults(events);
  const uses = collectToolUses(events);
  const lines: string[] = [];
  for (const u of uses) {
    const failed = results.get(u.id)?.isError === true;
    if (u.name === 'Edit' || u.name === 'Write') {
      lines.push(`${u.name} ${String(u.input['file_path'] ?? '?')}${failed ? ' (failed)' : ''}`);
    } else if (u.name === 'Bash') {
      const cmd = String(u.input['command'] ?? '?');
      const short = cmd.length > 80 ? `${cmd.slice(0, 80)}…` : cmd;
      lines.push(`Bash "${short}"${failed ? ' (failed)' : ' (ok)'}`);
    } else {
      lines.push(u.name);
    }
  }
  return lines.join('\n');
}
