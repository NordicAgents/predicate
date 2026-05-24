import type { Tier2Task } from './tier2-types.js';

export const TIER2_SYSTEM =
  'You translate a natural-language question about a knowledge graph into ONE SPARQL query. ' +
  'You are given the ontology (TBox) as Turtle. The data lives in named graphs: query ' +
  'kg:abox (asserted facts) and kg:inferred (entailments) — union them when a relation may be ' +
  'transitive or inferred. Output ONLY the SPARQL query, no prose, no code fences, no explanation. ' +
  'Use a SELECT for "which/what/who" questions and an ASK for yes/no questions.';

export function buildPrompt(task: Tier2Task): string {
  return [
    TIER2_SYSTEM,
    '',
    '<ontology>',
    task.schema,
    '</ontology>',
    '',
    `Queryable named graphs: ${task.graphsHint}`,
    '',
    `Question (${task.type}): ${task.questionText}`,
    '',
    'SPARQL:',
  ].join('\n');
}
