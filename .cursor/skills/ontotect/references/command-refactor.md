# `refactor` command

Use `refactor` to improve naming, organization, modularity, patterns, or
maintainability while preserving an explicitly agreed semantic contract.

## Entry

Define the baseline, public vocabulary/API, protected IRIs, asserted and
inferred consequences, CQ answers, shapes behavior, mappings, consumer
expectations, and supported imports. If the intended referent, public IRI, or
supported behavior changes, route the affected part through migration and
governance rather than calling it a refactor.

## Procedure

1. State the preservation contract and allowed structural change.
2. Select a bounded transformation: module extraction, overloaded-class split,
   role/state normalization, qualified-relation normalization, layer movement,
   redundant-assertion removal, or module reorganization.
3. Keep labels/definitions changes distinct from IRI migrations.
4. Compare asserted graph/axioms and the protected behavioral contract.
5. Run inferred hierarchy, expected entailment/non-entailment, CQ, SHACL,
   mapping, build, and documentation regressions as applicable.

## Exit

Return a transformation map, semantic diff, preserved and changed results,
consumer impact, evidence, and rollback/migration needs. “Logically inert” must
always name the tested semantics and import closure.
