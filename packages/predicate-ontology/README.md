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
