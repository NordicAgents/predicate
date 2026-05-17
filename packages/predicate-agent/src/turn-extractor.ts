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

  // Always emit the Session itself.
  const base = { source: sessionUri, confidence: 0.95, method: 'tool-parse' };
  push({ subject: sessionUri, predicate: `${RDF}type`, object: uri(`${META}Session`), ...base });
  push({ subject: sessionUri, predicate: `${META}sessionId`, object: literal(transcript.sessionId), ...base });
  push({ subject: sessionUri, predicate: `${META}at`, object: literal(now, `${XSD}dateTime`), ...base });

  for (const ev of transcript.events) {
    if (ev['type'] !== 'tool_use') continue;
    const name = ev['name'];
    const input = (ev['input'] ?? {}) as Record<string, unknown>;
    if (typeof name !== 'string') continue;

    if (name === 'Edit' || name === 'Write') {
      const filePath = typeof input['file_path'] === 'string' ? input['file_path'] : undefined;
      if (!filePath) continue;
      const fileUri = `file://${filePath}`;
      const wasNew = name === 'Write' && ev['was_new'] === true;
      const rel = wasNew ? `${CB}createdIn` : `${CB}modifiedIn`;
      push({ subject: fileUri, predicate: `${RDF}type`, object: uri(`${CB}File`), ...base });
      push({ subject: fileUri, predicate: rel, object: uri(sessionUri), ...base });
    } else if (name === 'Bash') {
      const cmd = typeof input['command'] === 'string' ? input['command'] : undefined;
      if (!cmd) continue;
      const cmdUri = `urn:bash:${hash12(cmd)}`;
      const exit = typeof ev['exit_code'] === 'number' ? ev['exit_code'] : 0;
      const rel = exit === 0 ? `${CB}succeededIn` : `${CB}failedIn`;
      push({ subject: cmdUri, predicate: `${RDF}type`, object: uri(`${CB}Command`), ...base });
      push({ subject: cmdUri, predicate: `${CB}commandText`, object: literal(cmd), ...base });
      push({ subject: cmdUri, predicate: rel, object: uri(sessionUri), ...base });
    }
    // Read/Grep/Glob/etc: no triples emitted.
  }

  return { triples };
}
