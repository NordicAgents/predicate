import { describe, it, expect } from 'vitest';
import { platformChecks } from '../src/commands/doctor.js';

describe('platformChecks', () => {
  it('codex/gemini report hook-script presence and never reference FUSEKI', () => {
    const checks = platformChecks('codex');
    expect(checks.some((c) => c.name === 'hook scripts')).toBe(true);
    expect(JSON.stringify(checks)).not.toContain('FUSEKI');
  });
  it('unknown platform yields an error check', () => {
    const checks = platformChecks('bogus');
    expect(checks[0]!.ok).toBe(false);
  });
});
