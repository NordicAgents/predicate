import type { StorageAdapter } from '../storage/index.js';
import { kgExploreSchema, type SchemaSlice, type ClassSlice, type PropertySlice } from './kg-explore-schema.js';
import { escapeIRI } from '../sparql/escape.js';

const J = 'https://predicate.dev/judgment#';

export interface JudgmentSummary {
  judgment: string;   // the j:Judgment IRI
  about: string;      // the entity it concerns
  rationale?: string;
}

export interface ExtractJudgmentsInput {
  touchedEntities?: string[];   // entity IRIs this session worked with
  sessionId?: string;           // optional, for provenance/source labelling by the host
}

export interface ExtractJudgmentsOutput {
  judgmentSchema: SchemaSlice;
  currentJudgments: JudgmentSummary[];
  brief: string;
}

const BRIEF = [
  'Distill JUDGMENTS from this session — reconciled conclusions with no live source.',
  'For each decision, standing preference, qualitative assessment, or reconciliation you made:',
  '  1. Choose the j: subclass (j:Decision | j:Preference | j:Assessment | j:Reconciliation).',
  '  2. kg_assert it with: j:about <entity>, a j:rationale (your "why"), and >=1 j:basedOn <input>.',
  '     Decisions add j:settledAs <chosen> and j:rejected <alternative>; preferences add j:prefers/j:over.',
  '  3. If your new judgment conflicts with one already listed in currentJudgments, also',
  '     kg_assert <new> j:supersedes <old> so the reasoner retires the old one.',
  'Do NOT store lookups (anything re-derivable from a live source). Never assert a judgment without j:basedOn.',
  'Use only j: predicates shown in judgmentSchema; do not invent predicates.',
].join('\n');

/**
 * Build a full SchemaSlice covering all j: classes and properties.
 * kgExploreSchema anchors on a single class IRI and only returns that
 * class's entry in .classes[]; to give the host model the full j: vocabulary
 * (all subclasses, all properties) we query the namespace directly.
 */
async function buildJudgmentSchema(client: StorageAdapter): Promise<SchemaSlice> {
  const classQ = await client.select(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    SELECT ?iri ?label ?sup ?sub ?disj WHERE {
      GRAPH <kg:tbox> {
        ?iri a owl:Class .
        FILTER(STRSTARTS(STR(?iri), "${J}"))
        OPTIONAL { ?iri rdfs:label ?label }
        OPTIONAL { ?iri rdfs:subClassOf ?sup . FILTER(isIRI(?sup)) }
        OPTIONAL { ?sub rdfs:subClassOf ?iri . FILTER(isIRI(?sub)) }
        OPTIONAL { ?iri owl:disjointWith ?disj }
      }
    }
  `);

  const classMap = new Map<string, ClassSlice>();
  for (const b of classQ.results.bindings) {
    const iri = b.iri!.value;
    const slice =
      classMap.get(iri) ??
      ({ iri, subClassOf: [], superClassOf: [], disjointWith: [] } as ClassSlice);
    if (b.label) slice.label = b.label.value;
    if (b.sup && !slice.subClassOf.includes(b.sup.value)) slice.subClassOf.push(b.sup.value);
    if (b.sub && !slice.superClassOf.includes(b.sub.value)) slice.superClassOf.push(b.sub.value);
    if (b.disj && !slice.disjointWith.includes(b.disj.value)) slice.disjointWith.push(b.disj.value);
    classMap.set(iri, slice);
  }

  const propQ = await client.select(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    SELECT ?p ?label ?dom ?rng ?char WHERE {
      GRAPH <kg:tbox> {
        ?p a ?propType .
        FILTER(?propType IN (owl:ObjectProperty, owl:DatatypeProperty))
        FILTER(STRSTARTS(STR(?p), "${J}"))
        OPTIONAL { ?p rdfs:domain ?dom }
        OPTIONAL { ?p rdfs:range ?rng }
        OPTIONAL { ?p rdfs:label ?label }
        OPTIONAL { ?p a ?char .
                   FILTER(?char IN (owl:TransitiveProperty, owl:SymmetricProperty,
                                    owl:FunctionalProperty, owl:InverseFunctionalProperty)) }
      }
    }
  `);

  const propMap = new Map<string, PropertySlice>();
  for (const b of propQ.results.bindings) {
    const iri = b.p!.value;
    const slice =
      propMap.get(iri) ??
      ({ iri, domain: [], range: [], characteristics: [] } as PropertySlice);
    if (b.label) slice.label = b.label.value;
    if (b.dom && !slice.domain.includes(b.dom.value)) slice.domain.push(b.dom.value);
    if (b.rng && !slice.range.includes(b.rng.value)) slice.range.push(b.rng.value);
    if (b.char && !slice.characteristics.includes(b.char.value))
      slice.characteristics.push(b.char.value);
    propMap.set(iri, slice);
  }

  // Fall back to kgExploreSchema if the tbox is empty (e.g. first run before ontology load).
  if (classMap.size === 0) {
    return kgExploreSchema(client, `${J}Judgment`);
  }

  return {
    concept: `${J}Judgment`,
    classes: Array.from(classMap.values()),
    properties: Array.from(propMap.values()),
  };
}

export async function kgExtractJudgments(
  client: StorageAdapter,
  input: ExtractJudgmentsInput,
): Promise<ExtractJudgmentsOutput> {
  const judgmentSchema = await buildJudgmentSchema(client);

  const touched = input.touchedEntities ?? [];
  let currentJudgments: JudgmentSummary[] = [];
  if (touched.length > 0) {
    const values = touched.map((e) => escapeIRI(e)).join(' ');
    const r = await client.select(`
      PREFIX j: <${J}>
      SELECT ?jd ?about ?rationale WHERE {
        GRAPH <kg:inferred> { ?jd a j:Current }
        GRAPH <kg:abox> {
          ?jd j:about ?about .
          OPTIONAL { ?jd j:rationale ?rationale }
          VALUES ?about { ${values} }
        }
      }
    `);
    currentJudgments = r.results.bindings.map((b) => ({
      judgment: b.jd!.value,
      about: b.about!.value,
      rationale: b.rationale?.value,
    }));
  }

  return { judgmentSchema, currentJudgments, brief: BRIEF };
}
