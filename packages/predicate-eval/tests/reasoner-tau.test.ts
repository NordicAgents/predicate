import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runReasonerTauArm, SYSTEM } from '../src/instances/reasoner-tau-cli.js';
import { scorePredictions } from '../src/instances/score-cli.js';
import type { InstanceRecord, PredictionRow } from '../src/instances/types.js';

/**
 * H12 end-to-end (pre-registration Amendment A4.3): the τ/σ-aware chain
 * r14 → r23t → r22t as a measured system.
 *
 *  (i)  On conflict-tausig it scores P = R = 1 with ZERO flags on every
 *       benign slice (benign-temporal / benign-scoped / benign-coreference),
 *       scored by the unchanged scorer against the committed manifest.
 *  (ii) On the τ/σ-free domains conflict-chain-m2 and conflict-xr-small its
 *       flagged-instance set is IDENTICAL to the frozen blind arm's
 *       committed rows (results/instances/reasoner-r14r23r22.<domain>.jsonl)
 *       — the extension changes nothing where annotations are absent.
 *
 * (Runs under the vitest-injected PREDICATE_BACKEND=oxigraph-wasm,
 * PREDICATE_STORE_PATH=:memory: env.)
 */

const fixtures = join(import.meta.dirname, '..', 'fixtures');
const results = join(import.meta.dirname, '..', 'results', 'instances');

const committedManifest = (domain: string): InstanceRecord[] =>
  JSON.parse(readFileSync(join(fixtures, domain, 'instances.json'), 'utf8')) as InstanceRecord[];

const committedBlindRows = (domain: string): PredictionRow[] =>
  readFileSync(join(results, `reasoner-r14r23r22.${domain}.jsonl`), 'utf8')
    .trim().split('\n').map((l) => JSON.parse(l) as PredictionRow);

const flaggedIds = (rows: PredictionRow[]): string[] =>
  rows.filter((r) => r.flagged).map((r) => r.instanceId).sort();

describe('reasoner-tau (H12)', () => {
  it('conflict-tausig: P = R = 1 with zero flags on every benign slice', async () => {
    const domain = 'conflict-tausig';
    const { rows } = await runReasonerTauArm(getAdapter(), domain, join(fixtures, domain));
    const instances = committedManifest(domain);
    expect(rows).toHaveLength(instances.length);

    const scores = scorePredictions(instances, rows);
    expect(scores).toHaveLength(1);
    const s = scores[0]!;
    expect(s.system).toBe(SYSTEM);
    expect(s.missing).toBe(0);
    expect(s.conflict.tp).toBe(12);
    expect(s.conflict.fn).toBe(0);
    expect(s.conflict.fp).toBe(0);
    expect(s.conflict.precision).toBe(1);
    expect(s.conflict.recall).toBe(1);
    for (const kind of ['benign-temporal', 'benign-scoped', 'benign-coreference'] as const) {
      expect(s.perKind[kind]?.flagged, `${kind} must have zero flags`).toBe(0);
    }
  }, 120_000);

  it.each(['conflict-chain-m2', 'conflict-xr-small'])(
    '%s: flagged-instance set IDENTICAL to the committed blind arm rows',
    async (domain) => {
      const { rows } = await runReasonerTauArm(getAdapter(), domain, join(fixtures, domain));
      const blind = committedBlindRows(domain);
      expect(rows).toHaveLength(blind.length);
      expect(flaggedIds(rows)).toEqual(flaggedIds(blind));
    },
    120_000,
  );
});
