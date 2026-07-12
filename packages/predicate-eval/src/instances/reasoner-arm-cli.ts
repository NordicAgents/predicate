/**
 * The reasoner as a MEASURED SYSTEM over the instance-level benchmark.
 *
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     pnpm --filter predicate-eval exec tsx src/instances/reasoner-arm-cli.ts conflict-xr-small
 *
 * Loads world.ttl -> kg:tbox, ALL episodes -> kg:abox, seeds provenance
 * (MANDATORY: closureEligible excludes un-annotated abox triples), then runs
 * ONLY the chain under study — r14 (owl:hasKey -> owl:sameAs), r23 (sameAs
 * propagates j:SingleValued values), r22 (two values -> j:ValueConflict) —
 * via runFixpoint, NOT the full RULES set. Deep imports
 * `predicate-reasoner/src/{fixpoint,rules/*}.js` resolve fine (the package
 * has no "exports" map; the eval package already deep-imports src/index.js),
 * so no FusekiConstructAdapter subclass fallback was needed.
 *
 * Emits one PredictionRow per instance to
 * results/instances/reasoner-r14r23r22.<domain>.jsonl. v1 domains run the
 * same chain (r14/r23 find nothing; r22 fires on same-subject pairs).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runFixpoint } from 'predicate-reasoner/src/fixpoint.js';
import { r14 } from 'predicate-reasoner/src/rules/r14-has-key.js';
import { r22 } from 'predicate-reasoner/src/rules/r22-value-conflict.js';
import { r23 } from 'predicate-reasoner/src/rules/r23-sameas-value-propagation.js';
import { readEpisode, applyEpisodeTriples } from '../episode-runner.js';
import { seedProvenance } from '../provenance.js';
import { buildInstanceManifest } from './manifest.js';
import type { PredictionRow } from './types.js';
import { parseTripleId } from './types.js';

export const SYSTEM = 'reasoner-r14r23r22';

const J = 'https://industriagents.com/predicate/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const GRAPHS = ['kg:tbox', 'kg:abox', 'kg:inferred', 'kg:usage', 'kg:provenance'] as const;

/**
 * SPARQL term for a triple-id object. IRI-vs-literal is decided by the
 * oracle's own lit flags (via a Set of literal triple ids), not by sniffing
 * the value — a literal that happens to start with http:// or a urn:/mailto:
 * IRI would otherwise be misclassified and silently fail the witness ASK.
 * The regex is only a fallback for ids absent from the oracle index.
 */
const term = (o: string, tid: string, literalIds: ReadonlySet<string>): string => {
  if (literalIds.has(tid)) return JSON.stringify(o);
  if (/^[a-z][a-z0-9+.-]*:/i.test(o)) return `<${o}>`;
  return JSON.stringify(o);
};

/** Triple ids ("s|p|o") the oracle marks as literal-valued. */
function literalTripleIds(fixtureDir: string): Set<string> {
  const oracle = JSON.parse(readFileSync(join(fixtureDir, 'oracle.json'), 'utf8')) as {
    facts: { s: string; p: string; o: string; lit?: boolean }[];
  };
  return new Set(oracle.facts.filter((f) => f.lit === true).map((f) => `${f.s}|${f.p}|${f.o}`));
}

export interface ReasonerArmResult {
  rows: PredictionRow[];
  materializeMs: number;
  iterations: number;
  inferredCount: number;
}

export async function runReasonerArm(
  client: StorageAdapter, domain: string, fixtureDir: string,
): Promise<ReasonerArmResult> {
  const instances = buildInstanceManifest(fixtureDir);
  const literalIds = literalTripleIds(fixtureDir);

  // Fresh graphs, TBox + ALL episodes, provenance gate, then the 3-rule chain.
  for (const g of GRAPHS) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  await client.loadTurtle(readFileSync(join(fixtureDir, 'world.ttl'), 'utf8'), 'kg:tbox');
  const episodeFiles = readdirSync(join(fixtureDir, 'episodes'))
    .filter((f) => f.endsWith('.jsonl')).sort();
  for (const f of episodeFiles) {
    await applyEpisodeTriples(client, readEpisode(join(fixtureDir, 'episodes', f)));
  }
  await seedProvenance(client);

  const t0 = performance.now();
  const { iterations, inferredCount } = await runFixpoint(client, [r14, r23, r22], {
    tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], inferredGraph: 'kg:inferred', closureCutoff: 0.5,
  });
  const materializeMs = performance.now() - t0;

  const rows: PredictionRow[] = [];
  for (const inst of instances) {
    // flagged := EVERY subject of the instance is typed j:ValueConflict.
    const subjectFlags: boolean[] = [];
    for (const s of inst.subjects) {
      subjectFlags.push(await client.ask(
        `ASK { GRAPH <kg:inferred> { <${s}> <${RDF_TYPE}> <${J}ValueConflict> } }`,
      ));
    }
    const flagged = subjectFlags.every(Boolean);

    // values := what the store holds for the predicate under test, per
    // subject, over kg:abox UNION kg:inferred (r23's propagated values live
    // in kg:inferred).
    const values = new Set<string>();
    if (inst.predicate !== null) {
      for (const s of inst.subjects) {
        const r = await client.select(`
          SELECT DISTINCT ?v WHERE {
            { GRAPH <kg:abox> { <${s}> <${inst.predicate}> ?v } }
            UNION
            { GRAPH <kg:inferred> { <${s}> <${inst.predicate}> ?v } }
          }`);
        for (const b of r.results.bindings) values.add(b.v!.value);
      }
    }

    // witness := goldWitness triples CONFIRMED present in kg:abox by query —
    // the reasoner can always cite its sources, but we verify rather than
    // copy the gold.
    const witness: string[] = [];
    for (const w of inst.goldWitness) {
      const { s, p, o } = parseTripleId(w);
      if (await client.ask(`ASK { GRAPH <kg:abox> { <${s}> <${p}> ${term(o, w, literalIds)} } }`)) witness.push(w);
    }

    rows.push({
      instanceId: inst.id, domain, system: SYSTEM, flagged,
      values: [...values].sort(), witness,
      costMs: Math.round(materializeMs * 100) / 100,
      extra: { iterations, inferredCount, subjectsFlagged: subjectFlags.filter(Boolean).length },
    });
  }
  return { rows, materializeMs, iterations, inferredCount };
}

async function main(domain: string | undefined): Promise<void> {
  if (!domain) {
    console.error('usage: tsx src/instances/reasoner-arm-cli.ts <domain>');
    process.exit(1);
  }
  const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', domain);
  const client = getAdapter();
  const { rows, materializeMs, iterations, inferredCount } = await runReasonerArm(client, domain, fixtureDir);

  const outDir = join(import.meta.dirname, '..', '..', 'results', 'instances');
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${SYSTEM}.${domain}.jsonl`);
  writeFileSync(out, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

  const flaggedTotal = rows.filter((r) => r.flagged).length;
  console.log(
    `${domain}: ${rows.length} instances, ${flaggedTotal} flagged | ` +
    `materialize ${materializeMs.toFixed(0)}ms, ${iterations} iterations, ` +
    `${inferredCount} inferred triples -> ${out}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv[2]).catch((e: unknown) => { console.error(e); process.exit(1); });
}
