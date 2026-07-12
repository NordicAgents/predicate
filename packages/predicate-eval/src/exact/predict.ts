import type { TripleIndex } from './triple-index.js';
import { tripleId, RDF_TYPE, type Detection, type InstanceRecord, type PredictionRow } from './contract.js';

/**
 * Map raw Detections onto the shared-contract instances (PredictionRow per
 * instance) and score at the instance level:
 *   TP = conflict instance flagged, FN = conflict instance missed,
 *   FP = benign instance flagged (strictest definition: ANY detection touching
 *        any of the instance's subjects counts — safe because gold conflict
 *        subjects and benign subjects are disjoint in every fixture).
 * Detections that map to no conflict instance are reported separately as
 * spurious (they cannot hide inside instance-level precision).
 */

export interface ExactScore {
  system: string;
  domain: string;
  instances: number;
  conflictInstances: number;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  /** benign kind -> false positives inside that slice. */
  fpBySlice: Record<string, number>;
  spuriousDetections: number;
}

const matchesConflict = (d: Detection, inst: InstanceRecord): boolean =>
  d.predicate === inst.predicate && inst.subjects.every((s) => d.subjects.includes(s));

const touches = (d: Detection, inst: InstanceRecord): boolean =>
  inst.subjects.some((s) => d.subjects.includes(s));

/** Witness triples a detection can cite, ordered per the given subjects. */
function detectionWitness(d: Detection, subjects: string[], index: TripleIndex): string[] {
  const w: string[] = [];
  if (d.key !== null && d.keyProp !== null) {
    for (const s of subjects) for (const t of index.values(s, RDF_TYPE)) w.push(tripleId(s, RDF_TYPE, t));
    for (const s of subjects) w.push(tripleId(s, d.keyProp, d.key));
  }
  for (const s of subjects) for (const v of index.values(s, d.predicate)) w.push(tripleId(s, d.predicate, v));
  return w;
}

export function buildPredictionRows(opts: {
  instances: InstanceRecord[];
  detections: Detection[];
  index: TripleIndex;
  system: string;
  totalMs: number;
  extraBase?: Record<string, unknown>;
}): { rows: PredictionRow[]; score: ExactScore } {
  const { instances, detections, index, system } = opts;
  const costMs = instances.length > 0 ? opts.totalMs / instances.length : opts.totalMs;
  const extra = {
    ...opts.extraBase,
    amortized: true,
    totalDomainMs: Number(opts.totalMs.toFixed(3)),
    detections: detections.length,
  };

  const rows: PredictionRow[] = [];
  let tp = 0; let fp = 0; let fn = 0;
  const fpBySlice: Record<string, number> = {};

  for (const inst of instances) {
    let flagged = false;
    let values: string[] = [];
    let witness: string[] = [];
    if (inst.isConflict) {
      const d = detections.find((x) => matchesConflict(x, inst));
      if (d) {
        flagged = true;
        // Per-subject value order (s1's value first) to mirror goldValues.
        for (const s of inst.subjects) {
          for (const v of index.values(s, d.predicate)) if (!values.includes(v)) values.push(v);
        }
        witness = detectionWitness(d, inst.subjects, index);
      }
      if (flagged) tp++; else fn++;
    } else {
      const hits = detections.filter((x) => touches(x, inst));
      flagged = hits.length > 0;
      if (flagged) {
        fp++;
        fpBySlice[inst.kind] = (fpBySlice[inst.kind] ?? 0) + 1;
        values = [...new Set(hits.flatMap((h) => h.values))].sort();
        witness = hits.flatMap((h) => detectionWitness(h, inst.subjects.filter((s) => h.subjects.includes(s)), index));
      }
    }
    rows.push({
      instanceId: inst.id, domain: inst.domain, system,
      flagged, values, witness, costMs: Number(costMs.toFixed(4)), extra,
    });
  }

  // Any detection matching NO conflict instance is spurious.
  const spurious = detections.filter(
    (d) => !instances.some((i) => i.isConflict && matchesConflict(d, i)),
  ).length;

  const conflictInstances = instances.filter((i) => i.isConflict).length;
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    rows,
    score: {
      system, domain: instances[0]?.domain ?? '', instances: instances.length,
      conflictInstances, tp, fp, fn, precision, recall, f1, fpBySlice,
      spuriousDetections: spurious,
    },
  };
}
