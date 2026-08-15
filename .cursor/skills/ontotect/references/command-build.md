# `build` command

Use `build` to create a new ontology or extend an existing one. Start at the
first lifecycle stage whose entry evidence is missing; default to `charter`.

## Entry

Require a stated purpose and at least one testable competency question before
formalization. If the domain is exploratory, explicitly label the result a
prototype and list undecided commitments. For an extension, inspect the
existing ontology, tests, public IRIs, imports, and downstream contracts first.

## Flow

1. **Charter**: scope, users, roles, CQs, examples, non-goals, constraints, and
   acceptance evidence.
2. **Reuse**: search and compare maintained terms, ontologies, patterns, and
   mappings by semantic fit, commitments, dependency, governance, and license.
3. **Conceptualize**: term/relation inventory, identity, roles, time,
   part-whole, examples, counterexamples, and unresolved decisions.
4. **Formalize**: choose the weakest adequate stack; define profile, IRI,
   module/import, annotation, provenance, and serialization policy.
5. **Implement**: make CQ-sized vertical slices with ontology axioms, shapes,
   queries, and positive/negative fixtures.
6. **Verify**: run applicable independent evidence layers and record missing
   reasoners, validators, data, or reviewers as `unverified`.
7. Enter `release` only when the requested outcome includes a releasable set.

## Exit

Stop at `--to-stage` or when the requested scope has executable acceptance
evidence. Return the ontology contract, exact artifacts, CQ coverage, semantic
impact, evidence, unresolved commitments, and next gate. A large term list or a
file that parses is not completion.
