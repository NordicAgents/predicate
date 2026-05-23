import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendScoreboard, renderCurve } from '../src/report.js';
import type { ScoreRow } from '../src/eval-types.js';

function row(ep: number, acc: number): ScoreRow {
  return {
    runId: 'r1', timestamp: 't', domain: 'org', tier: 'tier1', episode: ep,
    inference: 'on', accuracy: acc, lift: acc, perQuestion: {},
    boundedness: { triples: 0, inferred: 0, unusedConceptRatio: 0, materializeMs: 0 },
  };
}

describe('report', () => {
  it('appends one JSONL line per row', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-'));
    const file = join(dir, 'scoreboard.jsonl');
    appendScoreboard([row(1, 0.2), row(2, 0.8)], file);
    expect(readFileSync(file, 'utf8').trim().split('\n').length).toBe(2);
  });

  it('renders an ascii curve containing the domain and episode markers', () => {
    const out = renderCurve([row(1, 0.2), row(2, 0.8)]);
    expect(out).toContain('org');
    expect(out).toMatch(/e1|e2/);
  });
});
