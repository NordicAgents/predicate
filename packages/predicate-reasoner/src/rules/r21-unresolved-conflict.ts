import type { Rule, RuleConfig } from './types.js';
import type { Quad } from '../types.js';

const J = 'https://industriagents.com/predicate/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const UNRESOLVED = `${J}UnresolvedConflict`;
const ABOUT = `${J}about`;
const BASED_ON = `${J}basedOn`;

export const r21: Rule = {
  id: 'r21-unresolved-conflict',
  name: 'j:UnresolvedConflict — two current judgments disagree on a ConflictFunctionalProperty',
  insertWhere: (cfg: RuleConfig) => {
    const abox = cfg.aboxGraphs[0] ?? 'kg:abox';
    return `
      PREFIX j:   <${J}>
      INSERT {
        GRAPH <${cfg.inferredGraph}> {
          ?a a j:UnresolvedConflict .
          ?b a j:UnresolvedConflict .
          ?a j:conflictsWith ?b .
        }
      }
      WHERE {
        GRAPH <${cfg.tboxGraph}>     { ?p a j:ConflictFunctionalProperty }
        GRAPH <${cfg.inferredGraph}> { ?a a j:Current . ?b a j:Current . }
        GRAPH <${abox}> {
          ?a j:about ?s ; ?p ?va .
          ?b j:about ?s ; ?p ?vb .
        }
        FILTER (str(?a) < str(?b))
        FILTER (?va != ?vb)
        FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?a j:conflictsWith ?b } }
      }
    `;
  },
  backward: {
    matches: (q: Quad) =>
      q.p === RDF_TYPE &&
      (typeof q.o === 'string' ? q.o : (q.o as { value: string }).value) === UNRESOLVED,
    premiseQuery: (q: Quad) => `
      PREFIX j: <${J}>
      SELECT ?b ?s ?ba ?bb WHERE {
        { GRAPH <kg:inferred> { <${q.s}> j:conflictsWith ?b } }
        UNION
        { GRAPH <kg:inferred> { ?b j:conflictsWith <${q.s}> } }
        GRAPH <kg:abox> {
          <${q.s}> j:about ?s ; j:basedOn ?ba .
          ?b       j:about ?s ; j:basedOn ?bb .
        }
      } LIMIT 1
    `,
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => [
      { s: q.s, p: ABOUT, o: binding.s! },
      { s: q.s, p: BASED_ON, o: binding.ba! },
      { s: binding.b!, p: ABOUT, o: binding.s! },
      { s: binding.b!, p: BASED_ON, o: binding.bb! },
    ],
  },
};
