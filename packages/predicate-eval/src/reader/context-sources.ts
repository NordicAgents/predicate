/**
 * Reader-arm context sources (pre-registration Amendment A5.2.2).
 *
 * The reader is handed EXACTLY what a frozen policy returned — this module
 * writes no retrieval logic of its own. Every context is produced by the
 * frozen code paths (rigs/retrieval-policies.ts, src/cwi/), which A5.5 pins as
 * read-only dependencies of this arm.
 *
 * The eight registered sources:
 *
 *   iri-bfs@1        the 0-recall floor
 *   iri-bfs@4        complete-only-by-returning-the-store
 *   key-aware@1      below chain depth
 *   key-aware@2      the chain-m2 flip point (k = m)
 *   key-aware@3      the chain-m3 flip point (k = m)
 *   literal-aware@1  the non-key-literal premium point
 *   cwi-witness      the witness point (strict Def. 3.3 contract)
 *   flat-all         whole store — the POSITIVE CONTROL for the H13b
 *                    competence gate
 *
 * Seed identity (A5.2.2): for the six retrieval sources the reader sees the
 * ball grown from the seed the FROZEN arm reported in `extra.seededOn` — read
 * out of results/retrieval/retrieval.<domain>.jsonl rather than recomputed, so
 * the reader and the retrieval table cannot silently diverge on which seed's
 * worst case is being described.
 *
 * Every source is composed as schema + facts, the way flat-retrieved composes
 * context today. The schema is constant across sources, so it advantages none
 * of them; `contextTriples`/`contextBytes` are reported over the FACTS only,
 * which is what the policies' own ledgers measure.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { ballContext } from '../rigs/flat-retrieved.js';
import { ballForPolicy, parseContext, type RetrievalPolicy } from '../rigs/retrieval-policies.js';
import { parseTBoxSchema } from '../exact/tbox.js';
import { readAllEpisodes } from '../exact/triple-index.js';
import { ConflictWitnessIndex, type CwiWitnessedConflict } from '../cwi/index.js';
import type { InstanceRecord, PredictionRow } from '../instances/types.js';

/** One registered context source. */
export interface ContextSource {
  /** Registered name, used verbatim in the PredictionRow `system` field. */
  readonly name: string;
  readonly kind: 'retrieval' | 'cwi' | 'flat';
  readonly policy?: RetrievalPolicy;
  readonly hops?: number;
}

/** The eight sources of A5.2.2, in registered order. Do not extend without an amendment. */
export const CONTEXT_SOURCES: readonly ContextSource[] = [
  { name: 'iri-bfs@1', kind: 'retrieval', policy: 'iri-bfs', hops: 1 },
  { name: 'iri-bfs@4', kind: 'retrieval', policy: 'iri-bfs', hops: 4 },
  { name: 'key-aware@1', kind: 'retrieval', policy: 'key-aware', hops: 1 },
  { name: 'key-aware@2', kind: 'retrieval', policy: 'key-aware', hops: 2 },
  { name: 'key-aware@3', kind: 'retrieval', policy: 'key-aware', hops: 3 },
  { name: 'literal-aware@1', kind: 'retrieval', policy: 'literal-aware', hops: 1 },
  { name: 'cwi-witness', kind: 'cwi' },
  { name: 'flat-all', kind: 'flat' },
] as const;

/** The seven reader-arm domains (A5.2.3). `conflict-xr-scale` is registered as EXCLUDED. */
export const READER_DOMAINS: readonly string[] = [
  'conflict-d20',
  'conflict-xr-small',
  'conflict-chain-m2',
  'conflict-chain-m3',
  'conflict-h3-nk1',
  'conflict-h3-nk3',
  'conflict-tausig',
] as const;

/** One instance's context under one source. */
export interface BuiltContext {
  /** The facts the policy returned, as N-Triples (schema NOT included). */
  facts: string;
  /** Triple count over the facts (parse of the N-Triples). */
  contextTriples: number;
  /** Byte count over the facts. */
  contextBytes: number;
  /** The seed this context was grown from; null for whole-store / witness sources. */
  seed: string | null;
  /**
   * Whether the returned facts contain EVERY goldWitness triple — the frozen
   * arm's witness-completeness verdict for this cell. Carried through so the
   * H13a ceiling can be checked per cell without re-deriving WCR.
   */
  witnessComplete: boolean;
  /** How many of the instance's gold VALUES appear in the returned facts (0, 1, or 2). */
  goldValuesPresent: number;
}

