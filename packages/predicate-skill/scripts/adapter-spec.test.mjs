import { describe, it, expect } from 'vitest';
import { MCP_ENV, PLATFORMS } from './adapter-spec.mjs';

describe('adapter-spec', () => {
  it('uses the oxigraph backend, never FUSEKI_URL', () => {
    expect(MCP_ENV.PREDICATE_BACKEND).toBe('oxigraph');
    expect(MCP_ENV.PREDICATE_DATASET).toBe('predicate');
    expect(MCP_ENV).not.toHaveProperty('FUSEKI_URL');
  });
  it('declares the in-scope platforms only', () => {
    expect(Object.keys(PLATFORMS).sort()).toEqual(
      ['codex', 'cursor', 'vscode'].sort(),
    );
  });
});
