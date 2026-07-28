import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { EpisodeTriple } from '../episode-runner.js';
import { RDF_TYPE } from '../exact/contract.js';
import type { TBoxSchema } from '../exact/tbox.js';
import { ConflictWitnessIndex } from './index.js';

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const EX = 'https://example.org/cwi-class-stress/';
const PERSON = `${EX}PersonRecord`;
const KEY = `${EX}key`;
const VALUE = `${EX}value`;
const REPETITIONS = 11;

const schema: TBoxSchema = {
  prefixes: {},
  keyedClasses: new Map([[PERSON, [KEY]]]),
  singleValued: new Set([VALUE]),
  validFromProp: null,
  validToProp: null,
  scopeProp: null,
};

function triplesFor(records: number): EpisodeTriple[] {
  const identity: EpisodeTriple[] = [];
  const values: EpisodeTriple[] = [];
  for (let i = 0; i < records; i++) {
    const record = `${EX}record-${i}`;
    identity.push(
      { s: record, p: RDF_TYPE, o: PERSON },
      { s: record, p: KEY, o: 'one-class', lit: true },
    );
    values.push({ s: record, p: VALUE, o: `value-${i}`, lit: true });
  }
  return [...identity, ...values];
}

const ordered = (xs: number[]): number[] => [...xs].sort((a, b) => a - b);
const median = (xs: number[]): number => ordered(xs)[Math.floor(xs.length / 2)]!;
const quartile = (xs: number[], q: number): number =>
  ordered(xs)[Math.floor((xs.length - 1) * q)]!;

const rows = [8, 16, 32, 64, 128, 256].map((records) => {
  const triples = triplesFor(records);
  const times: number[] = [];
  let stats: ReturnType<ConflictWitnessIndex['stats']> | null = null;
  for (let run = 0; run < REPETITIONS + 1; run++) {
    const index = new ConflictWitnessIndex(schema);
    const start = performance.now();
    for (const triple of triples) index.insert(triple);
    const elapsed = performance.now() - start;
    if (run > 0) times.push(elapsed);
    stats = index.stats();
  }
  const expectedPairs = records * (records - 1) / 2;
  if (stats?.materializedConflicts !== expectedPairs) {
    throw new Error(
      `${records}: expected ${expectedPairs} pairs, got ${stats?.materializedConflicts}`,
    );
  }
  return {
    records,
    sourceTriples: triples.length,
    materializedConflicts: expectedPairs,
    ingestMsMedian: Number(median(times).toFixed(3)),
    ingestMsIqr: [
      Number(quartile(times, 0.25).toFixed(3)),
      Number(quartile(times, 0.75).toFixed(3)),
    ],
  };
});

const outDir = join(PKG_ROOT, 'results', 'budget');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'class-stress.json');
writeFileSync(out, `${JSON.stringify({
  repetitions: REPETITIONS,
  warmups: 1,
  rows,
  note: 'All records share one exact key and have distinct constrained values; timings are descriptive.',
}, null, 2)}\n`);
console.log(`wrote ${out}`);
