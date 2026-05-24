import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadOracle, deriveAnswerKey } from '../oracle.js';
import { loadQuestions } from '../questions.js';
import { readEpisode, applyEpisodeTriples, rematerialize } from '../episode-runner.js';
import { seedProvenance } from '../provenance.js';
import { scoreSet, scoreBoolean, scoreConflict } from '../scorer.js';
import type { AnswerKey, Question } from '../eval-types.js';
import type { Tier2Row } from '../tier2-types.js';

function episodePaths(dir: string): string[] {
  return readdirSync(join(dir, 'episodes'))
    .filter((f) => f.endsWith('.jsonl')).sort()
    .map((f) => join(dir, 'episodes', f));
}

interface RunResult { key: AnswerKey; valid: boolean; nonEmpty: boolean; }

async function runDrafted(client: StorageAdapter, q: Question, sparql: string): Promise<RunResult> {
  try {
    if (q.type === 'boolean') {
      const v = await client.ask(sparql);
      return { key: { kind: 'boolean', value: v }, valid: true, nonEmpty: v };
    }
    const r = await client.select(sparql);
    const vals = r.results.bindings.map((b) => Object.values(b)[0]!.value);
    const nonEmpty = vals.length > 0;
    if (q.type === 'conflict') return { key: { kind: 'conflict', ids: new Set(vals) }, valid: true, nonEmpty };
    return { key: { kind: 'set', values: new Set(vals) }, valid: true, nonEmpty };
  } catch {
    if (q.type === 'boolean') return { key: { kind: 'boolean', value: false }, valid: false, nonEmpty: false };
    if (q.type === 'conflict') return { key: { kind: 'conflict', ids: new Set() }, valid: false, nonEmpty: false };
    return { key: { kind: 'set', values: new Set() }, valid: false, nonEmpty: false };
  }
}

function score(expected: AnswerKey, got: AnswerKey): number {
  if (expected.kind === 'set' && got.kind === 'set') return scoreSet(expected.values, got.values).f1;
  if (expected.kind === 'boolean' && got.kind === 'boolean') return scoreBoolean(expected.value, got.value).f1;
  if (expected.kind === 'conflict' && got.kind === 'conflict') return scoreConflict(expected.ids, got.ids).f1;
  return 0;
}

export async function scoreTier2(
  client: StorageAdapter, domain: string, dir: string, episodes: number,
  answers: Map<string, string>,
): Promise<Tier2Row[]> {
  const oracle = loadOracle(dir);
  const questions = loadQuestions(dir);
  const schema = readFileSync(join(dir, 'world.ttl'), 'utf8');
  for (const g of ['kg:tbox', 'kg:abox', 'kg:inferred', 'kg:usage', 'kg:provenance']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  await client.loadTurtle(schema, 'kg:tbox');
  const paths = episodePaths(dir);
  for (let i = 0; i < Math.min(episodes, paths.length); i++) {
    await applyEpisodeTriples(client, readEpisode(paths[i]!));
  }
  await seedProvenance(client);
  await rematerialize(client, true);

  const runId = `${domain}-tier2-${Date.now()}`;
  const rows: Tier2Row[] = [];
  for (const q of questions) {
    const expected = deriveAnswerKey(oracle, q.key, q.type, episodes);
    const sparql = answers.get(q.id);
    if (!sparql) {
      rows.push({
        runId, timestamp: new Date().toISOString(), domain, questionId: q.id,
        sparqlValid: false, sparqlNonEmpty: false, f1: 0,
      });
      continue;
    }
    const { key: got, valid, nonEmpty } = await runDrafted(client, q, sparql);
    rows.push({
      runId, timestamp: new Date().toISOString(), domain, questionId: q.id,
      sparqlValid: valid, sparqlNonEmpty: nonEmpty, f1: valid ? score(expected, got) : 0,
    });
  }
  return rows;
}
