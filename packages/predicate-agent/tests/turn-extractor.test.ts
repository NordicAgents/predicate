import { describe, it, expect } from 'vitest';
import { extractDeterministic, lastAssistantText, summarizeToolCalls, type Transcript } from '../src/turn-extractor.js';

// Real Claude Code transcripts wrap each tool_use inside
//   { type: "assistant", message: { content: [ { type:"tool_use", id, name, input } ] } }
// and the matching tool_result inside
//   { type: "user", message: { content: [ { type:"tool_result", tool_use_id, is_error?, content } ] } }
// Failure is signaled by is_error===true on the tool_result, NOT by an exit_code on the tool_use.

function assistant(tool: { id: string; name: string; input: Record<string, unknown> }): Record<string, unknown> {
  return {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'tool_use', ...tool }] },
  };
}

function assistantText(text: string): Record<string, unknown> {
  return {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  };
}

function toolResult(toolUseId: string, opts: { isError?: boolean } = {}): Record<string, unknown> {
  const block: Record<string, unknown> = { type: 'tool_result', tool_use_id: toolUseId, content: 'ok' };
  if (opts.isError) block['is_error'] = true;
  return { type: 'user', message: { role: 'user', content: [block] } };
}

describe('extractDeterministic', () => {
  const SESSION = 'ses-abc';

  function tx(events: Array<Record<string, unknown>>): Transcript {
    return { sessionId: SESSION, events };
  }

  it('emits a Session triple for every turn', () => {
    const r = extractDeterministic(tx([]));
    const sessionTriples = r.triples.filter((t) =>
      t.object.type === 'uri' &&
      t.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      t.object.value === 'https://predicate.dev/meta#Session',
    );
    expect(sessionTriples).toHaveLength(1);
    expect(sessionTriples[0]!.subject).toBe(`urn:predicate:session:${SESSION}`);
  });

  it('Edit → file is typed as codebase:File and linked via codebase:modifiedIn', () => {
    const r = extractDeterministic(tx([
      assistant({ id: 't1', name: 'Edit', input: { file_path: '/work/auth.ts' } }),
      toolResult('t1'),
    ]));
    const subjects = new Set(r.triples.map((t) => t.subject));
    expect(subjects).toContain('file:///work/auth.ts');
    const modifiedIn = r.triples.find((t) =>
      t.predicate === 'https://predicate.dev/codebase#modifiedIn',
    );
    expect(modifiedIn).toBeDefined();
    expect(modifiedIn!.subject).toBe('file:///work/auth.ts');
    expect(modifiedIn!.object.value).toBe(`urn:predicate:session:${SESSION}`);
    expect(modifiedIn!.confidence).toBe(0.95);
    expect(modifiedIn!.method).toBe('tool-parse');
  });

  it('Failed Edit (is_error in tool_result) emits no modifiedIn triple', () => {
    const r = extractDeterministic(tx([
      assistant({ id: 't1', name: 'Edit', input: { file_path: '/work/bad.ts' } }),
      toolResult('t1', { isError: true }),
    ]));
    expect(r.triples.find((t) =>
      t.predicate === 'https://predicate.dev/codebase#modifiedIn',
    )).toBeUndefined();
  });

  it('Bash with successful tool_result emits codebase:succeededIn', () => {
    const r = extractDeterministic(tx([
      assistant({ id: 't1', name: 'Bash', input: { command: 'pnpm test' } }),
      toolResult('t1'),
    ]));
    expect(r.triples.find((t) => t.predicate === 'https://predicate.dev/codebase#succeededIn')).toBeDefined();
    expect(r.triples.find((t) => t.predicate === 'https://predicate.dev/codebase#failedIn')).toBeUndefined();
  });

  it('Bash with is_error tool_result emits codebase:failedIn', () => {
    const r = extractDeterministic(tx([
      assistant({ id: 't1', name: 'Bash', input: { command: 'pnpm test' } }),
      toolResult('t1', { isError: true }),
    ]));
    expect(r.triples.find((t) => t.predicate === 'https://predicate.dev/codebase#failedIn')).toBeDefined();
    expect(r.triples.find((t) => t.predicate === 'https://predicate.dev/codebase#succeededIn')).toBeUndefined();
  });

  it('Read/Grep/Glob produce no triples (read-only ops aren\'t learning)', () => {
    const r = extractDeterministic(tx([
      assistant({ id: 't1', name: 'Read', input: { file_path: '/x.ts' } }),
      assistant({ id: 't2', name: 'Grep', input: { pattern: 'foo' } }),
      assistant({ id: 't3', name: 'Glob', input: { pattern: '*.ts' } }),
      toolResult('t1'), toolResult('t2'), toolResult('t3'),
    ]));
    const nonSession = r.triples.filter((t) => t.subject !== `urn:predicate:session:${SESSION}`);
    expect(nonSession).toHaveLength(0);
  });

  it('every emitted triple has confidence 0.95 and method "tool-parse"', () => {
    const r = extractDeterministic(tx([
      assistant({ id: 't1', name: 'Edit', input: { file_path: '/x.ts' } }),
      toolResult('t1'),
      assistant({ id: 't2', name: 'Bash', input: { command: 'ls' } }),
      toolResult('t2'),
    ]));
    for (const t of r.triples) {
      expect(t.confidence).toBe(0.95);
      expect(t.method).toBe('tool-parse');
      expect(t.source).toBe(`urn:predicate:session:${SESSION}`);
    }
  });

  it('handles multiple tool_use blocks within a single assistant message', () => {
    const r = extractDeterministic(tx([
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/a.ts' } },
            { type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: '/b.ts' } },
          ],
        },
      },
      toolResult('t1'),
      toolResult('t2'),
    ]));
    const files = new Set(
      r.triples
        .filter((t) => t.predicate === 'https://predicate.dev/codebase#modifiedIn')
        .map((t) => t.subject),
    );
    expect(files).toEqual(new Set(['file:///a.ts', 'file:///b.ts']));
  });
});

describe('lastAssistantText', () => {
  it('returns the text content of the most recent assistant event', () => {
    const events = [
      assistantText('first'),
      assistantText('middle'),
      assistantText('last'),
    ];
    expect(lastAssistantText(events)).toBe('last');
  });

  it('skips assistant events that contain only tool_use (no text)', () => {
    const events = [
      assistantText('older'),
      assistant({ id: 't1', name: 'Read', input: { file_path: '/x' } }),
    ];
    expect(lastAssistantText(events)).toBe('older');
  });

  it('returns empty string when no assistant text is present', () => {
    expect(lastAssistantText([toolResult('t1')])).toBe('');
  });
});

describe('summarizeToolCalls', () => {
  it('produces one line per tool_use, marking failures', () => {
    const events = [
      assistant({ id: 't1', name: 'Edit', input: { file_path: '/x.ts' } }),
      toolResult('t1'),
      assistant({ id: 't2', name: 'Bash', input: { command: 'rm -rf /' } }),
      toolResult('t2', { isError: true }),
    ];
    const summary = summarizeToolCalls(events);
    expect(summary).toContain('Edit /x.ts');
    expect(summary).toContain('Bash "rm -rf /" (failed)');
  });
});
