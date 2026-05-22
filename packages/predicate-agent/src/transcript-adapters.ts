// Per-platform transcript adapters for `predicate extract --from-stdin`.
//
// Each adapter takes the raw JSONL events parsed from a platform's
// session transcript and returns events in the canonical shape that
// `extractDeterministic` (see ./turn-extractor.ts) already understands:
//
//   { type: "assistant", message: { content: [{type:"tool_use", id, name, input}, ...] } }
//   { type: "user",      message: { content: [{type:"tool_result", tool_use_id, is_error?, content}, ...] } }
//
// Claude Code already writes that canonical shape; its adapter is the
// identity. Gemini CLI writes similar information under
// different field names. Their transcript schemas are NOT formally
// documented and may vary by version, so the parsers use permissive
// field-candidate matching and fall through gracefully on unrecognized
// shapes (returning the event unchanged is OK — extractDeterministic
// will simply skip it).

export function adaptClaudeCodeTranscript(
  events: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  // Claude Code's JSONL is already in the canonical shape.
  return events;
}

export function adaptGeminiTranscript(
  events: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  // Best-effort: Gemini CLI uses similar two-event call/result pairs
  // but with camelCase keys. Field candidates (try each in order):
  //   tool_use_id: id | toolCallId | tool_use_id
  //   name:        name | toolName | tool_name
  //   input:       input | toolInput | args
  //   is_error:    is_error | isError | error
  //   content:     content | output | result
  return events.map((ev) => {
    if (ev['type'] === 'tool_call' || ev['toolUse'] || ev['tool_use']) {
      const tu = (ev['toolUse'] ?? ev['tool_use'] ?? ev) as Record<string, unknown>;
      return {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: pickStr(tu, ['id', 'toolCallId', 'tool_use_id']) ?? '',
              name: pickStr(tu, ['name', 'toolName', 'tool_name']) ?? '',
              input: (pick(tu, ['input', 'toolInput', 'args']) as Record<string, unknown>) ?? {},
            },
          ],
        },
      };
    }
    if (ev['type'] === 'tool_result' || ev['toolResult'] || ev['tool_result']) {
      const tr = (ev['toolResult'] ?? ev['tool_result'] ?? ev) as Record<string, unknown>;
      return {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: pickStr(tr, ['tool_use_id', 'toolCallId', 'id']) ?? '',
              is_error:
                tr['is_error'] === true || tr['isError'] === true || tr['error'] === true,
              content:
                typeof tr['content'] === 'string'
                  ? tr['content']
                  : typeof tr['output'] === 'string'
                    ? tr['output']
                    : typeof tr['result'] === 'string'
                      ? tr['result']
                      : '',
            },
          ],
        },
      };
    }
    return ev;
  });
}

function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) return o[k];
  }
  return undefined;
}

function pickStr(o: Record<string, unknown>, keys: string[]): string | undefined {
  const v = pick(o, keys);
  return typeof v === 'string' ? v : undefined;
}
