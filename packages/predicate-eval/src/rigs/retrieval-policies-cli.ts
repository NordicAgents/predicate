import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import {
  RETRIEVAL_POLICIES, type RetrievalPolicy, type PredictionRow,
  deriveInstances, evaluateInstance, keyProperties, loadDomainForRetrieval,
} from './retrieval-policies.js';

/**
 * Retrieval-policy sweep over a conflict fixture (publication plan §8).
 *
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     pnpm --filter predicate-eval exec tsx src/rigs/retrieval-policies-cli.ts \
 *       <domain> [--policies iri-bfs,literal-aware,key-aware,bm25]
 *       [--hops 1,2,3,4] [--bm25-k 1,2,4,8,16,32,64,128,256,512]
 *
 * Loads world.ttl + ALL episodes into a fresh kg:tbox/kg:abox, derives the
 * contract's InstanceRecords from oracle.json, and for every (policy, hops,
 * instance) writes one PredictionRow (worst-case seed semantics) to
 * results/retrieval/retrieval.<domain>.jsonl, then prints the policy x hops
 * matrix of witness-complete rate and context cost.
 */

function usage(): never {
  console.error(
    'usage: tsx src/rigs/retrieval-policies-cli.ts <domain> '
    + '[--policies iri-bfs,literal-aware,key-aware,bm25] '
    + '[--hops 1,2,3,4] [--bm25-k 1,2,4,8,16,32,64,128,256,512]',
  );
  process.exit(1);
}

function parseList(args: string[], flag: string, fallback: string[]): string[] {
  const i = args.indexOf(flag);
  if (i < 0) return fallback;
  const v = args[i + 1];
  if (!v) usage();
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const domain = args[0];
  if (!domain || domain.startsWith('--')) usage();

  const policies = parseList(args, '--policies', [...RETRIEVAL_POLICIES]) as RetrievalPolicy[];
  for (const p of policies) {
    if (!(RETRIEVAL_POLICIES as readonly string[]).includes(p)) {
      console.error(`unknown policy: ${p}`); usage();
    }
  }
  const hopsList = parseList(args, '--hops', ['1', '2', '3', '4']).map(Number);
  const bm25KList = parseList(
    args, '--bm25-k', ['1', '2', '4', '8', '16', '32', '64', '128', '256', '512'],
  ).map(Number);
  if (hopsList.some((h) => !Number.isInteger(h) || h < 1)) usage();
  if (bm25KList.some((k) => !Number.isInteger(k) || k < 1)) usage();

  const dir = join(import.meta.dirname, '..', '..', 'fixtures', domain);
  if (!existsSync(join(dir, 'oracle.json'))) {
    console.error(`no such fixture domain: ${dir}`); process.exit(1);
  }

  const client = getAdapter();
  const { episodesLoaded } = await loadDomainForRetrieval(client, dir);
  const keyProps = await keyProperties(client);
  const instances = deriveInstances(domain, dir);
  const nConflict = instances.filter((i) => i.isConflict).length;
  console.log(
    `${domain}: ${instances.length} instances (${nConflict} conflict), `
    + `${episodesLoaded} episodes, keyProps=[${keyProps.join(', ')}]`,
  );

  const rows: PredictionRow[] = [];
  const cells: Array<{
    policy: string; hops: number; flaggedConflicts: number;
    ctxTriples: number[]; ctxBytes: number[]; ballNodes: number[];
  }> = [];

  for (const policy of policies) {
    const parameters = policy === 'bm25' ? bm25KList : hopsList;
    for (const hops of parameters) {
      const cell = {
        policy, hops, flaggedConflicts: 0,
        ctxTriples: [] as number[], ctxBytes: [] as number[], ballNodes: [] as number[],
      };
      for (const inst of instances) {
        const row = await evaluateInstance(client, policy, hops, inst, { keyProps });
        rows.push(row);
        if (inst.isConflict && row.flagged) cell.flaggedConflicts++;
        // Cost columns share the rate's denominator: conflict instances only.
        // (Benign-instance rows are still emitted to the JSONL for the scorer.)
        if (!inst.isConflict) continue;
        cell.ctxTriples.push(row.extra.contextTriples as number);
        cell.ctxBytes.push(row.extra.contextBytes as number);
        cell.ballNodes.push(row.extra.ballNodes as number);
      }
      cells.push(cell);
    }
  }

  const out = join(import.meta.dirname, '..', '..', 'results', 'retrieval', `retrieval.${domain}.jsonl`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`wrote ${rows.length} prediction rows to ${out}\n`);

  console.log(`matrix — ${domain} (all columns over the ${nConflict} conflict instances, worst-case seed)`);
  console.log(
    'policy         hops  witness-complete  mean-ctx-triples  max-ctx-triples  mean-ctx-bytes  mean-ball-nodes',
  );
  for (const c of cells) {
    const rate = nConflict ? c.flaggedConflicts / nConflict : 0;
    console.log(
      `${c.policy.padEnd(13)} ${String(c.hops).padStart(4)}  `
      + `${`${c.flaggedConflicts}/${nConflict}`.padStart(5)} (${rate.toFixed(2)})     `
      + `${mean(c.ctxTriples).toFixed(1).padStart(12)}     `
      + `${String(Math.max(...c.ctxTriples)).padStart(11)}     `
      + `${mean(c.ctxBytes).toFixed(0).padStart(10)}      `
      + `${mean(c.ballNodes).toFixed(1).padStart(11)}`,
    );
  }

  await client.close();
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
