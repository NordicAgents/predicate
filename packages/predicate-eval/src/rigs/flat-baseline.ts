import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadOracle, deriveAnswerKey } from '../oracle.js';
import { loadQuestions } from '../questions.js';
import { readEpisode, applyEpisodeTriples } from '../episode-runner.js';
import { scoreSet, scoreBoolean, scoreConflict } from '../scorer.js';
import type { ScoreType, AnswerKey } from '../eval-types.js';

/**
 * The "Tier 0" flat baseline: give the model the SAME information the
 * reasoner+SPARQL pipeline has (the TBox + every asserted ABox fact) in its
 * context, and let it answer directly — no materialization, no SPARQL engine.
 * This isolates the actual product question: does mechanizing the reasoning beat
 * letting the model do it in-context? It deliberately does NOT include kg:inferred.
 */
export interface FlatTask {
  id: string;
  domain: string;
  questionText: string;
  type: ScoreType;
  context: string; // TBox + all ABox facts, as text
}

/** The model's direct answer: a list of IRIs for set/conflict, a boolean for yes/no. */
export type FlatAnswerValue = string[] | boolean;

export interface FlatRow {
  runId: string;
  timestamp: string;
  domain: string;
  questionId: string;
  parsed: boolean; // the model returned a usable answer of the right shape
  f1: number;
}

function episodePaths(dir: string): string[] {
  return readdirSync(join(dir, 'episodes'))
    .filter((f) => f.endsWith('.jsonl')).sort()
    .map((f) => join(dir, 'episodes', f));
}

export function buildFlatPrompt(task: FlatTask): string {
  return [
    'You are given an ontology (TBox) and the complete list of asserted facts (ABox), then a question.',
    'Answer using ONLY these facts plus your own reasoning — there is NO database or query engine, so',
    'you must compute any transitive chains, inverses, or type inferences yourself. Identify every',
    'entity by its full IRI exactly as it appears in the facts.',
    'Output ONLY JSON, no prose, no code fences:',
    '  - list question: {"answer": ["<iri>", "<iri>", ...]}   (use [] if none)',
    '  - yes/no question: {"answer": true}  or  {"answer": false}',
    '',
    '<knowledge-base>',
    task.context,
    '</knowledge-base>',
    '',
    `Question (${task.type}): ${task.questionText}`,
    '',
    'JSON:',
  ].join('\n');
}

/** Replay episodes to the final state and emit one flat task per question (no answer key, no inferred). */
export async function buildFlatTasks(
  client: StorageAdapter, domain: string, dir: string, episodes: number,
): Promise<FlatTask[]> {
  const questions = loadQuestions(dir);
  const schema = readFileSync(join(dir, 'world.ttl'), 'utf8');
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  const paths = episodePaths(dir);
  for (let i = 0; i < Math.min(episodes, paths.length); i++) {
    await applyEpisodeTriples(client, readEpisode(paths[i]!));
  }
  const aboxNt = await client.serializeGraph('kg:abox', 'nt');
  const context = `# Ontology (TBox)\n${schema}\n\n# Facts (ABox)\n${aboxNt}`;
  return questions.map((q) => ({
    id: q.id, domain, questionText: q.text, type: q.type, context,
  }));
}

function coerce(type: ScoreType, answer: FlatAnswerValue): AnswerKey {
  if (type === 'boolean') return { kind: 'boolean', value: answer === true };
  if (type === 'conflict') return { kind: 'conflict', ids: new Set(Array.isArray(answer) ? answer : []) };
  return { kind: 'set', values: new Set(Array.isArray(answer) ? answer : []) };
}

function score(expected: AnswerKey, got: AnswerKey): number {
  if (expected.kind === 'set' && got.kind === 'set') return scoreSet(expected.values, got.values).f1;
  if (expected.kind === 'boolean' && got.kind === 'boolean') return scoreBoolean(expected.value, got.value).f1;
  if (expected.kind === 'conflict' && got.kind === 'conflict') return scoreConflict(expected.ids, got.ids).f1;
  return 0;
}

/** Score the model's in-context answers against the SAME final-episode answer keys Tier 1/2 use. */
export function scoreFlat(
  domain: string, dir: string, episodes: number, answers: Map<string, FlatAnswerValue>,
): FlatRow[] {
  const oracle = loadOracle(dir);
  const questions = loadQuestions(dir);
  const runId = `${domain}-flat-${Date.now()}`;
  const ts = new Date().toISOString();
  return questions.map((q) => {
    const expected = deriveAnswerKey(oracle, q.key, q.type, episodes);
    if (!answers.has(q.id)) {
      return { runId, timestamp: ts, domain, questionId: q.id, parsed: false, f1: 0 };
    }
    const got = coerce(q.type, answers.get(q.id)!);
    return { runId, timestamp: ts, domain, questionId: q.id, parsed: true, f1: score(expected, got) };
  });
}
