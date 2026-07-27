import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { ballContext } from '../rigs/flat-retrieved.js';
import {
  deriveInstances, keyAwareBall, keyProperties, loadDomainForRetrieval,
} from '../rigs/retrieval-policies.js';
import type { EpisodeTriple } from '../episode-runner.js';
import type { InstanceRecord, PredictionRow } from '../exact/contract.js';
import { parseTBoxSchema } from '../exact/tbox.js';
import { ConflictWitnessIndex, type CwiWitnessedConflict } from '../cwi/index.js';

/**
 * Strong adaptive baseline: expand the declared-key graph one layer at a
 * time, run an exact checker on the retrieved subgraph, and stop as soon as a
 * complete certificate is available. No persistent conflict index is kept.
 */

const PKG_ROOT = join(import.meta.dirname, '..', '..');

function parseTriples(context: string): EpisodeTriple[] {
  const triples: EpisodeTriple[] = [];
  for (const line of context.split('\n')) {
    const match = /^<([^>]+)> <([^>]+)> (.+) \.$/.exec(line.trim());
    if (!match) continue;
    if (match[3]!.startsWith('<')) {
      triples.push({ s: match[1]!, p: match[2]!, o: match[3]!.slice(1, -1) });
    } else {
      triples.push({
        s: match[1]!, p: match[2]!, o: JSON.parse(match[3]!) as string, lit: true,
      });
    }
  }
  return triples;
}

const relevant = (conflict: CwiWitnessedConflict, inst: InstanceRecord): boolean =>
  conflict.predicate === inst.predicate
  && conflict.records.every((record) => inst.subjects.includes(record));

export async function runAdaptiveKeyWitness(
  domain: string, dir: string, maxDepth = 8,
): Promise<PredictionRow[]> {
  const client = getAdapter();
  const { schema: schemaText } = await loadDomainForRetrieval(client, dir);
  const schema = parseTBoxSchema(schemaText);
  const keyProps = await keyProperties(client);
  const instances = deriveInstances(domain, dir);
  const rows: PredictionRow[] = [];

  for (const inst of instances) {
    const seedResults: Array<{
      found: CwiWitnessedConflict | null;
      depth: number | null;
      searchedTriples: number;
      ms: number;
    }> = [];
    for (const seed of inst.subjects) {
      const started = performance.now();
      let found: CwiWitnessedConflict | null = null;
      let foundDepth: number | null = null;
      let searchedTriples = 0;
      for (let depth = 1; depth <= maxDepth; depth++) {
        const ball = await keyAwareBall(client, [seed], depth, { keyProps });
        const context = await ballContext(client, ball.ball);
        const triples = parseTriples(context);
        searchedTriples = triples.length;
        const checker = new ConflictWitnessIndex(schema);
        for (const triple of triples) checker.insert(triple);
        found = checker.query(seed).conflicts.find((conflict) => relevant(conflict, inst)) ?? null;
        if (found !== null) {
          foundDepth = depth;
          break;
        }
      }
      seedResults.push({
        found,
        depth: foundDepth,
        searchedTriples,
        ms: performance.now() - started,
      });
    }

    const flagged = seedResults.every((result) => result.found !== null);
    const certificate = flagged ? seedResults[0]!.found : null;
    const witness = certificate?.witnessIds ?? [];
    rows.push({
      instanceId: inst.id,
      domain,
      system: 'adaptive-key-witness',
      flagged,
      values: certificate?.values ?? [],
      witness,
      costMs: Number(Math.max(...seedResults.map((result) => result.ms)).toFixed(4)),
      extra: {
        contextTriples: witness.length,
        contextBytes: Buffer.byteLength(witness.join('\n'), 'utf8'),
        searchDepth: flagged ? Math.max(...seedResults.map((result) => result.depth ?? 0)) : null,
        searchedTriples: Math.max(...seedResults.map((result) => result.searchedTriples)),
        maxDepth,
        maintainedState: false,
      },
    });
  }
  await client.close();
  return rows;
}

async function main(domain: string | undefined): Promise<void> {
  if (!domain) {
    console.error('usage: tsx src/ondemand/run-adaptive-key-witness-cli.ts <domain>');
    process.exit(1);
  }
  const dir = join(PKG_ROOT, 'fixtures', domain);
  const rows = await runAdaptiveKeyWitness(domain, dir);
  const out = join(PKG_ROOT, 'results', 'ondemand', `adaptive-key-witness.${domain}.jsonl`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  console.log(`${domain}: adaptive key witness wrote ${rows.length} rows to ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv[2]).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
