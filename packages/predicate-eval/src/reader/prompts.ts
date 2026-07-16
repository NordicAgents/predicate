/**
 * Reader-arm prompts and parsers (pre-registration Amendment A5.2.4).
 *
 * Two questions per instance, frozen here and recorded by sha256 in the run
 * manifest at the landing commit:
 *
 *   Q1 detection        every instance x every context source.
 *                       -> PredictionRow{flagged, values, witness: []}
 *
 *   Q2 silent-selection CONFLICT instances only x every context source.
 *                       The instruction explicitly permits THREE outcomes --
 *                       name one value, report a conflict, or abstain -- so
 *                       that "named one value" is a choice the reader made and
 *                       not a shape the prompt forced on it. H14 is only
 *                       meaningful if abstention was genuinely available.
 *
 * Both prompts name the seed entity and the predicate under test, which is the
 * query footprint of Def. 2.3 (ent(q), pred(q)) made concrete. Neither prompt
 * ever states how many records exist, whether the entity is duplicated, or that
 * a conflict is present anywhere in the benchmark -- that would hand the reader
 * the answer the arm is trying to measure.
 */
import { createHash } from 'node:crypto';
import type { InstanceRecord } from '../instances/types.js';

export const READER_SYSTEM =
  'You are a precise, deterministic reasoning engine reading an agent memory store. '
  + 'Answer ONLY from the facts given to you. Output only the requested JSON — no prose, no code fences.';

/** Q2 outcome classes (A5.2.4). `unparseable` is a reported outcome, never an exclusion. */
export type Q2Outcome = 'single-value' | 'conflict-reported' | 'abstain' | 'unparseable';

export interface Q1Answer {
  flagged: boolean;
  values: string[];
}

const ctxBlock = (schema: string, facts: string): string =>
  `# Ontology (TBox)\n${schema}\n\n# Facts retrieved from memory\n`
  + (facts.trim().length > 0 ? facts : '# (the retrieval policy returned no facts)');

/**
 * Q1: does the context show conflicting values for this predicate on this
 * entity (or on any entity the context reveals to be the same one)?
 *
 * The "or any entity the context shows to be the same real-world entity" clause
 * is load-bearing and deliberate: cross-record conflicts live on TWO record
 * IRIs, so a reader asked only about `seed` could correctly answer "no conflict
 * on this IRI" while the conflict sits on its co-referent twin. The clause makes
 * the question match Def. 2.3's relevance test ([e]~K meets ent(q)), so a "no"
 * is a real miss rather than a quibble about which IRI was named.
 */
export function buildQ1Prompt(schema: string, facts: string, inst: InstanceRecord, seed: string): string {
  return `${ctxBlock(schema, facts)}

# Question (boolean)
Consider the entity <${seed}> and the property <${inst.predicate}>.
Do the facts above assert two or more DIFFERENT values of <${inst.predicate}> for <${seed}>, or for any
entity that the facts above show to be the same real-world entity as <${seed}>?

Answer with JSON only:
{"answer": true, "values": ["<value1>", "<value2>"]}   if two or more different values are asserted
{"answer": false, "values": []}                        otherwise

Copy values verbatim from the facts (full IRIs or literal strings, exactly as written).`;
}

/**
 * Q2: the silent-selection probe. Three outcomes offered symmetrically, in a
 * fixed order, with no hint that any is preferred or expected.
 */
export function buildQ2Prompt(schema: string, facts: string, inst: InstanceRecord, seed: string): string {
  return `${ctxBlock(schema, facts)}

# Question (open)
According to the facts above, what is the <${inst.predicate}> of <${seed}>?

Answer with exactly ONE of these JSON forms:
{"value": "<the value>"}                     if the facts support a single answer
{"conflict": ["<value1>", "<value2>"]}       if the facts assert conflicting values for this property
{"insufficient": true}                       if the facts do not let you answer

Copy values verbatim from the facts (full IRIs or literal strings, exactly as written).`;
}

/** Strip code fences / prose and pull the first JSON object out of a response. */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  // Scan for the matching brace so trailing prose cannot break the parse.
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]!;
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

const asStringArray = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [];

/**
 * Parse Q1. Returns null when the response is unparseable — the caller counts
 * that as an UNFLAGGED prediction, i.e. a miss on a conflict instance (§6:
 * parse failures are misses, never drops).
 */
export function parseQ1(text: string): Q1Answer | null {
  const j = extractJson(text);
  if (j === null || typeof j !== 'object') return null;
  const o = j as Record<string, unknown>;
  if (typeof o.answer !== 'boolean') return null;
  return { flagged: o.answer, values: asStringArray(o.values) };
}

/**
 * Parse Q2 into its outcome class. A response naming BOTH a conflict and a
 * single value is classified `conflict-reported`: reporting the conflict is the
 * non-silent behaviour, and H14 asks whether the reader stayed silent about it.
 */
export function parseQ2(text: string): { outcome: Q2Outcome; values: string[] } {
  const j = extractJson(text);
  if (j === null || typeof j !== 'object') return { outcome: 'unparseable', values: [] };
  const o = j as Record<string, unknown>;
  const conflict = asStringArray(o.conflict);
  if (conflict.length >= 2) return { outcome: 'conflict-reported', values: conflict };
  if (o.insufficient === true) return { outcome: 'abstain', values: [] };
  if (typeof o.value === 'string') return { outcome: 'single-value', values: [o.value] };
  return { outcome: 'unparseable', values: [] };
}

export const promptSha256 = (prompt: string): string =>
  createHash('sha256').update(prompt).digest('hex');
