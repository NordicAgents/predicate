import type { StorageAdapter } from '../storage/index.js';
import { GRAPH } from '../graphs.js';
import { escapeIRI, escapeLiteral } from '../sparql/escape.js';

export interface ClassSlice {
  iri: string;
  label?: string;
  subClassOf: string[];
  superClassOf: string[];
  disjointWith: string[];
}

export interface PropertySlice {
  iri: string;
  label?: string;
  domain: string[];
  range: string[];
  characteristics: string[];
}

export interface SchemaSlice {
  concept: string;
  classes: ClassSlice[];
  properties: PropertySlice[];
}

async function resolveConcept(client: StorageAdapter, raw: string): Promise<string | null> {
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  // 1. Exact rdfs:label match.
  const byLabel = await client.select(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?iri WHERE {
      GRAPH ${escapeIRI(GRAPH.tbox)} {
        ?iri rdfs:label ${escapeLiteral(raw)} .
      }
    } LIMIT 1
  `);
  const labelHit = byLabel.results.bindings[0]?.iri?.value;
  if (labelHit) return labelHit;

  // 2. Local-name match (token after the last '#' or '/'). This is how an agent
  //    naturally names a predicate/class ("reads", "dependsOn", "Command"),
  //    whose human label is often a phrase.
  const byLocal = await client.select(`
    SELECT ?iri WHERE {
      GRAPH ${escapeIRI(GRAPH.tbox)} { ?iri ?p ?o }
      FILTER(REPLACE(STR(?iri), "^.*[#/]", "") = ${escapeLiteral(raw)})
    } LIMIT 1
  `);
  return byLocal.results.bindings[0]?.iri?.value ?? null;
}

export async function kgExploreSchema(
  client: StorageAdapter,
  conceptInput: string,
): Promise<SchemaSlice> {
  const resolved = await resolveConcept(client, conceptInput);
  if (resolved === null) {
    return { concept: conceptInput, classes: [], properties: [] };
  }
  const concept = resolved;
  const cIri = escapeIRI(concept);
  const tbox = escapeIRI(GRAPH.tbox);

  const classQ = await client.select(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    SELECT ?iri ?label ?sup ?sub ?disj WHERE {
      GRAPH ${tbox} {
        ?iri a owl:Class .
        FILTER(?iri = ${cIri})
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
    if (b.sup) slice.subClassOf.push(b.sup.value);
    if (b.sub) slice.superClassOf.push(b.sub.value);
    if (b.disj) slice.disjointWith.push(b.disj.value);
    classMap.set(iri, slice);
  }

  const propQ = await client.select(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    SELECT ?p ?label ?dom ?rng ?char WHERE {
      GRAPH ${tbox} {
        ?p a ?propType .
        FILTER(?propType IN (owl:ObjectProperty, owl:DatatypeProperty))
        OPTIONAL { ?p rdfs:domain ?dom }
        OPTIONAL { ?p rdfs:range ?rng }
        OPTIONAL { ?p rdfs:label ?label }
        OPTIONAL { ?p a ?char .
                   FILTER(?char IN (owl:TransitiveProperty, owl:SymmetricProperty,
                                    owl:FunctionalProperty, owl:InverseFunctionalProperty)) }
        FILTER(?dom = ${cIri} || ?rng = ${cIri} || ?p = ${cIri})
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

  return {
    concept,
    classes: Array.from(classMap.values()),
    properties: Array.from(propMap.values()),
  };
}
