import { describe, it, expect } from 'vitest';
import { SUPPORTED_PLATFORMS } from '../src/commands/extract.js';

describe('extract platforms', () => {
  it('supports claude-code and gemini only — opencode removed', () => {
    expect([...SUPPORTED_PLATFORMS]).toEqual(['claude-code', 'gemini']);
  });
});
