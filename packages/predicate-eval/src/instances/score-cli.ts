/**
 * Instance-level scorer: joins PredictionRow JSONL files (any system) against
 * fixtures/<domain>/instances.json and reports, per system —
 *   conflict precision / recall / F1   (flagged vs isConflict)
 *   both-value recall                  (conflicts where BOTH goldValues appear in values)
 *   witness recall                     (mean goldWitness coverage over conflicts)
 *   mean costMs
 * clustered by instance kind so benign false-positive sources are visible per slice.
 *
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     pnpm --filter predicate-eval exec tsx src/instances/score-cli.ts \
 *       conflict-xr-small results/instances/reasoner-r14r23r22.conflict-xr-small.jsonl
 *
 * Writes results/instances/summary.<domain>.json. Instances with no
 * prediction row count as un-flagged (an FN if the instance is a conflict)
 * and are reported in `missing`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InstanceRecord, PredictionRow } from './types.js';

export interface KindCluster { n: number; flagged: number; missing: number }

export interface SystemScore {
  system: string;
  rows: number;
  missing: number;
  conflict: {
    tp: number; fp: number; fn: number; tn: number;
    precision: number; recall: number; f1: number;
  };
  /** Fraction of conflict instances where EVERY goldValue appears in values. */
  bothValueRecall: number | null;
  /** Mean per-conflict-instance goldWitness coverage. */
  witnessRecall: number | null;
  meanCostMs: number | null;
  perKind: Record<string, KindCluster>;
}

export function scorePredictions(
  instances: InstanceRecord[], rows: PredictionRow[],
): SystemScore[] {
  const bySystem = new Map<string, Map<string, PredictionRow>>();
  for (const r of rows) {
    const m = bySystem.get(r.system) ?? new Map<string, PredictionRow>();
    m.set(r.instanceId, r);
    bySystem.set(r.system, m);
  }

  const scores: SystemScore[] = [];
  for (const system of [...bySystem.keys()].sort()) {
    const preds = bySystem.get(system)!;
    let tp = 0, fp = 0, fn = 0, tn = 0, missing = 0;
    let bothValueHits = 0, witnessSum = 0, conflictN = 0;
    let costSum = 0, costN = 0;
    const perKind: Record<string, KindCluster> = {};

    for (const inst of instances) {
      const row = preds.get(inst.id);
      const flagged = row?.flagged ?? false;
      const kind = (perKind[inst.kind] ??= { n: 0, flagged: 0, missing: 0 });
      kind.n++;
      if (flagged) kind.flagged++;
      if (!row) { missing++; kind.missing++; }
      else { costSum += row.costMs; costN++; }

      if (inst.isConflict) {
        conflictN++;
        if (flagged) tp++; else fn++;
        const values = row?.values ?? [];
        if (inst.goldValues.every((v) => values.includes(v))) bothValueHits++;
        const witness = row?.witness ?? [];
        witnessSum += inst.goldWitness.length === 0
          ? 1
          : inst.goldWitness.filter((w) => witness.includes(w)).length / inst.goldWitness.length;
      } else {
        if (flagged) fp++; else tn++;
      }
    }

    const precision = tp + fp === 0 ? (fn === 0 ? 1 : 0) : tp / (tp + fp);
    const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    if (missing > 0) {
      // A missing row means the system's ids drifted from the canonical
      // manifest — it is scored as un-flagged, which can MASK a real FP/FN.
      console.error(
        `WARNING: ${system} has ${missing} instance(s) with no prediction row — `
        + 'id drift from the canonical manifest? Scored as un-flagged.',
      );
    }
    scores.push({
      system,
      rows: [...preds.values()].filter((r) => instances.some((i) => i.id === r.instanceId)).length,
      missing,
      conflict: { tp, fp, fn, tn, precision, recall, f1 },
      bothValueRecall: conflictN === 0 ? null : bothValueHits / conflictN,
      witnessRecall: conflictN === 0 ? null : witnessSum / conflictN,
      meanCostMs: costN === 0 ? null : costSum / costN,
      perKind,
    });
  }
  return scores;
}

export function renderScoreTable(domain: string, instances: InstanceRecord[], scores: SystemScore[]): string {
  const fmt = (x: number | null): string => (x === null ? '   -' : x.toFixed(2));
  const lines = [
    `Instance-level scoreboard — ${domain} (${instances.length} instances, ` +
    `${instances.filter((i) => i.isConflict).length} conflicts)`,
    'system                          P     R     F1    bothVal  witness  meanMs   missing',
  ];
  for (const s of scores) {
    lines.push(
      `${s.system.padEnd(30)} ${fmt(s.conflict.precision)}  ${fmt(s.conflict.recall)}  ` +
      `${fmt(s.conflict.f1)}    ${fmt(s.bothValueRecall)}     ${fmt(s.witnessRecall)}   ` +
      `${(s.meanCostMs === null ? '-' : s.meanCostMs.toFixed(0)).padStart(6)}   ${s.missing}`,
    );
    for (const [kind, c] of Object.entries(s.perKind)) {
      const note = kind === 'conflict'
        ? (c.flagged < c.n ? `  <- ${c.n - c.flagged} missed` : '')
        : (c.flagged > 0 ? `  <- FALSE POSITIVES` : '');
      lines.push(`    ${kind.padEnd(24)} flagged ${c.flagged}/${c.n}${note}`);
    }
  }
  return lines.join('\n');
}

function readRows(file: string): PredictionRow[] {
  return readFileSync(file, 'utf8')
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => JSON.parse(l) as PredictionRow);
}

function main(argv: string[]): void {
  const [domain, ...files] = argv;
  if (!domain || files.length === 0) {
    console.error('usage: tsx src/instances/score-cli.ts <domain> <predictions.jsonl> [...]');
    process.exit(1);
  }
  const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', domain);
  const manifestPath = join(fixtureDir, 'instances.json');
  let instances: InstanceRecord[];
  try {
    instances = JSON.parse(readFileSync(manifestPath, 'utf8')) as InstanceRecord[];
  } catch {
    console.error(`cannot read ${manifestPath} — run: tsx src/instances/build-manifest-cli.ts ${domain}`);
    process.exit(1);
  }

  const all: PredictionRow[] = [];
  let skipped = 0;
  for (const f of files) {
    for (const r of readRows(f)) {
      if (r.domain === domain) all.push(r); else skipped++;
    }
  }
  if (skipped > 0) console.error(`note: skipped ${skipped} rows from other domains`);

  const scores = scorePredictions(instances, all);
  console.log(renderScoreTable(domain, instances, scores));

  const outDir = join(import.meta.dirname, '..', '..', 'results', 'instances');
  mkdirSync(outDir, { recursive: true });
  const byKind: Record<string, number> = {};
  for (const i of instances) byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
  const out = join(outDir, `summary.${domain}.json`);
  writeFileSync(out, JSON.stringify({ domain, instanceCount: instances.length, byKind, systems: scores }, null, 2) + '\n');
  console.log(`\nwrote ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
