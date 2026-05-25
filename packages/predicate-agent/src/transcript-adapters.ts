// Per-platform transcript adapters for `predicate extract --from-stdin`.
//
// Each adapter takes the raw JSONL events parsed from a platform's
// session transcript and returns events in the canonical shape that
// `extractDeterministic` (see ./turn-extractor.ts) already understands:
//
//   { type: "assistant", message: { content: [{type:"tool_use", id, name, input}, ...] } }
//   { type: "user",      message: { content: [{type:"tool_result", tool_use_id, is_error?, content}, ...] } }
//
// Claude Code already writes that canonical shape, so its adapter is the
// identity. Codex's Stop payload reuses the same path. New platforms add a
// permissive adapter here and a case in `extract`'s `adapterFor`.

export function adaptClaudeCodeTranscript(
  events: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  // Claude Code's JSONL is already in the canonical shape.
  return events;
}
