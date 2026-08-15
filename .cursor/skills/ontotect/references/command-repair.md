# `repair` command

Use `repair` for a reproducible failure or an authorized semantic expectation
that the current artifacts violate.

## Entry

Establish an untouched baseline using the project's existing VCS reference or
a separate copy, the failing observation, intended result, protected public
IRIs/entailments/mappings, and the authorized target. Do not add hashes or
version locks by default.

## Procedure

1. Reproduce the failure with the same imports, data, graph scope, entailment
   regime, and relevant configuration.
2. Decide whether the ontology, requirement, fixture, shape, mapping, import,
   build, or tool expectation is wrong.
3. Minimize the causal terms, axioms, shapes, mappings, or steps and translate
   the cause into domain language.
4. Apply the smallest correction at the earliest defective layer.
5. Add a regression that fails on the baseline and passes after repair.
6. Rerun the failed check and all interacting CQ, logic, SHACL, mapping,
   documentation, and build checks.
7. Produce an asserted and behavioral semantic-impact summary; prepare a
   migration when protected meaning changes.

## Exit

The observed defect is resolved, protected invariants pass, changed semantics
are authorized and documented, and unavailable evidence remains `unverified`.
Never weaken a constraint, remove an import, or delete the axiom exposing a
problem merely to make a tool green.
