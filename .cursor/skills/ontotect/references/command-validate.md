# `validate` command

Use `validate` to execute and interpret specified checks without redesigning or
repairing the ontology by default. It is read-only unless the user separately
authorizes a following repair command.

## Entry

State the target ontology/data/shapes/query graphs, import closure, syntax,
profile, reasoner, entailment/materialization regime, dataset scope, severity
policy, expected results, and required evidence level. A missing tool or input
produces `unverified` or `error`, not pass.

## Evidence layers

Run only applicable layers and their interpretation prerequisites:

1. parse and serialization;
2. metadata, identifiers, annotations, and dependencies;
3. OWL profile and global restrictions;
4. consistency, satisfiability, classification, and entailments;
5. expected non-entailments and incoherence traps;
6. competency-query result sets;
7. SHACL under the declared graph and inference regime;
8. taxonomy, mapping, pitfall, documentation, and module review;
9. domain/user validation;
10. operational benchmarks.

## Output and exit

For every check record inputs, configuration, expectation, observed result,
underlying result, any separate exception overlay, evidence artifact, scope,
and limitation. Use `not-applicable` only when the approved contract excludes
the layer and gives a rationale. Report dimensions separately; never collapse
parser success, advisory audit results, SHACL conformance, or reasoner
consistency into total ontology correctness. End with the requested conformance
disposition and a separate list of `unverified` items.
