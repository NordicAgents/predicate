/**
 * B-bounded completeness curves (pre-registration Amendment A4.1 — the
 * registered §4.3 primary metric), computed from the FROZEN PredictionRow
 * files only: the retrieval sweep (results/retrieval/retrieval.<domain>.jsonl)
 * and the cwi-witness arm (results/cwi/cwi.<domain>.jsonl), over conflict
 * instances of fixtures/<domain>/instances.json.
 *
 * Two registered readings are emitted per (system, budget) point:
 *   primaryRate     — Def. 5.3 truncation reading, the PRIMARY curve:
 *                     fraction of ALL conflict instances with flagged === true
 *                     AND returned context <= B (truncation beyond B cannot
 *                     preserve a whole witness, by Def. 2.1 minimality).
 *   conditionalRate — the §4.3-literal reading: among conflict instances with
 *                     context <= B (n of them), the fraction flagged; null
 *                     when n = 0. Emitted because tiny-n conditioning can
 *                     read high while the primary rate is low.
 * The "whole-store" point applies no context cap.
 *
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     pnpm exec tsx src/instances/bcurves-cli.ts <domain>
 *
 * Writes results/curves/bcurves.<domain>.json — deterministic (no timestamps,
 * canonical key order). Instances with no prediction row for a system count
 * as un-flagged with INFINITE context (consistent with the scorer's missing
 * rule) and trigger the same loud id-drift warning.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InstanceRecord, PredictionRow } from './types.js';

/** A4.1 grids, exact. The trailing whole-store point is appended per system. */
export const TRIPLES_GRID: readonly number[] = [5, 10, 25, 50, 100, 250, 500, 1000];
export const BYTES_GRID: readonly number[] = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072];

export interface BCurveGrids { triples: readonly number[]; bytes: readonly number[] }

export interface BCurvePoint {
  budget: number | 'whole-store';
  primaryRate: number;
  conditionalRate: number | null;
  /** Denominator of conditionalRate: conflict instances with context <= budget. */
  n: number;
}

export interface SystemBCurves {
  system: string;
  triples: BCurvePoint[];
  bytes: BCurvePoint[];
}

export interface BCurvesResult {
  domain: string;
  conflictInstances: number;
  grids: { triples: number[]; bytes: number[] };
  systems: SystemBCurves[];
}

/** Systems in scope for A4.1: the retrieval sweep + the cwi-witness arm only. */
function inScope(system: string): boolean {
  return system.startsWith('retrieval:') || system === 'cwi-witness';
}

interface ConflictObs { flagged: boolean; contextTriples: number; contextBytes: number }

function contextOf(row: PredictionRow, field: 'contextTriples' | 'contextBytes'): number {
  const v = row.extra[field];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`row ${row.system}/${row.instanceId}: extra.${field} is not a finite number`);
  }
  return v;
}

function curve(
  obs: ConflictObs[], conflictN: number,
  grid: readonly number[], field: 'contextTriples' | 'contextBytes',
): BCurvePoint[] {
  const points: BCurvePoint[] = [];
  for (const budget of grid) {
    const within = obs.filter((o) => o[field] <= budget);
    const flaggedWithin = within.filter((o) => o.flagged).length;
    points.push({
      budget,
      primaryRate: conflictN === 0 ? 0 : flaggedWithin / conflictN,
      conditionalRate: within.length === 0 ? null : flaggedWithin / within.length,
      n: within.length,
    });
  }
  // Whole-store: no context cap. Missing rows (Infinity context) are included
  // here as un-flagged, so this equals the plain flagged rate over conflicts.
  const flaggedAll = obs.filter((o) => o.flagged).length;
  points.push({
    budget: 'whole-store',
    primaryRate: conflictN === 0 ? 0 : flaggedAll / conflictN,
    conditionalRate: conflictN === 0 ? null : flaggedAll / conflictN,
    n: conflictN,
  });
  return points;
}

/**
 * Pure core: prediction rows (retrieval sweep + cwi variants; out-of-scope
 * systems are ignored) + instance manifest + grids in, curves out.
 */
