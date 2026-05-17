import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You are the semantic extractor for Predicate, a knowledge graph that
tracks development-session OUTCOMES (what was learned, not what was done).

You will receive:
1. A TBox slice (the predicates currently declared in the schema).
2. The agent's final assistant message from a session.
3. A summary of tool calls made during the session.

Emit JSON: a list of typed triples that capture what the agent LEARNED.

HARD RULES:
- Use ONLY predicates that appear in the TBox slice. Do NOT invent
  predicates. If a fact would require a predicate not in TBox, skip
  it (note it in the "skipped" field).
- Confidence defaults to 0.7. Use 0.9 only when the agent's claim is
  directly supported by a tool-call output. Use 0.5 when the claim is
  speculative or unverified.
- method MUST be "agent-self-report".
- source MUST be the session URI provided.
- subject and predicate MUST be full IRIs.

Output strict JSON, no prose:
{
  "triples": [
    { "subject": "...", "predicate": "...",
      "object": { "type": "uri"|"literal", "value": "...", "datatype": "..." },
      "source": "<session URI>", "confidence": 0.7, "method": "agent-self-report" }
  ],
  "skipped": ["reasoning for skipped facts"]
}`;

export interface SemanticInput {
  sessionId: string;
  finalMessage: string;
  toolSummary: string;
  tboxSlice: string;
}

export interface SemanticTriple {
  subject: string;
  predicate: string;
  object: { type: 'uri' | 'literal'; value: string; datatype?: string };
  source: string;
  confidence: number;
  method: string;
}

export interface SemanticResult {
  triples: SemanticTriple[];
  skipped: string[];
}

export async function extractSemantic(input: SemanticInput): Promise<SemanticResult> {
  if (!process.env['ANTHROPIC_API_KEY']) {
    return { triples: [], skipped: ['no ANTHROPIC_API_KEY'] };
  }

  const client = new Anthropic();
  const sessionUri = `urn:predicate:session:${input.sessionId}`;

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: 'text', text: SYSTEM_PROMPT },
        { type: 'text', text: `<tbox-slice>\n${input.tboxSlice}\n</tbox-slice>`, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{
        role: 'user',
        content: `<session-uri>${sessionUri}</session-uri>

<final-message>
${input.finalMessage}
</final-message>

<tool-call-summary>
${input.toolSummary}
</tool-call-summary>`,
      }],
    });
  } catch (err) {
    return { triples: [], skipped: [`API call failed: ${(err as Error).message}`] };
  }

  const text = response.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  let parsed: unknown;
  try {
    // Sometimes the model wraps JSON in ```json fences — strip them.
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    parsed = JSON.parse(stripped);
  } catch (err) {
    return { triples: [], skipped: [`failed to parse LLM JSON: ${(err as Error).message}`] };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { triples: [], skipped: ['LLM returned non-object JSON'] };
  }
  const obj = parsed as Record<string, unknown>;
  const tripArr = Array.isArray(obj['triples']) ? (obj['triples'] as unknown[]) : [];
  const skippedArr = Array.isArray(obj['skipped']) ? (obj['skipped'] as unknown[]).filter((x): x is string => typeof x === 'string') : [];

  const triples: SemanticTriple[] = [];
  for (const t of tripArr) {
    if (typeof t !== 'object' || t === null) continue;
    const r = t as Record<string, unknown>;
    if (typeof r['subject'] !== 'string' || typeof r['predicate'] !== 'string') continue;
    const o = r['object'];
    if (typeof o !== 'object' || o === null) continue;
    const ro = o as Record<string, unknown>;
    if ((ro['type'] !== 'uri' && ro['type'] !== 'literal') || typeof ro['value'] !== 'string') continue;
    triples.push({
      subject: r['subject'],
      predicate: r['predicate'],
      object: {
        type: ro['type'] as 'uri' | 'literal',
        value: ro['value'],
        ...(typeof ro['datatype'] === 'string' ? { datatype: ro['datatype'] } : {}),
      },
      source: typeof r['source'] === 'string' ? r['source'] : sessionUri,
      confidence: typeof r['confidence'] === 'number' ? r['confidence'] : 0.7,
      method: typeof r['method'] === 'string' ? r['method'] : 'agent-self-report',
    });
  }

  return { triples, skipped: skippedArr };
}
