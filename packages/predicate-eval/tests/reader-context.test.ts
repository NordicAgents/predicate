import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadDomainForRetrieval } from '../src/rigs/retrieval-policies.js';
import {
  CONTEXT_SOURCES, READER_DOMAINS, buildAllContexts, readFrozenRetrieval, type BuiltContext,
} from '../src/reader/context-sources.js';
import { buildQ1Prompt, buildQ2Prompt, parseQ1, parseQ2 } from '../src/reader/prompts.js';
import type { InstanceRecord, PredictionRow } from '../src/instances/types.js';

/**
 * Reader arm (Amendment A5.2). The registered obligation this file enforces is
 * CONTEXT IDENTITY: the reader must be handed exactly what the frozen policy
 * returned, or every reader number describes a context no table in the paper
 * reports. Specifically:
 *
 *  - contextTriples per (instance, retrieval source) equals the FROZEN arm's
 *    contextTriples (results/retrieval/*.jsonl), which the reader must never
 *    recompute its way out of;
 *  - the rebuilt context's witness-completeness equals the frozen arm's
 *    `flagged` verdict — the WCR that H13a's ceiling is stated against;
 *  - cwi-witness context is exactly |W| triples, matching the frozen CWI rows;
 *  - flat-all is the whole store and is witness-complete on every conflict
 *    (it is the H13b competence gate's positive control — if IT were
 *    incomplete the gate would be measuring the wrong thing);
 *  - prompts never leak the answer.
 */

const PKG_ROOT = join(import.meta.dirname, '..');
const client = getAdapter();

interface Built { domain: string; instances: InstanceRecord[]; ctxs: Map<string, Map<string, BuiltContext>> }
const built: Built[] = [];

beforeAll(async () => {
  for (const domain of READER_DOMAINS) {
    const dir = join(PKG_ROOT, 'fixtures', domain);
    const instances = JSON.parse(readFileSync(join(dir, 'instances.json'), 'utf8')) as InstanceRecord[];
    await loadDomainForRetrieval(client, dir);
    const ctxs = await buildAllContexts(client, PKG_ROOT, domain, instances);
    built.push({ domain, instances, ctxs });
  }
}, 300_000);

describe('reader contexts are identical to the frozen arms (A5.2.2)', () => {
  it('covers the 7 registered domains and 188 instances (A5.2.3)', () => {
    expect(built.map((b) => b.domain).sort()).toEqual([...READER_DOMAINS].sort());
    const total = built.reduce((n, b) => n + b.instances.length, 0);
    const conflicts = built.reduce((n, b) => n + b.instances.filter((i) => i.isConflict).length, 0);
    expect(total).toBe(188);
    expect(conflicts).toBe(72);
    // xr-scale is registered as EXCLUDED; a silent re-inclusion would change the cell count.
    expect(READER_DOMAINS).not.toContain('conflict-xr-scale');
  });

  it('every instance has all 8 registered context sources', () => {
    for (const { instances, ctxs } of built) {
      for (const inst of instances) {
        const got = [...ctxs.get(inst.id)!.keys()].sort();
        expect(got).toEqual(CONTEXT_SOURCES.map((s) => s.name).sort());
      }
    }
  });

  it('retrieval contextTriples match the frozen retrieval rows exactly', () => {
    let checked = 0;
    for (const { domain, instances, ctxs } of built) {
      const frozen = readFrozenRetrieval(PKG_ROOT, domain);
      for (const src of CONTEXT_SOURCES.filter((s) => s.kind === 'retrieval')) {
        for (const inst of instances) {
          const f = frozen.get(`${inst.id}::retrieval:${src.policy}@${src.hops}`)!;
          const mine = ctxs.get(inst.id)!.get(src.name)!;
          expect(
            mine.contextTriples,
            `${domain} ${src.name} ${inst.id}: rebuilt context diverged from the frozen arm`,
          ).toBe((f.extra as { contextTriples: number }).contextTriples);
          checked++;
        }
      }
    }
    expect(checked).toBe(188 * 6);
  });

  it('rebuilt witness-completeness matches the frozen arm\'s flagged verdict', () => {
    for (const { domain, instances, ctxs } of built) {
      const frozen = readFrozenRetrieval(PKG_ROOT, domain);
      for (const src of CONTEXT_SOURCES.filter((s) => s.kind === 'retrieval')) {
        for (const inst of instances) {
          const f = frozen.get(`${inst.id}::retrieval:${src.policy}@${src.hops}`)!;
          const mine = ctxs.get(inst.id)!.get(src.name)!;
          expect(
            mine.witnessComplete,
            `${domain} ${src.name} ${inst.id}: WCR verdict diverged from the frozen arm`,
          ).toBe(f.flagged);
        }
      }
    }
  });

  it('cwi-witness context is exactly the frozen witness size', () => {
    for (const { domain, ctxs } of built) {
      const rows = readFileSync(join(PKG_ROOT, 'results', 'cwi', `cwi.${domain}.jsonl`), 'utf8')
        .split('\n').filter((l) => l.trim())
        .map((l) => JSON.parse(l) as PredictionRow)
        .filter((r) => r.system === 'cwi-witness');
      for (const r of rows) {
        const mine = ctxs.get(r.instanceId)?.get('cwi-witness');
        if (!mine) continue;
        expect(mine.contextTriples, `${domain} ${r.instanceId}`)
          .toBe((r.extra as { contextTriples: number }).contextTriples);
      }
    }
  });

  it('cwi-witness is witness-complete on every conflict; iri-bfs@1 never is on chains', () => {
    for (const { domain, instances, ctxs } of built) {
      for (const inst of instances.filter((i) => i.isConflict)) {
        expect(ctxs.get(inst.id)!.get('cwi-witness')!.witnessComplete, `${domain} ${inst.id}`).toBe(true);
        if (domain.startsWith('conflict-chain')) {
          // Prop. 3 empirically: no hop budget reaches the sparse intermediates.
          expect(ctxs.get(inst.id)!.get('iri-bfs@4')!.witnessComplete, `${domain} ${inst.id}`).toBe(false);
        }
      }
    }
  });

  it('flat-all is the whole store and witness-complete on every conflict (the H13b control)', () => {
    for (const { domain, instances, ctxs } of built) {
      const sizes = new Set(instances.map((i) => ctxs.get(i.id)!.get('flat-all')!.contextTriples));
      expect(sizes.size, `${domain}: flat-all must be identical for every instance`).toBe(1);
      for (const inst of instances.filter((i) => i.isConflict)) {
        expect(
          ctxs.get(inst.id)!.get('flat-all')!.witnessComplete,
          `${domain} ${inst.id}: the positive control must contain the witness`,
        ).toBe(true);
      }
    }
  });
});

