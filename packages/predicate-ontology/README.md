# predicate-ontology

Versioned TBox, SHACL shapes, and meta vocabulary — the RDF/Turtle assets
Predicate seeds the graph with. Pure data; no code.

Part of the [Predicate](https://github.com/NordicAgents/predicate#readme)
monorepo.

## Layout

| Path | Contents |
|---|---|
| `catalog/catalog.json` | Manifest of the bundled ontologies offered by `predicate init`. |
| `catalog/*.ttl` | Bundled vocabularies: `top`, `codebase`, `foaf`, `schema-org-lite`, `fhir-core`, `judgment`. |
| `catalog/*.shacl.ttl` | Closed-world SHACL constraints (`codebase`, `judgment`). |
| `meta/predicate-meta.ttl` | The `pred:Event` hierarchy the substrate writes to `kg:meta`, plus the provenance vocabulary shared with `kg:provenance`. |
| `meta/version.json` | Version + manifest. |
| `tbox/promoted/` | Where the promotion sweeper commits TBox Turtle when staged deltas graduate. |

## Workflow

Edits to the TBox normally flow through the staging → promotion lifecycle: the
agent stages a `SchemaDelta` into `kg:tbox-staging`, the reasoner validates it,
and the promotion sweeper graduates it only after N successful uses inside a TTL.
Direct edits here are reserved for v1 seeding and for promotion-sweeper commits.

The meta TBox is loaded into `kg:tbox` alongside the domain TBox so SPARQL
queries over events resolve their types without a graph join.
