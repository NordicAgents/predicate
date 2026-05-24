import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateOrg } from './generate-org.js';

/**
 * Emit the flat-baseline context (TBox + serialized ABox) and a few questions
 * with their answer keys for a generated org of size N — so a live model can be
 * asked to answer in-context at scale and the result scored. Usage:
 *   tsx src/scale/flat-anchor.ts <people> <numQuestions>
 */
const people = Number(process.argv[2] ?? 100);
const k = Number(process.argv[3] ?? 4);
const g = generateOrg({ people, branching: 4, teams: 8, questions: k, seed: 1 });
const world = readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'org', 'world.ttl'), 'utf8');
const nt = g.triples.map((t) => `<${t.s}> <${t.p}> <${t.o}> .`).join('\n');
const context = `# Ontology (TBox)\n${world}\n# Facts (ABox)\n${nt}`;
console.log(JSON.stringify({
  people,
  context,
  questions: g.questions.map((q) => ({
    id: q.id, text: q.text, expected: (q.expected as { values: string[] }).values,
  })),
}, null, 0));
