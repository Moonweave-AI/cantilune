# `review` command

Use `review` to inspect an ontology, vocabulary, taxonomy, mapping, shapes
graph, knowledge graph, or release set without modifying the target.

## Entry

Freeze or identify the target, ontology/version IRIs, import closure, data and
shapes graphs, tests, intended contract, tool configuration, and review scope.
Missing contract material may be reconstructed as an assumption, never silently
declared authoritative.

## Procedure

1. Inventory artifacts, namespaces, imports, mappings, and generated outputs.
2. Run applicable verification layers, preserving errors and skipped checks.
3. Inspect requirements coverage, conceptual commitments, taxonomy, relation
   semantics, strong axioms, shapes, mappings, documentation, and governance.
4. Trace symptoms to a requirement, conceptualization, formalization, data,
   constraint, mapping, dependency, build, tool, or governance cause.
5. Report findings; do not apply suggested repairs.

## Output and exit

Each finding needs identifier, severity/confidence, affected artifact or IRI,
reproduction evidence, violated intent, impact, root cause, minimal remediation,
verification path, and owner/gate. Separate contract defects from optional
improvements. Exit when inspected and uninspected layers are explicit and every
finding is evidence-linked. Recommend `repair`, `refactor`, `optimize`, or
`validate` as a separate next command when appropriate.
