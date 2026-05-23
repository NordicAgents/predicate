import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnswerKey, KeySpec, ScoreType } from './eval-types.js';

export interface OracleFact { s: string; p: string; o: string; episode: number; }
export interface OracleConflict {
  id: string; about: string; predicate: string; values: string[]; episode: number;
}
export interface Oracle {
  facts: OracleFact[];
  conflicts: OracleConflict[];
  disjoint: Array<{ classes: string[] }>;
}

export function loadOracle(domainDir: string): Oracle {
  return JSON.parse(readFileSync(join(domainDir, 'oracle.json'), 'utf8')) as Oracle;
}

/** Nodes reachable from `from` via `rel`, using only facts with episode <= cutoff. */
export function transitiveClosure(
  facts: OracleFact[], rel: string, from: string, cutoff: number,
): Set<string> {
  const edges = facts.filter((f) => f.p === rel && f.episode <= cutoff);
  const out = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const e of edges) {
      if (e.s === cur && !out.has(e.o)) { out.add(e.o); stack.push(e.o); }
    }
  }
  return out;
}

function directSet(facts: OracleFact[], rel: string, from: string, cutoff: number): Set<string> {
  return new Set(
    facts.filter((f) => f.p === rel && f.s === from && f.episode <= cutoff).map((f) => f.o),
  );
}

export function deriveAnswerKey(
  oracle: Oracle, key: KeySpec, type: ScoreType, cutoff: number,
): AnswerKey {
  switch (key.derive) {
    case 'transitive':
      return { kind: 'set', values: transitiveClosure(oracle.facts, key.rel, key.from, cutoff) };
    case 'direct':
      return { kind: 'set', values: directSet(oracle.facts, key.rel, key.from, cutoff) };
    case 'conflict-ids':
      return {
        kind: 'conflict',
        ids: new Set(
          oracle.conflicts.filter((c) => c.about === key.about && c.episode <= cutoff).map((c) => c.id),
        ),
      };
    case 'boolean-conflict':
      return {
        kind: 'boolean',
        value: oracle.conflicts.some((c) => c.about === key.about && c.episode <= cutoff),
      };
    case 'path':
      return { kind: 'path', edges: key.edges };
    default: {
      const _exhaustive: never = key;
      throw new Error(`unknown key derive: ${JSON.stringify(_exhaustive)} (type=${type})`);
    }
  }
}
