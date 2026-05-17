# Predicate Phase 11 — Cross-Platform Stop-Hook Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Extend Phase 9's Stop-hook extraction beyond Claude Code to Gemini CLI and OpenCode. Add `--platform claude-code|gemini|opencode` flag to `predicate extract --from-stdin` plus per-platform transcript parsers. Update those platforms' `stop.sh` scripts so they invoke extract before maintain (currently they only maintain). Tag v1.8.0-cross-platform-stop.

**Architecture:** Each platform writes its session transcript in a different shape. Claude Code's shape is `{type:"assistant", message:{content:[tool_use,...]}}` + `{type:"user", message:{content:[tool_result, ...]}}`. Gemini and OpenCode shapes are similar in spirit but use different field names. We add per-platform adapters that all return the same canonical `Transcript` shape that the existing `extractDeterministic` consumes. The CLI flag picks the right adapter.

**Caveat:** Gemini CLI and OpenCode transcript schemas are NOT formally documented and vary by version. The parsers ship as best-effort with permissive field-candidate matching; users should verify and file issues if their version differs.

**Tech Stack:** Same as Phase 9. Pure TS adapters in predicate-agent.

---

## File Structure

**New files:**
- `packages/predicate-agent/src/transcript-adapters.ts` — three pure functions, one per platform, all returning the canonical `Array<Record<string, unknown>>` event shape the existing `extractDeterministic` expects.
- `packages/predicate-agent/tests/transcript-adapters.test.ts` — adapter unit tests for each platform.

**Modified files:**
- `packages/predicate-cli/src/commands/extract.ts` — add `--platform` flag; pick adapter; pass adapted events to extractDeterministic.
- `packages/predicate-cli/tests/extract.test.ts` — add Gemini + OpenCode test cases.
- `packages/predicate-skill/hooks/gemini-cli/stop.sh` — pipe stdin to extract --platform gemini, then maintain.
- `packages/predicate-skill/hooks/opencode/stop.sh` — pipe stdin to extract --platform opencode, then maintain.
- `packages/predicate-skill/hooks/gemini-cli/README.md` — document extract wiring.
- `packages/predicate-skill/hooks/opencode/README.md` — document extract wiring.
- Version bumps to 1.8.0 in package.json, plugin.json, marketplace.json
- README + SKILL.md status updates
- Bundle rebuild

---

## Adapter contract

Each adapter takes the parsed JSONL events (Array of objects) plus the sessionId from the Stop-hook payload, and returns events in the canonical shape that `extractDeterministic` understands:

```typescript
// Canonical shape (what extractDeterministic walks):
//   { type: "assistant", message: { content: [{type:"tool_use", id, name, input}, ...] } }
//   { type: "user",      message: { content: [{type:"tool_result", tool_use_id, is_error?, content}, ...] } }

export function adaptClaudeCodeTranscript(events: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return events;  // Already canonical — extractDeterministic was built for this.
}

export function adaptGeminiTranscript(events: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  // Gemini's transcript wraps tool uses similarly but uses camelCase + slightly different keys.
  // Field candidates (try each in order):
  //   tool_use_id: id | toolCallId | tool_use_id
  //   name:        name | toolName | tool_name
  //   input:       input | toolInput | args
  //   is_error:    is_error | isError | error
  //   content:     content | output | result
  // Wrap each tool call into the canonical assistant/user pair shape.
  return events.map((ev) => {
    if (ev['type'] === 'tool_call' || ev['toolUse'] || ev['tool_use']) {
      const tu = ev['toolUse'] ?? ev['tool_use'] ?? ev;
      const t = tu as Record<string, unknown>;
      return {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id:    pickStr(t, ['id', 'toolCallId', 'tool_use_id']) ?? '',
            name:  pickStr(t, ['name', 'toolName', 'tool_name']) ?? '',
            input: pick(t, ['input', 'toolInput', 'args']) ?? {},
          }],
        },
      };
    }
    if (ev['type'] === 'tool_result' || ev['toolResult'] || ev['tool_result']) {
      const tr = ev['toolResult'] ?? ev['tool_result'] ?? ev;
      const r = tr as Record<string, unknown>;
      return {
        type: 'user',
        message: {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: pickStr(r, ['tool_use_id', 'toolCallId', 'id']) ?? '',
            is_error:    r['is_error'] === true || r['isError'] === true || r['error'] === true,
            content:     typeof r['content'] === 'string' ? r['content']
                       : typeof r['output']  === 'string' ? r['output']
                       : typeof r['result']  === 'string' ? r['result']
                       : '',
          }],
        },
      };
    }
    return ev;  // Pass-through anything we don't recognize.
  });
}

export function adaptOpenCodeTranscript(events: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  // OpenCode uses { event: "tool.before"/"tool.after", tool: {name,input}, result?, error? }
  return events.map((ev) => {
    const evType = String(ev['event'] ?? ev['type'] ?? '');
    if (evType === 'tool.before' || evType.endsWith('.before')) {
      const tool = ev['tool'] as Record<string, unknown> | undefined;
      return {
        type: 'assistant',
        message: { role: 'assistant', content: [{
          type: 'tool_use',
          id:    pickStr(ev, ['id', 'callId']) ?? '',
          name:  pickStr(tool ?? {}, ['name']) ?? '',
          input: pick(tool ?? {}, ['input', 'args']) ?? {},
        }]},
      };
    }
    if (evType === 'tool.after' || evType.endsWith('.after')) {
      return {
        type: 'user',
        message: { role: 'user', content: [{
          type: 'tool_result',
          tool_use_id: pickStr(ev, ['id', 'callId']) ?? '',
          is_error:    ev['error'] !== undefined && ev['error'] !== null,
          content:     typeof ev['result'] === 'string' ? ev['result']
                     : typeof ev['error']  === 'string' ? ev['error']
                     : '',
        }]},
      };
    }
    return ev;
  });
}

function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
}

function pickStr(o: Record<string, unknown>, keys: string[]): string | undefined {
  const v = pick(o, keys);
  return typeof v === 'string' ? v : undefined;
}
```

