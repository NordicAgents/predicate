import { describe, it, expect } from 'vitest';
import { extractDeterministic, type Transcript } from '../src/turn-extractor.js';

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
      { type: 'tool_use', name: 'Edit', input: { file_path: '/work/auth.ts' }, is_error: false },
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

  it('Write of a new file emits codebase:createdIn (not modifiedIn)', () => {
    const r = extractDeterministic(tx([
      { type: 'tool_use', name: 'Write', input: { file_path: '/work/new.ts' }, is_error: false, was_new: true },
    ]));
    const createdIn = r.triples.find((t) =>
      t.predicate === 'https://predicate.dev/codebase#createdIn',
    );
    expect(createdIn).toBeDefined();
    expect(r.triples.find((t) =>
      t.predicate === 'https://predicate.dev/codebase#modifiedIn',
    )).toBeUndefined();
  });

  it('Bash exit 0 emits codebase:succeededIn; exit non-zero emits codebase:failedIn', () => {
    const ok = extractDeterministic(tx([
      { type: 'tool_use', name: 'Bash', input: { command: 'pnpm test' }, exit_code: 0 },
    ]));
    expect(ok.triples.find((t) => t.predicate === 'https://predicate.dev/codebase#succeededIn')).toBeDefined();

    const fail = extractDeterministic(tx([
      { type: 'tool_use', name: 'Bash', input: { command: 'pnpm test' }, exit_code: 1 },
    ]));
    expect(fail.triples.find((t) => t.predicate === 'https://predicate.dev/codebase#failedIn')).toBeDefined();
  });

  it('Read/Grep/Glob produce no triples (read-only events don\'t represent learning)', () => {
    const r = extractDeterministic(tx([
      { type: 'tool_use', name: 'Read', input: { file_path: '/x.ts' } },
      { type: 'tool_use', name: 'Grep', input: { pattern: 'foo' } },
      { type: 'tool_use', name: 'Glob', input: { pattern: '*.ts' } },
    ]));
    // Only the Session triples remain
    const nonSession = r.triples.filter((t) => t.subject !== `urn:predicate:session:${SESSION}`);
    expect(nonSession).toHaveLength(0);
  });

  it('every emitted triple has confidence 0.95 and method "tool-parse"', () => {
    const r = extractDeterministic(tx([
      { type: 'tool_use', name: 'Edit', input: { file_path: '/x.ts' } },
      { type: 'tool_use', name: 'Bash', input: { command: 'ls' }, exit_code: 0 },
    ]));
    for (const t of r.triples) {
      expect(t.confidence).toBe(0.95);
      expect(t.method).toBe('tool-parse');
      expect(t.source).toBe(`urn:predicate:session:${SESSION}`);
    }
  });
});