describe('reader prompts (A5.2.4)', () => {
  it('do not leak the answer: no "conflict"/count hints, and both values never announced', () => {
    const { instances, ctxs } = built[0]!;
    const inst = instances.find((i) => i.isConflict)!;
    const ctx = ctxs.get(inst.id)!.get('iri-bfs@1')!;
    const q1 = buildQ1Prompt('# schema', ctx.facts, inst, inst.subjects[0]!);
    const q2 = buildQ2Prompt('# schema', ctx.facts, inst, inst.subjects[0]!);
    // The question may use the word "different values" but must never assert
    // that a conflict EXISTS, nor how many records the entity has.
    for (const p of [q1, q2]) {
      expect(p).not.toMatch(/there (is|are) (a )?conflict/i);
      expect(p).not.toMatch(/duplicate|two records|co-referent|same person/i);
    }
    // Q2 must offer all three outcomes, or "silent selection" is prompt-forced.
    expect(q2).toContain('"value"');
    expect(q2).toContain('"conflict"');
    expect(q2).toContain('"insufficient"');
  });

  it('parseQ1 handles fences, prose, and malformed output as a miss', () => {
    expect(parseQ1('{"answer": true, "values": ["a","b"]}')).toEqual({ flagged: true, values: ['a', 'b'] });
    expect(parseQ1('```json\n{"answer": false, "values": []}\n```')).toEqual({ flagged: false, values: [] });
    expect(parseQ1('Sure! {"answer": true, "values": ["x"]} hope that helps')).toEqual({ flagged: true, values: ['x'] });
    expect(parseQ1('I cannot answer that.')).toBeNull();
    expect(parseQ1('{"answer": "yes"}')).toBeNull();
  });

  it('parseQ2 classifies the three registered outcomes; conflict beats a co-reported value', () => {
    expect(parseQ2('{"value": "Building A"}').outcome).toBe('single-value');
    expect(parseQ2('{"conflict": ["A","C"]}').outcome).toBe('conflict-reported');
    expect(parseQ2('{"insufficient": true}').outcome).toBe('abstain');
    expect(parseQ2('{"value": "A", "conflict": ["A","C"]}').outcome).toBe('conflict-reported');
    expect(parseQ2('no idea').outcome).toBe('unparseable');
  });
});