export function computeBCurves(
  domain: string,
  instances: InstanceRecord[],
  rows: PredictionRow[],
  grids: BCurveGrids = { triples: TRIPLES_GRID, bytes: BYTES_GRID },
): BCurvesResult {
  const conflicts = instances.filter((i) => i.isConflict);
  const bySystem = new Map<string, Map<string, PredictionRow>>();
  for (const r of rows) {
    if (r.domain !== domain || !inScope(r.system)) continue;
    const m = bySystem.get(r.system) ?? new Map<string, PredictionRow>();
    m.set(r.instanceId, r);
    bySystem.set(r.system, m);
  }

  const systems: SystemBCurves[] = [];
  for (const system of [...bySystem.keys()].sort()) {
    const preds = bySystem.get(system)!;
    const obs: ConflictObs[] = [];
    let missing = 0;
    for (const inst of conflicts) {
      const row = preds.get(inst.id);
      if (!row) {
        // Same rule as the scorer: un-flagged; infinite context keeps the
        // instance out of every finite-budget point.
        missing++;
        obs.push({ flagged: false, contextTriples: Infinity, contextBytes: Infinity });
        continue;
      }
      obs.push({
        flagged: row.flagged === true,
        contextTriples: contextOf(row, 'contextTriples'),
        contextBytes: contextOf(row, 'contextBytes'),
      });
    }
    if (missing > 0) {
      // A missing row means the system's ids drifted from the canonical
      // manifest — it is scored as un-flagged, which can MASK a real FP/FN.
      console.error(
        `WARNING: ${system} has ${missing} conflict instance(s) with no prediction row — `
        + 'id drift from the canonical manifest? Scored as un-flagged (infinite context).',
      );
    }
    systems.push({
      system,
      triples: curve(obs, conflicts.length, grids.triples, 'contextTriples'),
      bytes: curve(obs, conflicts.length, grids.bytes, 'contextBytes'),
    });
  }

  return {
    domain,
    conflictInstances: conflicts.length,
    grids: { triples: [...grids.triples], bytes: [...grids.bytes] },
    systems,
  };
}

/** Canonical serialization: fixed key order (from construction), no timestamps. */
export function serializeBCurves(result: BCurvesResult): string {
  return JSON.stringify(result, null, 2) + '\n';
}

/** Compact system x triples-grid primaryRate table. */
export function renderBCurveTable(result: BCurvesResult): string {
  const budgets = result.systems[0]?.triples.map((p) => p.budget) ?? [];
  const header = ['system'.padEnd(30), ...budgets.map((b) => String(b).padStart(6))].join(' ');
  const lines = [
    `B-bounded completeness (primaryRate, triples grid) — ${result.domain} ` +
    `(${result.conflictInstances} conflict instances)`,
    header,
  ];
  for (const s of result.systems) {
    lines.push([
      s.system.padEnd(30),
      ...s.triples.map((p) => p.primaryRate.toFixed(2).padStart(6)),
    ].join(' '));
  }
  return lines.join('\n');
}

function readRows(file: string): PredictionRow[] {
  return readFileSync(file, 'utf8')
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => JSON.parse(l) as PredictionRow);
}

function main(argv: string[]): void {
  const [domain] = argv;
  if (!domain) {
    console.error('usage: tsx src/instances/bcurves-cli.ts <domain>');
    process.exit(1);
  }
  const root = join(import.meta.dirname, '..', '..');
  const manifestPath = join(root, 'fixtures', domain, 'instances.json');
  let instances: InstanceRecord[];
  try {
    instances = JSON.parse(readFileSync(manifestPath, 'utf8')) as InstanceRecord[];
  } catch {
    console.error(`cannot read ${manifestPath} — run: tsx src/instances/build-manifest-cli.ts ${domain}`);
    process.exit(1);
  }
  const rows: PredictionRow[] = [];
  for (const rel of [
    join('results', 'retrieval', `retrieval.${domain}.jsonl`),
    join('results', 'cwi', `cwi.${domain}.jsonl`),
  ]) {
    const file = join(root, rel);
    try {
      rows.push(...readRows(file));
    } catch {
      console.error(`cannot read ${file} — run the corresponding arm first`);
      process.exit(1);
    }
  }

  const result = computeBCurves(domain, instances, rows);
  console.log(renderBCurveTable(result));

  const outDir = join(root, 'results', 'curves');
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `bcurves.${domain}.json`);
  writeFileSync(out, serializeBCurves(result));
  console.log(`\nwrote ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
