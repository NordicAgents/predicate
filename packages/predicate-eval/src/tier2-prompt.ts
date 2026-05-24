import type { Tier2Task } from './tier2-types.js';

export const TIER2_SYSTEM = [
  'You translate a natural-language question about a knowledge graph into ONE SPARQL query.',
  'You are given the ontology (TBox) as Turtle and a sample of real individual IRIs from the data.',
  'Rules:',
  '(1) Named graphs are URIs — query them as `GRAPH <kg:abox> { ... }` and `GRAPH <kg:inferred> { ... }`',
  '    WITH the angle brackets. There is NO predeclared "kg:" prefix; never write `GRAPH kg:abox`.',
  '(2) Declare every ontology prefix you use with PREFIX, or write full IRIs in <>. Do not assume',
  '    any prefix (org:, res:, rdf:, rdfs:) is predeclared.',
  '(3) Match each entity named in the question to its IRI using the naming shown in the examples',
  '    (e.g. a person "Dana" is the IRI whose local name is "dana", not a label or a class).',
  '(4) Entailments (transitive closures, inferred types, inverses) live in kg:inferred; base facts in',
  '    kg:abox. UNION both graphs when a relation may be inferred.',
  '(5) Output ONLY the SPARQL query — no prose, no code fences, no explanation.',
  '    Use SELECT for which/what/who questions and ASK for yes/no questions.',
].join('\n');

export function buildPrompt(task: Tier2Task): string {
  return [
    TIER2_SYSTEM,
    '',
    '<ontology>',
    task.schema,
    '</ontology>',
    '',
    '<example-individual-iris>',
    task.exampleIndividuals.join('\n'),
    '</example-individual-iris>',
    '',
    `Queryable named graphs: ${task.graphsHint}`,
    '',
    `Question (${task.type}): ${task.questionText}`,
    '',
    'SPARQL:',
  ].join('\n');
}
