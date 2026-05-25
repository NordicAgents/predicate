import { describe, it, expect } from 'vitest';
import { SUPPORTED_PLATFORMS } from '../src/commands/extract.js';

describe('extract platforms', () => {
  it('supports claude-code only (Codex reuses the claude-code shape; Gemini removed)', () => {
    expect([...SUPPORTED_PLATFORMS]).toEqual(['claude-code']);
  });
});
