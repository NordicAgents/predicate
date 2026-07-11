import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runTier1 } from '../src/rigs/tier1-deterministic.js';
import { loadQuestions } from '../src/questions.js';
import { writeConflictFixture, DENSITIES, SEED } from '../src/conflict/generate.js';
import type { ScoreRow } from '../src/eval-types.js';

// Tests read the COMMITTED fixtures — they never regenerate them. The
// determinism test below regenerates into a temp dir purely to prove the
// committed bytes are reproducible from the seed (guards fixture rot).
const DIR = join(import.meta.dirname, '..', 'fixtures', 'conflict-d20');

describe('conflict-bench (d=0.20)', () => {
  it('detects exactly the planted conflicts: 1.0 with inference on, reasoning-dependent, episode-gated', async () => {
    const rows = await runTier1(getAdapter(), 'conflict-d20', DIR, 2);
    const enumId = 'conflict-d20-q01';
    const benignIds = ['conflict-d20-q04', 'conflict-d20-q05'];

    const cell = (ep: number, inf: 'on' | 'off'): ScoreRow =>
      rows.find((r) => r.episode === ep && r.inference === inf)!;

    // Final inference-ON accuracy is perfect: every planted conflict flagged
    // (recall), nothing benign flagged (precision), recall controls answered.
    expect(cell(2, 'on').accuracy).toBe(1);

    // Reasoning-dependence proof: with inference OFF at episode 2 the raw
    // contradictory triples sit in the abox, but the enumeration question
    // reads materialized j:ValueConflict flags and scores 0.
    expect(cell(2, 'off').perQuestion[enumId]).toBe(0);

    // Fixture integrity: before episode 2 no contradiction exists yet, so the
    // enumeration question scores 0 even with inference on.
    expect(cell(1, 'on').perQuestion[enumId]).toBe(0);

    // False-positive probe: duplicate re-assertions and multi-valued additions
    // must NOT be flagged by the reasoner (expected answer is false; a spurious
    // j:ValueConflict flag would flip the golden ASK to true and score 0).
    for (const id of benignIds) {
      expect(cell(2, 'on').perQuestion[id]).toBe(1);
    }

    // Positive reasoning lift at the final episode.
    expect(cell(2, 'on').lift!).toBeGreaterThan(0);
  }, 60_000);

  it('question set matches the CONFLICT-BENCH design (episode discipline, r22 under test)', () => {
    const questions = loadQuestions(DIR);
    expect(questions.length).toBe(8);
    const enumQ = questions.find((q) => q.id === 'conflict-d20-q01')!;
    expect(enumQ.type).toBe('conflict');
    expect(enumQ.reasoning_dependent).toBe(true);
    expect(enumQ.rule_under_test).toEqual(['r22']);
    expect(enumQ.needs_episode).toBe(2);
    expect(enumQ.golden_sparql).toContain('kg:inferred');
  });

  it('generator is deterministic: regenerating EVERY density reproduces ALL committed files byte-for-byte', () => {
    // Guards the whole benchmark against hand-edit drift: all densities, all
    // five files per fixture — not just d20's json pair.
    const FILES = ['world.ttl', 'episodes/e01.jsonl', 'episodes/e02.jsonl', 'oracle.json', 'questions.json'];
    for (const [domain, density] of Object.entries(DENSITIES)) {
      const tmp = mkdtempSync(join(tmpdir(), `conflict-bench-${domain}-`));
      writeConflictFixture(tmp, domain, density, SEED);
      const committed = join(import.meta.dirname, '..', 'fixtures', domain);
      for (const f of FILES) {
        expect(readFileSync(join(tmp, f), 'utf8'), `${domain}/${f}`).toBe(readFileSync(join(committed, f), 'utf8'));
      }
    }
  });
});
