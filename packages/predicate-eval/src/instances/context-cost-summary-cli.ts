import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { PredictionRow } from '../exact/contract.js';
import { deriveInstances } from '../exact/instances.js';

const PKG_ROOT = join(import.meta.dirname, '..', '..');

const FAMILIES = [
  ['D20', 'conflict-d20'],
  ['XR-small', 'conflict-xr-small'],
  ['XR-scale', 'conflict-xr-scale'],
  ['Chain-2', 'conflict-chain-m2'],
  ['Chain-3', 'conflict-chain-m3'],
  ['H3-NK1', 'conflict-h3-nk1'],
  ['H3-NK3', 'conflict-h3-nk3'],
  ['TauSig', 'conflict-tausig'],
] as const;

interface CostSummary {
  system: string;
  parameter: number | null;
  triples: { mean: number; max: number };
  bytes: { mean: number; max: number };
}

interface FamilySummary {
  family: string;
  domain: string;
  instances: number;
  conflicts: number;
  storeTriples: number;
  exactWitness: CostSummary;
  keyAware: CostSummary;
  bm25: CostSummary;
  dense: CostSummary;
  hybrid: CostSummary;
}

export interface ContextCostSummary {
  costScope: string;
  selectionRule: string;
  families: FamilySummary[];
}

function rowsAt(path: string): PredictionRow[] {
  return readFileSync(path, 'utf8').trim().split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PredictionRow);
}

function round(x: number, digits: number): number {
  return Number(x.toFixed(digits));
}

function summarize(rows: PredictionRow[], system: string, parameter: number | null): CostSummary {
  if (rows.length === 0) throw new Error(`no rows for ${system}`);
  const triples = rows.map((row) => Number(row.extra.contextTriples));
  const bytes = rows.map((row) => Number(row.extra.contextBytes));
  if ([...triples, ...bytes].some((value) => !Number.isFinite(value))) {
    throw new Error(`missing context cost for ${system}`);
  }
  return {
    system,
    parameter,
    triples: {
      mean: round(triples.reduce((sum, value) => sum + value, 0) / triples.length, 1),
      max: Math.max(...triples),
    },
    bytes: {
      mean: round(bytes.reduce((sum, value) => sum + value, 0) / bytes.length, 0),
      max: Math.max(...bytes),
    },
  };
}

function queryReturnableStoreTriples(rows: PredictionRow[]): number {
  const counts = rows.map((row) => Number(row.extra.contextTriples));
  if (counts.length === 0 || counts.some((value) => !Number.isFinite(value))) {
    throw new Error('missing query-returnable store size');
  }
  return Math.max(...counts);
}

function smallestComplete(
  rows: PredictionRow[],
  prefix: string,
  conflictIds: Set<string>,
): CostSummary {
  const systems = [...new Set(rows.map((row) => row.system))]
    .filter((system) => system.startsWith(`${prefix}@`))
    .map((system) => ({
      system,
      parameter: Number(system.slice(system.lastIndexOf('@') + 1)),
    }))
    .sort((a, b) => a.parameter - b.parameter);
  for (const candidate of systems) {
    const selected = rows.filter(
      (row) => row.system === candidate.system && conflictIds.has(row.instanceId),
    );
    if (
      selected.length === conflictIds.size
      && selected.every((row) => row.flagged)
    ) {
      return summarize(selected, candidate.system, candidate.parameter);
    }
  }
  throw new Error(`no complete configuration for ${prefix}`);
}

export function buildContextCostSummary(): ContextCostSummary {
  const families: FamilySummary[] = [];
  for (const [family, domain] of FAMILIES) {
    const fixture = join(PKG_ROOT, 'fixtures', domain);
    const instances = deriveInstances(domain, fixture);
    const conflictIds = new Set(
      instances.filter((instance) => instance.isConflict).map((instance) => instance.id),
    );
    const cwiRows = rowsAt(join(PKG_ROOT, 'results', 'cwi', `cwi.${domain}.jsonl`));
    const retrievalRows = rowsAt(
      join(PKG_ROOT, 'results', 'retrieval', `retrieval.${domain}.jsonl`),
    );
    const denseRows = rowsAt(join(PKG_ROOT, 'results', 'dense', `dense.${domain}.jsonl`));
    const exactRows = cwiRows.filter(
      (row) => row.system === 'cwi-witness' && conflictIds.has(row.instanceId),
    );
    if (exactRows.length !== conflictIds.size || !exactRows.every((row) => row.flagged)) {
      throw new Error(`CWI is not complete for ${domain}`);
    }
    families.push({
      family,
      domain,
      instances: instances.length,
      conflicts: conflictIds.size,
      // Match the paper's context-cost boundary: source assertions a policy can
      // return, excluding the separately supplied oracle schema.
      storeTriples: queryReturnableStoreTriples([...retrievalRows, ...denseRows]),
      exactWitness: summarize(exactRows, 'cwi-witness', null),
      keyAware: smallestComplete(retrievalRows, 'retrieval:key-aware', conflictIds),
      bm25: smallestComplete(retrievalRows, 'retrieval:bm25', conflictIds),
      dense: smallestComplete(denseRows, 'retrieval:dense-minilm', conflictIds),
      hybrid: smallestComplete(denseRows, 'retrieval:hybrid-rrf', conflictIds),
    });
  }
  return {
    costScope:
      'UTF-8 bytes and logical triples of query-returned source assertions; the shared oracle schema is excluded',
    selectionRule:
      'smallest tested parameter whose returned context contains a complete witness for every conflict in the family',
    families,
  };
}

function main(): void {
  const summary = buildContextCostSummary();
  const output = join(PKG_ROOT, 'results', 'instances', 'context-cost-summary.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`wrote ${output}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
