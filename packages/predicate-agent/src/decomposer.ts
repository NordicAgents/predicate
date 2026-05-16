import type { SubQuestion, SubQuestionIntent } from './types.js';

interface Pattern {
  regex: RegExp;
  build: (m: RegExpMatchArray) => SubQuestion[];
}

const PATTERNS: Pattern[] = [
  {
    // "why did X break"
    regex: /^why\s+did\s+(\w[\w./-]*)\s+break\b/i,
    build: (m) => {
      const symbol = m[1]!;
      return [
        {
          id: 'PLACEHOLDER',
          text: `what is happening with ${symbol}`,
          intent: { kind: 'why-broken' as const, payload: { symbol } as Record<string, string | boolean> },
        },
        {
          id: 'PLACEHOLDER',
          text: `what does ${symbol} depend on transitively`,
          intent: { kind: 'find-dependencies' as const, payload: { symbol, transitive: true } as Record<string, string | boolean> },
        },
      ];
    },
  },
  {
    // "what calls Y [transitively]"
    regex: /^what\s+calls\s+(\w[\w./-]*)(\s+transitively)?\b/i,
    build: (m) => {
      const symbol = m[1]!;
      const transitive = Boolean(m[2]);
      return [
        {
          id: 'PLACEHOLDER',
          text: `find callers of ${symbol}${transitive ? ' (transitive)' : ''}`,
          intent: { kind: 'find-callers', payload: { symbol, transitive } },
        },
      ];
    },
  },
  {
    // "what depends on Z [transitively]"
    regex: /^what\s+depends\s+on\s+(\w[\w./-]*)(\s+transitively)?\b/i,
    build: (m) => {
      const symbol = m[1]!;
      const transitive = Boolean(m[2]);
      return [
        {
          id: 'PLACEHOLDER',
          text: `find things depending on ${symbol}${transitive ? ' (transitive)' : ''}`,
          intent: { kind: 'find-dependencies', payload: { symbol, transitive } },
        },
      ];
    },
  },
];

export class Decomposer {
  decompose(question: string): SubQuestion[] {
    const trimmed = question.trim();
    for (const p of PATTERNS) {
      const m = trimmed.match(p.regex);
      if (m) return this.assignIds(p.build(m));
    }
    return this.assignIds([
      {
        id: 'PLACEHOLDER',
        text: trimmed,
        intent: { kind: 'unknown', payload: { raw: trimmed } } as SubQuestionIntent,
      },
    ]);
  }

  private assignIds(subs: SubQuestion[]): SubQuestion[] {
    return subs.map((s, i) => ({ ...s, id: `SQ-${i + 1}` }));
  }
}
