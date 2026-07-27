import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runKeyJoinX } from '../exact/key-join-x.js';
import { deriveInstances } from '../exact/instances.js';
import { buildPredictionRows } from '../exact/predict.js';
import type { PredictionRow } from '../exact/contract.js';

/**
 * Strong no-maintenance baseline: for every query, scan the current store,
 * close key equivalence, detect conflicts, and return the exact source witness.
 *
 * Unlike CWI, this baseline keeps no state between queries. It therefore has
 * the same witness-sized output contract but pays the full exact-join cost on
 * every query. This is the architectural comparison the paper needs:
 * materialized witness view versus on-demand witness computation.
 */

const PKG_ROOT = join(import.meta.dirname, '..', '..');

function contextBytes(witness: string[]): number {
  // Triple ids are the artifact's canonical lossless identifiers. Measuring
  // their UTF-8 payload avoids pretending this baseline has zero context cost.
  return Buffer.byteLength(witness.join('\n'), 'utf8');
}

export function runOnDemandWitness(domain: string, dir: string): PredictionRow[] {
  const instances = deriveInstances(domain, dir);
  const rows: PredictionRow[] = [];

  for (const inst of instances) {
    const result = runKeyJoinX(dir);
    const prediction = buildPredictionRows({
      instances,
      detections: result.detections,
      index: result.index,
      system: 'on-demand-witness',
      totalMs: result.timings.totalMs * instances.length,
      extraBase: {
        execution: 'fresh full-store exact join per query; no maintained state',
        phaseMs: {
          setup: Number(result.timings.setupMs.toFixed(3)),
          detect: Number(result.timings.detectMs.toFixed(3)),
        },
      },
    }).rows.find((row) => row.instanceId === inst.id);
    if (!prediction) throw new Error(`missing on-demand prediction for ${inst.id}`);
    rows.push({
      ...prediction,
      // buildPredictionRows normally reports amortized batch cost. Here the
      // exact computation was rerun for this one query, so report it directly.
      costMs: Number(result.timings.totalMs.toFixed(4)),
      extra: {
        ...prediction.extra,
        amortized: false,
        contextTriples: prediction.witness.length,
        contextBytes: contextBytes(prediction.witness),
      },
    });
  }
  return rows;
}

function main(domain: string | undefined): void {
  if (!domain) {
    console.error('usage: tsx src/ondemand/run-ondemand-witness-cli.ts <domain>');
    process.exit(1);
  }
  const dir = join(PKG_ROOT, 'fixtures', domain);
  const rows = runOnDemandWitness(domain, dir);
  const out = join(PKG_ROOT, 'results', 'ondemand', `ondemand-witness.${domain}.jsonl`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');

  const conflicts = rows.filter((row) => row.flagged);
  const meanMs = rows.reduce((sum, row) => sum + row.costMs, 0) / Math.max(1, rows.length);
  const meanTriples = conflicts.reduce(
    (sum, row) => sum + Number(row.extra.contextTriples), 0,
  ) / Math.max(1, conflicts.length);
  console.log(
    `${domain}: on-demand witness ${conflicts.length} flagged; `
    + `mean query ${meanMs.toFixed(2)}ms; mean conflict context ${meanTriples.toFixed(1)} triples`,
  );
  console.log(`wrote ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv[2]);
