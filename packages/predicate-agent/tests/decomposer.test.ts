import { describe, it, expect } from 'vitest';
import { Decomposer } from '../src/decomposer.js';

const decomposer = new Decomposer();

describe('Decomposer', () => {
  it('decomposes "why did X break" into structured sub-questions', () => {
    const subs = decomposer.decompose('why did login break');
    const kinds = subs.map((s) => s.intent.kind);
    expect(kinds).toContain('why-broken');
    expect(kinds).toContain('find-dependencies');
    const why = subs.find((s) => s.intent.kind === 'why-broken')!;
    expect(why.intent.payload.symbol).toBe('login');
  });

  it('decomposes "what calls Y transitively" with transitive=true', () => {
    const subs = decomposer.decompose('what calls validateToken transitively');
    expect(subs).toHaveLength(1);
    expect(subs[0]!.intent.kind).toBe('find-callers');
    expect(subs[0]!.intent.payload.symbol).toBe('validateToken');
    expect(subs[0]!.intent.payload.transitive).toBe(true);
  });

  it('decomposes "what calls Y" non-transitively', () => {
    const subs = decomposer.decompose('what calls validateToken');
    expect(subs[0]!.intent.payload.transitive).toBe(false);
  });

  it('decomposes "what depends on Z" as find-dependencies', () => {
    const subs = decomposer.decompose('what depends on JWT_SECRET');
    expect(subs[0]!.intent.kind).toBe('find-dependencies');
    expect(subs[0]!.intent.payload.symbol).toBe('JWT_SECRET');
  });

  it('falls through to "unknown" for unmatched questions', () => {
    const subs = decomposer.decompose('how is the weather today');
    expect(subs).toHaveLength(1);
    expect(subs[0]!.intent.kind).toBe('unknown');
    expect(subs[0]!.intent.payload.raw).toBe('how is the weather today');
  });

  it('assigns stable SQ-N ids in order', () => {
    const subs = decomposer.decompose('why did login break');
    expect(subs.map((s) => s.id)).toEqual(subs.map((_, i) => `SQ-${i + 1}`));
  });
});
