import { describe, it, expect } from 'vitest';
import { escapeIRI, escapeLiteral } from '../../src/sparql/escape.js';

describe('escapeIRI', () => {
  it('wraps a valid IRI', () => {
    expect(escapeIRI('https://predicate.dev/x#Foo')).toBe('<https://predicate.dev/x#Foo>');
  });
  it('rejects an IRI containing >', () => {
    expect(() => escapeIRI('http://x/>evil')).toThrow();
  });
  it('rejects whitespace', () => {
    expect(() => escapeIRI('http://x /a')).toThrow();
  });
});

describe('escapeLiteral', () => {
  it('escapes double quotes and backslashes', () => {
    expect(escapeLiteral('he said "hi"\\n')).toBe('"he said \\"hi\\"\\\\n"');
  });
  it('escapes newlines', () => {
    expect(escapeLiteral('a\nb')).toBe('"a\\nb"');
  });
  it('accepts an empty string', () => {
    expect(escapeLiteral('')).toBe('""');
  });
});
