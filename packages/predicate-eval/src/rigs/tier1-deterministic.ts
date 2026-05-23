import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadOracle, deriveAnswerKey } from '../oracle.js';
import { loadQuestions } from '../questions.js';
import { readEpisode, applyEpisodeTriples, rematerialize } from '../episode-runner.js';
import { collectMetrics } from '../metrics.js';
import { scoreSet, scoreBoolean, scoreConflict } from '../scorer.js';
import type { Question, ScoreRow, AnswerKey } from '../eval-types.js';

const META = 'https://industriagents.com/predicate/meta#';

const GRAPHS = ['kg:tbox', 'kg:abox', 'kg:inferred', 'kg:usage', 'kg:provenance'] as const;

function episodePaths(domainDir: string): string[] {
  return readdirSync(join(domainDir, 'episodes'))
    .filter((f) => f.endsWith('.jsonl')).sort()
    .map((f) => join(domainDir, 'episodes', f));
}

/**
 * Annotate every triple in kg:abox with confidence=1 in kg:provenance.
 * This is required for closureEligible() to include abox triples in reasoning
 * (it excludes triples that have no provenance annotation).
 */
async function seedProvenance(client: StorageAdapter): Promise<void> {
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT {
      GRAPH <kg:provenance> {
        << ?s ?p ?o >> pred:confidence "1"^^xsd:decimal .
      }
    }
    WHERE {
      GRAPH <kg:abox> { ?s ?p ?o }
      FILTER NOT EXISTS {
        GRAPH <kg:provenance> { << ?s ?p ?o >> pred:confidence ?c }
      }
    }
  `);
}

async function runGolden(client: StorageAdapter, q: Question): Promise<AnswerKey> {
  if (q.type === 'boolean') return { kind: 'boolean', value: await client.ask(q.golden_sparql) };
  if (q.type === 'conflict') {
    const r = await client.select(q.golden_sparql);
    return { kind: 'conflict', ids: new Set(r.results.bindings.map((b) => Object.values(b)[0]!.value)) };
  }
  const r = await client.select(q.golden_sparql);
  const vals = r.results.bindings.map((b) => Object.values(b)[0]!.value);
  return { kind: 'set', values: new Set(vals) };
}

function score(expected: AnswerKey, got: AnswerKey): number {
  if (expected.kind === 'set' && got.kind === 'set') return scoreSet(expected.values, got.values).f1;
  if (expected.kind === 'boolean' && got.kind === 'boolean') return scoreBoolean(expected.value, got.value).f1;
  if (expected.kind === 'conflict' && got.kind === 'conflict') return scoreConflict(expected.ids, got.ids).f1;
  return 0;
}

export async function runTier1(
  client: StorageAdapter, domain: string, domainDir: string, episodes: number,
): Promise<ScoreRow[]> {
  const oracle = loadOracle(domainDir);
  const questions = loadQuestions(domainDir);
  const world = readFileSync(join(domainDir, 'world.ttl'), 'utf8');
  const paths = episodePaths(domainDir);
  const runId = `${domain}-${Date.now()}`;
  const rows: ScoreRow[] = [];

  for (let ep = 1; ep <= episodes; ep++) {
    const accByInference: Record<'on' | 'off', number> = { on: 0, off: 0 };
    for (const inference of ['on', 'off'] as const) {
      // Reset all graphs to prevent leakage between (episode, inference) cells.
      for (const g of GRAPHS) {
        await client.update(`DROP SILENT GRAPH <${g}>`);
        await client.update(`CREATE SILENT GRAPH <${g}>`);
      }
      await client.loadTurtle(world, 'kg:tbox');
      for (let i = 0; i < ep; i++) await applyEpisodeTriples(client, readEpisode(paths[i]!));
      // Annotate all abox triples with confidence=1 so closureEligible includes them.
      await seedProvenance(client);
      const ms = await rematerialize(client, inference === 'on');

      const perQuestion: Record<string, number> = {};
      let sum = 0;
      for (const q of questions) {
        // Score against FINAL ground truth (cutoff = last episode), not the current
        // episode. This is the compounding signal: early episodes score lower because
        // the graph has not captured those facts yet, and accuracy climbs toward 1.0
        // as episodes arrive. Do NOT change this to `ep` — that yields a flat 1.0 curve.
        const expected = deriveAnswerKey(oracle, q.key, q.type, episodes);
        const got = await runGolden(client, q);
        const f1 = score(expected, got);
        perQuestion[q.id] = f1;
        sum += f1;
      }
      const accuracy = questions.length ? sum / questions.length : 0;
      accByInference[inference] = accuracy;
      rows.push({
        runId, timestamp: new Date().toISOString(), domain, tier: 'tier1',
        episode: ep, inference, accuracy, perQuestion,
        boundedness: await collectMetrics(client, ms),
      });
    }
    const onRow = rows.find((r) => r.episode === ep && r.inference === 'on')!;
    onRow.lift = accByInference.on - accByInference.off;
  }
  return rows;
}
