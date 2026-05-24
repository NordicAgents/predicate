import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCodebaseHistory } from './generate-codebase-history.js';
import { neighborhood } from './retrieval.js';
import type { EpisodeTriple } from '../episode-runner.js';

/**
 * Emit a clean (no-answer-key) flat-baseline file for the single-user history
 * domain, in either "all" mode (every captured fact) or "retrieved" mode (only
 * the dependency neighbourhood of each question's seed). Usage:
 *   tsx src/scale/history-anchor.ts <sessions> <numQuestions> <all|retrieved> <outFile>
 */
const DEP = 'https://industriagents.com/predicate/codebase#dependsOn';
const sessions = Number(process.argv[2] ?? 400);
const k = Number(process.argv[3] ?? 4);
const mode = (process.argv[4] ?? 'retrieved') as 'all' | 'retrieved';
const outFile = process.argv[5] ?? `/tmp/hist-${mode}-${sessions}.json`;

const g = generateCodebaseHistory({ files: 100, depsPerFile: 2, sessions, questions: k, seed: 1 });
const world = readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'coding', 'world.ttl'), 'utf8');
const nt = (ts: EpisodeTriple[]): string => ts.map((t) => `<${t.s}> <${t.p}> <${t.o}> .`).join('\n');

const out = g.questions.map((q) => {
  const seedFile = `https://industriagents.com/predicate/codebase/${q.text.match(/f\d+\.ts/)![0]}`;
  const facts = mode === 'all' ? g.triples : neighborhood(g.triples, [seedFile], [DEP], 50);
  return {
    id: q.id,
    text: q.text,
    context: `# Ontology (TBox)\n${world}\n# Facts\n${nt(facts)}`,
    expected: (q.expected as { values: string[] }).values, // kept only in the controller copy
  };
});
writeFileSync(outFile, JSON.stringify(out));
console.log(`mode=${mode} sessions=${sessions} questions=${out.length} ` +
  `avgFactsPerQ=${Math.round(out.reduce((a, o) => a + (o.context.match(/dependsOn|modifiedIn|ranIn|#File/g)?.length ?? 0), 0) / out.length)} ` +
  `wrote ${outFile}`);
