import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { parseTBoxSchema } from '../exact/tbox.js';
import { readAllEpisodes } from '../exact/triple-index.js';
import { deriveInstances } from '../exact/instances.js';
import type { InstanceRecord, PredictionRow } from '../exact/contract.js';
import { ConflictWitnessIndex, type CwiWitnessedConflict } from './index.js';

/**
 * CWI runner (Amendment A3.3): ingest a fixture's episode stream in file
 * order (exercising incremental unions and late tau/sigma annotations), then
 * query each instance per subject-seed (worst-case-seed semantics) and emit
 * PredictionRows for the three registered retrieval-contract variants:
 *
 *   cwi-witness  context = the witness triples serialized (machine-checkable
 *                from context alone; the strict Def. 3.3 form)
 *   cwi-pointer  context = conflict tuple + 12-hex content hashes of the
 *                witness triples (dereference needed; clause-3 comparator)
 *   cwi-flag     context = conflict tuple only (witness field empty)
 *
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     pnpm --filter predicate-eval run cwi <domain>
 *
 * Writes results/cwi/cwi.<domain>.jsonl (rows) and
 * results/cwi/ledger.<domain>.json (maintenance ledger: ingest, update
 * amplification, index size, query latency p50/p95).
 */

const PKG_ROOT = join(import.meta.dirname, '..', '..');

const serializeTriple = (t: { s: string; p: string; o: string; lit?: boolean }): string =>
  t.lit === true ? `<${t.s}> <${t.p}> ${JSON.stringify(t.o)} .` : `<${t.s}> <${t.p}> <${t.o}> .`;

const hash12 = (x: string): string => createHash('sha256').update(x).digest('hex').slice(0, 12);

const percentile = (xs: number[], q: number): number => {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
};

/** The conflict relevant to an instance: predicate matches, supporting records within the instance's subjects. */
const matches = (c: CwiWitnessedConflict, inst: InstanceRecord): boolean =>
  c.predicate === inst.predicate && c.records.every((r) => inst.subjects.includes(r));

async function main(domain: string | undefined): Promise<void> {
  if (!domain) {
    console.error('usage: tsx src/cwi/run-cwi-cli.ts <domain>');
    process.exit(1);
  }
  const dir = join(PKG_ROOT, 'fixtures', domain);
  const schema = parseTBoxSchema(readFileSync(join(dir, 'world.ttl'), 'utf8'));
  const triples = readAllEpisodes(dir);
  const instances = deriveInstances(domain, dir);

  const t0 = performance.now();
  const index = new ConflictWitnessIndex(schema);
  for (const t of triples) index.insert(t);
  const ingestMs = performance.now() - t0;
  const stats = index.stats();

  const rows: PredictionRow[] = [];
  const queryMsAll: number[] = [];
  let spurious = 0;

  for (const inst of instances) {
    // Worst-case-seed semantics: every subject seeds its own query; flagged
    // requires the matching conflict from EVERY seed.
    const perSeed = inst.subjects.map((seed) => {
      const q0 = performance.now();
      const res = index.query(seed);
      const ms = performance.now() - q0;
      queryMsAll.push(ms);
      return { res, ms };
    });
    const matching = perSeed.map(({ res }) => res.conflicts.find((c) => matches(c, inst)) ?? null);
    const flagged = matching.every((m) => m !== null);
    const first = matching.find((m) => m !== null) ?? null;
    // Conflicts returned by any seed that belong to NO instance would be
    // spurious; count them (over the first seed only, instances partition seeds).
    spurious += perSeed[0]!.res.conflicts
      .filter((c) => !instances.some((i) => c.predicate === i.predicate && c.records.every((r) => i.subjects.includes(r))))
      .length;

    const costMs = Math.max(...perSeed.map((x) => x.ms));
    const witnessIds = first?.witnessIds ?? [];
    // Values aligned with subject order (mirrors goldValues); same-record
    // conflicts carry both values on the one subject.
    const values = first === null
      ? []
      : first.records[0] === first.records[1]
        ? [...first.values]
        : inst.subjects.flatMap((s) => (first.records[0] === s ? [first.values[0]] : first.records[1] === s ? [first.values[1]] : []));

    const tuple = first === null ? null : { predicate: first.predicate, records: first.records, values: first.values };
    const witnessText = (first?.witness ?? []).map(serializeTriple).join('\n');
    const pointerText = tuple === null ? '' : `${JSON.stringify(tuple)}\n${witnessIds.map(hash12).join('\n')}`;
    const flagText = tuple === null ? '' : JSON.stringify(tuple);

    const contexts = {
      'cwi-witness': { triples: first?.witness.length ?? 0, bytes: Buffer.byteLength(witnessText, 'utf8'), witness: witnessIds },
      'cwi-pointer': { triples: 0, bytes: Buffer.byteLength(pointerText, 'utf8'), witness: witnessIds },
      'cwi-flag': { triples: 0, bytes: Buffer.byteLength(flagText, 'utf8'), witness: [] as string[] },
    } as const;

    for (const [system, ctx] of Object.entries(contexts)) {
      rows.push({
        instanceId: inst.id, domain, system, flagged,
        values, witness: ctx.witness,
        costMs: Math.round(costMs * 10000) / 10000,
        extra: {
          variant: system.replace('cwi-', ''),
          contextTriples: ctx.triples,
          contextBytes: ctx.bytes,
          ingestMs: Number(ingestMs.toFixed(3)),
          insertWrites: stats.insertWrites,
          indexEntries: stats.indexEntries,
          sourceTriples: stats.sourceTriples,
        },
      });
    }
  }

  const outDir = join(PKG_ROOT, 'results', 'cwi');
  mkdirSync(outDir, { recursive: true });
  const outRows = join(outDir, `cwi.${domain}.jsonl`);
  writeFileSync(outRows, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

  const ledger = {
    domain,
    sourceTriples: stats.sourceTriples,
    ingestMs: Number(ingestMs.toFixed(3)),
    insertWrites: stats.insertWrites,
    updateAmplification: Number((stats.insertWrites / stats.sourceTriples).toFixed(3)),
    indexEntries: stats.indexEntries,
    queries: queryMsAll.length,
    queryMsTotal: Number(queryMsAll.reduce((a, b) => a + b, 0).toFixed(4)),
    queryMsP50: Number(percentile(queryMsAll, 0.5).toFixed(4)),
    queryMsP95: Number(percentile(queryMsAll, 0.95).toFixed(4)),
    spuriousConflicts: spurious,
    note: 'wall-clock fields are single-run and vary between rebuilds; counts are deterministic',
  };
  const outLedger = join(outDir, `ledger.${domain}.json`);
  writeFileSync(outLedger, JSON.stringify(ledger, null, 2) + '\n');

  const flaggedConflicts = rows.filter((r) => r.system === 'cwi-witness' && r.flagged
    && instances.find((i) => i.id === r.instanceId)?.isConflict).length;
  const conflictN = instances.filter((i) => i.isConflict).length;
  console.log(
    `${domain}: cwi ${flaggedConflicts}/${conflictN} conflicts flagged | ingest ${ingestMs.toFixed(1)}ms, `
    + `amplification ${ledger.updateAmplification}, entries ${stats.indexEntries}, `
    + `query p50 ${ledger.queryMsP50}ms p95 ${ledger.queryMsP95}ms, spurious ${spurious}`,
  );
  console.log(`wrote ${outRows}\nwrote ${outLedger}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv[2]).catch((e: unknown) => { console.error(e); process.exit(1); });
}