const serializeTriple = (t: { s: string; p: string; o: string; lit?: boolean }): string =>
  t.lit === true ? `<${t.s}> <${t.p}> ${JSON.stringify(t.o)} .` : `<${t.s}> <${t.p}> <${t.o}> .`;

/** The conflict relevant to an instance (identical predicate/record test to run-cwi-cli.ts). */
const matches = (c: CwiWitnessedConflict, inst: InstanceRecord): boolean =>
  c.predicate === inst.predicate && c.records.every((r) => inst.subjects.includes(r));

/** Read the frozen retrieval rows and index them by (instanceId, system). */
export function readFrozenRetrieval(pkgRoot: string, domain: string): Map<string, PredictionRow> {
  const file = join(pkgRoot, 'results', 'retrieval', `retrieval.${domain}.jsonl`);
  const byKey = new Map<string, PredictionRow>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const row = JSON.parse(t) as PredictionRow;
    byKey.set(`${row.instanceId}::${row.system}`, row);
  }
  return byKey;
}

/** Whole-store facts: every kg:abox triple, sorted — the flat-all positive control. */
async function wholeStoreFacts(client: StorageAdapter): Promise<string> {
  const r = await client.select('SELECT ?s ?p ?o WHERE { GRAPH <kg:abox> { ?s ?p ?o } }');
  const lines = r.results.bindings.map((b) => {
    const o = b.o!;
    const oStr = o.type === 'uri' ? `<${o.value}>` : JSON.stringify(o.value);
    return `<${b.s!.value}> <${b.p!.value}> ${oStr} .`;
  });
  return lines.sort().join('\n');
}

function summarize(facts: string, seed: string | null, inst: InstanceRecord): BuiltContext {
  const { ids, objects } = parseContext(facts);
  return {
    facts,
    contextTriples: ids.size,
    contextBytes: Buffer.byteLength(facts, 'utf8'),
    seed,
    witnessComplete: inst.goldWitness.every((w) => ids.has(w)),
    goldValuesPresent: inst.goldValues.filter((v) => objects.has(v)).length,
  };
}

/**
 * Build every registered context for every instance of one domain.
 *
 * The store must already be loaded (loadDomainForRetrieval). Returns
 * instanceId -> sourceName -> BuiltContext.
 */
export async function buildAllContexts(
  client: StorageAdapter,
  pkgRoot: string,
  domain: string,
  instances: InstanceRecord[],
): Promise<Map<string, Map<string, BuiltContext>>> {
  const dir = join(pkgRoot, 'fixtures', domain);
  const frozen = readFrozenRetrieval(pkgRoot, domain);
  const out = new Map<string, Map<string, BuiltContext>>();
  for (const inst of instances) out.set(inst.id, new Map());

  // --- the six retrieval sources, seeded from the frozen arm's seededOn ---
  for (const src of CONTEXT_SOURCES.filter((s) => s.kind === 'retrieval')) {
    for (const inst of instances) {
      const frozenRow = frozen.get(`${inst.id}::retrieval:${src.policy}@${src.hops}`);
      if (!frozenRow) {
        throw new Error(
          `no frozen retrieval row for ${inst.id} :: retrieval:${src.policy}@${src.hops} — `
          + 'the reader arm must not invent a seed the frozen arm never reported (A5.2.2)',
        );
      }
      const seed = (frozenRow.extra as { seededOn?: string }).seededOn;
      if (!seed) throw new Error(`frozen row ${inst.id}::${frozenRow.system} has no extra.seededOn`);
      const pb = await ballForPolicy(client, src.policy!, [seed], src.hops!);
      const facts = await ballContext(client, pb.ball);
      out.get(inst.id)!.set(src.name, summarize(facts, seed, inst));
    }
  }

  // --- cwi-witness: rebuilt with the frozen index, same worst-seed logic as run-cwi-cli ---
  const schema = parseTBoxSchema(readFileSync(join(dir, 'world.ttl'), 'utf8'));
  const index = new ConflictWitnessIndex(schema);
  for (const t of readAllEpisodes(dir)) index.insert(t);
  for (const inst of instances) {
    const matching = inst.subjects.map((s) => index.query(s).conflicts.find((c) => matches(c, inst)) ?? null);
    const first = matching.find((m) => m !== null) ?? null;
    const facts = (first?.witness ?? []).map(serializeTriple).sort().join('\n');
    out.get(inst.id)!.set('cwi-witness', summarize(facts, null, inst));
  }

  // --- flat-all: whole store, identical for every instance ---
  const whole = await wholeStoreFacts(client);
  for (const inst of instances) {
    out.get(inst.id)!.set('flat-all', summarize(whole, null, inst));
  }

  return out;
}
