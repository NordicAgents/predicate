# predicate-ontology

Versioned TBox + SHACL shapes for the codebase domain.

## Files

- `tbox/codebase.ttl` — class/property axioms (~50 triples).
- `shapes/codebase.shacl.ttl` — closed-world constraints.
- `meta/version.json` — version + manifest.

## Workflow

Edits to the TBox go through the staging/promotion lifecycle described in
the design spec §4.3. Direct edits here are reserved for v1 seeding and
for promotion sweeper commits.

## Meta vocabulary

`meta/predicate-meta.ttl` defines `pred:Event` and its subclasses, which the
substrate writes to `kg:meta` per spec §5.1, plus the provenance vocabulary
shared with `kg:provenance`. The meta TBox is loaded into `kg:tbox` alongside
the domain TBox so that SPARQL queries over events resolve their types
without a graph join.
