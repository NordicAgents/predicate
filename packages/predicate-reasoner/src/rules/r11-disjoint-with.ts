import type { Rule, RuleConfig } from './types.js';
import type { Inconsistency } from '../types.js';
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';

export const r11: Rule & {
  findInconsistencies: (c: SparqlClient, cfg: RuleConfig) => Promise<Inconsistency[]>;
} = {
  id: 'r11-disjoint-with',
  name: 'owl:disjointWith inconsistency detection',
  insertWhere: () => '',   // no-op for fixpoint loop
  findInconsistencies: async (client, cfg) => {
    const aboxGraph = cfg.aboxGraphs[0] ?? 'kg:abox';
    const r = await client.select(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT ?x ?a ?b WHERE {
        GRAPH <${cfg.tboxGraph}> { ?a owl:disjointWith ?b }
        {
          { GRAPH <${aboxGraph}> { ?x rdf:type ?a } }
          UNION
          { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?a } }
        }
        {
          { GRAPH <${aboxGraph}> { ?x rdf:type ?b } }
          UNION
          { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?b } }
        }
        FILTER (str(?a) < str(?b))
      }
    `);
    return r.results.bindings.map((b) => ({
      kind: 'disjoint-class' as const,
      description: `${b.x!.value} is typed as both ${b.a!.value} and ${b.b!.value} which are owl:disjointWith`,
      triples: [
        { s: b.x!.value, p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', o: b.a!.value },
        { s: b.x!.value, p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', o: b.b!.value },
      ],
    }));
  },
};