The CLI passes the user's `--platform` flag through to pick the adapter; default is `claude-code`.

---

### Tasks (compressed; execute all in one subagent dispatch)

1. **Create transcript-adapters.ts** with the three adapter functions above + the pick/pickStr helpers.

2. **Create transcript-adapters.test.ts** with 5+ tests:
   - claude-code adapter is identity (returns events unchanged)
   - gemini adapter transforms `{type:"tool_call", toolUse:{...}}` → canonical assistant/tool_use pair
   - gemini adapter transforms `{type:"tool_result", toolResult:{isError:true}}` → canonical user/tool_result with is_error:true
   - opencode adapter transforms `{event:"tool.before", tool:{name,input}}` → canonical assistant/tool_use
   - opencode adapter transforms `{event:"tool.after", error: "..."}` → canonical user/tool_result with is_error:true

3. **Modify `extract.ts`**:
   - Add `--platform` parsing (mirror the existing `--phase` flag pattern). Accepted values: `claude-code` (default), `gemini`, `opencode`.
   - Import the three adapter functions.
   - After loading `events` from the JSONL file, call the right adapter based on platform flag.
   - Pass adapted events to `extractDeterministic` as before.
   - Update `help()` to document `--platform`.

4. **Update extract.test.ts** with 2 new cases that feed a synthetic Gemini transcript + a synthetic OpenCode transcript and verify the right kg:abox triples land.

5. **Modify `gemini-cli/stop.sh`** from:
   ```
   set -euo pipefail
   predicate maintain
   ```
   to:
   ```
   set -uo pipefail
   if command -v predicate >/dev/null 2>&1; then
     payload="$(cat || true)"
     if [ -n "$payload" ]; then
       printf '%s' "$payload" | predicate extract --from-stdin --platform gemini >/dev/null 2>&1 || true
     fi
     predicate maintain >/dev/null 2>&1 || true
   fi
   exit 0
   ```

6. **Same change to `opencode/stop.sh`** with `--platform opencode`.

7. **Update Gemini + OpenCode READMEs** in `hooks/<platform>/README.md` — note that stop.sh now extracts before maintaining.

8. **Bump versions** 1.7.0 → 1.8.0 across package.json, plugin.json, marketplace.json.

9. **Update top-level README** Status section: v1.8.0 — cross-platform Stop extraction. List Gemini CLI and OpenCode as supported alongside Claude Code.

10. **Rebuild bundles**, run full test suite (expect ~200 tests), commit, tag `v1.8.0-cross-platform-stop`, merge to main, push.
