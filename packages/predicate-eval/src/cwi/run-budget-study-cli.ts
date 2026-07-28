import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EpisodeTriple } from '../episode-runner.js';
import { RDF_TYPE } from '../exact/contract.js';
import type { TBoxSchema } from '../exact/tbox.js';
import { queryCwiWithBudget } from './budget.js';
import { ConflictWitnessIndex } from './index.js';

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const EX = 'https://example.org/cwi-budget/';
const PERSON = `${EX}PersonRecord`;
const KEY = `${EX}key`;

interface StudyRow {
  family: 'shared' | 'disjoint';
  conflicts: number;
  sourceTriples: number;
  independentWitnessSum: number;
  jointWitnessTriples: number;
  sharingSavedTriples: number;
  belowBudgetStatus: string;
  exactBudgetStatus: string;
}

function schema(conflicts: number): TBoxSchema {
  return {
    prefixes: {},
    keyedClasses: new Map([[PERSON, [KEY]]]),
    singleValued: new Set(
      Array.from({ length: conflicts }, (_, i) => `${EX}value-${i + 1}`),
    ),
    validFromProp: null,
    validToProp: null,
    scopeProp: null,
  };
}

const type = (record: string): EpisodeTriple =>
  ({ s: record, p: RDF_TYPE, o: PERSON });
const key = (record: string, value: string): EpisodeTriple =>
  ({ s: record, p: KEY, o: value, lit: true });
const assertion = (record: string, predicate: string, value: string): EpisodeTriple =>
  ({ s: record, p: predicate, o: value, lit: true });

function sharedCase(conflicts: number): { triples: EpisodeTriple[]; seeds: string[] } {
  const a = `${EX}shared-a`;
  const b = `${EX}shared-b`;
  const triples: EpisodeTriple[] = [type(a), type(b), key(a, 'shared-key'), key(b, 'shared-key')];
  for (let i = 1; i <= conflicts; i++) {
    triples.push(
      assertion(a, `${EX}value-${i}`, `left-${i}`),
      assertion(b, `${EX}value-${i}`, `right-${i}`),
    );
  }
  return { triples, seeds: [a] };
}

function disjointCase(conflicts: number): { triples: EpisodeTriple[]; seeds: string[] } {
  const triples: EpisodeTriple[] = [];
  const seeds: string[] = [];
  for (let i = 1; i <= conflicts; i++) {
    const a = `${EX}disjoint-${i}-a`;
    const b = `${EX}disjoint-${i}-b`;
    seeds.push(a);
    triples.push(
      type(a), type(b), key(a, `key-${i}`), key(b, `key-${i}`),
      assertion(a, `${EX}value-${i}`, `left-${i}`),
      assertion(b, `${EX}value-${i}`, `right-${i}`),
    );
  }
  return { triples, seeds };
}

function runFamily(family: StudyRow['family'], conflicts: number): StudyRow {
  const generated = family === 'shared' ? sharedCase(conflicts) : disjointCase(conflicts);
  const index = new ConflictWitnessIndex(schema(conflicts));
  for (const triple of generated.triples) index.insert(triple);

  const unlimited = queryCwiWithBudget(index, generated.seeds, Number.MAX_SAFE_INTEGER);
  if (unlimited.status !== 'complete' || unlimited.relevantConflictCount !== conflicts) {
    throw new Error(`${family}-${conflicts}: expected ${conflicts} complete conflicts`);
  }
  const exact = queryCwiWithBudget(index, generated.seeds, unlimited.requiredTriples);
  const below = queryCwiWithBudget(index, generated.seeds, Math.max(0, unlimited.requiredTriples - 1));
  const independentWitnessSum = unlimited.conflicts
    .reduce((sum, conflict) => sum + conflict.witness.length, 0);

  return {
    family,
    conflicts,
    sourceTriples: generated.triples.length,
    independentWitnessSum,
    jointWitnessTriples: unlimited.requiredTriples,
    sharingSavedTriples: independentWitnessSum - unlimited.requiredTriples,
    belowBudgetStatus: below.status,
    exactBudgetStatus: exact.status,
  };
}

const rows: StudyRow[] = [];
for (const conflicts of [1, 2, 4, 8, 16, 32]) {
  rows.push(runFamily('shared', conflicts), runFamily('disjoint', conflicts));
}

const outDir = join(PKG_ROOT, 'results', 'budget');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'multi-conflict.json');
writeFileSync(out, `${JSON.stringify({
  measure: 'serialized logical triple count',
  rows,
  note: 'Deterministic unique-path constructions; joint witness cost is exact for both families.',
}, null, 2)}\n`);
console.log(`wrote ${out}`);
