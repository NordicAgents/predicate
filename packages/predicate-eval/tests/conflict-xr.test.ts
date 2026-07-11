import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runTier1 } from '../src/rigs/tier1-deterministic.js';
import { ballFor, buildRetrievedTasks } from '../src/rigs/flat-retrieved.js';
import { writeXrFixture, XR_VARIANTS, SEED_V2 } from '../src/conflict/generate-v2.js';
import { loadQuestions } from '../src/questions.js';

const client = getAdapter();
const DIR = join(import.meta.dirname, '..', 'fixtures', 'conflict-xr-small');

describe('CONFLICT-BENCH v2 — cross-record conflicts (hasKey → sameAs → r23 → r22)', () => {
  it('tier1 xr-small: full accuracy with inference ON; cross-record questions unanswerable with inference OFF', async () => {
    const rows = await runTier1(client, 'conflict-xr-small', DIR, 2);
    const at = (ep: number, inf: 'on' | 'off'): (typeof rows)[number] =>
      rows.find((r) => r.episode === ep && r.inference === inf)!;

    // Final state, inference ON: every question correct.
    expect(at(2, 'on').accuracy).toBe(1);

    // The cross-record questions are REASONING-DEPENDENT: with inference off
    // there is no sameAs, no value propagation, no flag — enumeration and the
    // planted booleans score 0. q06 (both offices) is PARTIALLY answerable
    // from the seed record's own value: recall 1/2, precision 1 → F1 = 2/3 —
    // exactly the "confidently returns ONE value, silently missing the
    // conflict" failure mode the benchmark measures.
    const off2 = at(2, 'off').perQuestion;
    for (const qid of ['q01', 'q02', 'q03']) {
      expect(off2[`conflict-xr-small-${qid}`], `${qid} with inference off`).toBe(0);
    }
    expect(off2['conflict-xr-small-q06']).toBeCloseTo(2 / 3, 5);

    // Fixture integrity: before episode 2 no conflict exists yet.
    expect(at(1, 'on').perQuestion['conflict-xr-small-q01']).toBe(0);

    // False-positive probes hold with inference ON (benign co-reference and
    // shared-office subjects are NOT flagged).
    const on2 = at(2, 'on').perQuestion;
    expect(on2['conflict-xr-small-q04']).toBe(1);
    expect(on2['conflict-xr-small-q05']).toBe(1);
  }, 240_000);

  it('STRUCTURAL MISS (deterministic): the co-referent record is outside every k<=2 retrieval ball', async () => {
    // Replay both episodes via the retrieval task builder (it resets kg:abox),
    // then inspect the balls directly. Pair 0 is person p002: s1-p002 (office2)
    // and s2-p002 (a sparse update sharing ONLY the email literal).
    const tasks = await buildRetrievedTasks(client, 'conflict-xr-small', DIR, 2, 2);

    const twin = 'http://ex/cb2/s1-p002';
    const seed = 'http://ex/cb2/s2-p002';

    for (const hops of [1, 2]) {
      const ball = await ballFor(client, [seed], hops);
      expect(ball.has(twin), `s1-p002 in ball(s2-p002, hops=${hops})`).toBe(false);
    }

    // Therefore the retrieval-scoped context for the conflict question about
    // s2-p002 (q02) contains neither the twin record nor its office value —
    // the conflict is INVISIBLE to this arm no matter how strong the model.
    const q02 = tasks.find((t) => t.id === 'conflict-xr-small-q02')!;
    expect(q02.context).not.toContain('s1-p002');
    // s1-p002's office is office2 (i=2, 2 % 5); s2-p002 carries a different one.
    expect(q02.context).not.toContain('office2>');

    // Sanity: the context DOES contain the seed record and the schema's key
    // semantics — the arm is not information-starved, just retrieval-bounded.
    expect(q02.context).toContain('s2-p002');
    expect(q02.context).toContain('same email describe the SAME person');
  }, 60_000);

  it('generator is deterministic: every variant reproduces all committed files byte-for-byte', () => {
    const FILES = ['world.ttl', 'episodes/e01.jsonl', 'episodes/e02.jsonl', 'oracle.json', 'questions.json'];
    for (const [domain, variant] of Object.entries(XR_VARIANTS)) {
      const tmp = mkdtempSync(join(tmpdir(), `conflict-xr-${domain}-`));
      writeXrFixture(tmp, domain, variant, SEED_V2);
      const committed = join(import.meta.dirname, '..', 'fixtures', domain);
      for (const f of FILES) {
        expect(readFileSync(join(tmp, f), 'utf8'), `${domain}/${f}`).toBe(readFileSync(join(committed, f), 'utf8'));
      }
    }
  });

  it('question hygiene: seeds point at existing records; conflict questions are needs_episode 2', () => {
    const questions = loadQuestions(DIR);
    expect(questions.length).toBe(8);
    for (const q of questions) {
      if (q.id.endsWith('q01')) expect(q.retrieval_seeds).toBeUndefined();
      if (['q02', 'q03', 'q04', 'q06'].some((s) => q.id.endsWith(s))) {
        expect(q.needs_episode).toBe(2);
        expect(q.retrieval_seeds?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
