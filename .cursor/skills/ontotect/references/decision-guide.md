# Ontology engineering decision guide

## Contents

1. Choose the representation layer
2. Choose an OWL profile
3. Class, individual, concept, or value
4. Direct property or qualified relation
5. OWL axiom or SHACL constraint
6. Reuse strategy
7. Mapping strength
8. Repair decision
9. Refactor versus migration
10. Release disposition

## Choose the representation layer

| Need | Default | Escalate when |
|---|---|---|
| Controlled terms, multilingual labels, informal broader/narrower links | SKOS | Logical class membership or restrictions must be inferred. |
| Shared RDF vocabulary and lightweight hierarchy/domain/range | RDFS | Decidable logical definitions, disjointness, or complex entailments are required. |
| Formal class/property semantics and reasoning | OWL 2 | Integrity reports, defaults, procedures, arithmetic, or nonmonotonic rules are required. |
| Accepted RDF graph structure and actionable validation reports | SHACL | The need is a universal domain truth or logical inference. |
| Executable information need or graph transformation | SPARQL | Reusable validation reports suggest SHACL; logical entailment suggests OWL. |
| Cross-vocabulary correspondence with evidence/provenance | SSSOM or explicit mapping model | A direct imported term already has the exact intended semantics. |

Use the weakest layer that satisfies the contract; combine layers with documented boundaries.

## Choose an OWL profile

```text
Large ontology dominated by class hierarchy + existential restrictions?
  -> Prefer EL and verify profile.
Ontology-backed access to very large relational data through query rewriting?
  -> Prefer QL / an OBDA stack.
RDF data and scalable rule/materialization engine central?
  -> Prefer RL.
Need constructs outside profiles and complete decidable reasoning?
  -> OWL DL, then benchmark.
Need unrestricted metamodeling/RDF use?
  -> Declare OWL Full/RDF-based semantics and tool limitations explicitly.
```

## Class, individual, concept, or value

```text
Does the thing have instances and support quantification/inheritance?
  yes -> candidate OWL/RDFS class.
Is it one particular entity, release, code, person, event, or artifact?
  yes -> individual.
Is it an entry in a concept scheme with informal semantic links?
  yes -> SKOS concept.
Is it a scalar/text value with no independent identity in the CQs?
  yes -> literal/datatype value.
Does the project need statements about the class itself?
  -> Use supported metamodeling/punning deliberately; do not promote everything to a class.
```

## Direct property or qualified relation

Use a direct binary property only when the relation does not need its own identity and no CQ needs time, provenance, confidence, participants beyond two, sequence, quantity, or repeated occurrences. Otherwise create a relation/event/situation individual with role-specific participant properties.

## OWL axiom or SHACL constraint

| Question | OWL | SHACL |
|---|---|---|
| Is this universally true in every intended interpretation? | Usually | Optional mirror |
| Should missing input be reported? | No | Yes |
| Should a value be inferred/typed? | Yes | Not the primary purpose |
| Should duplicate input be rejected? | No; functionality may infer identity | Yes |
| Does the rule depend on a complete record/current workflow state? | Usually no | Yes |
| Is classifying new instances the goal? | Yes | No, unless extensions/rules are explicitly used |

## Reuse strategy

```text
Exact maintained term with compatible license and commitment?
  -> Reuse directly.
Need the coherent external semantics and dependency is acceptable?
  -> Import.
Need a stable coherent subset and can preserve provenance/update method?
  -> Extract a module.
External meaning is broader and local specialization is valid?
  -> Subclass/specialize.
Independent authorities must remain distinct?
  -> Map with predicate, versions, evidence, and review status.
No compatible term?
  -> Define locally and document the search/rejection evidence.
```

## Mapping strength

- Use identity/equivalence only after proving all relevant meanings and entailments align.
- Use exact mapping only within the selected mapping framework's definition and scope.
- Use broader/narrower when inclusion direction is supported.
- Use close/related when correspondence is useful but not substitutable.
- Never promote lexical/embedding similarity directly to an authoritative mapping.

## Repair decision

```text
Can the failure be reproduced with frozen inputs/configuration?
  no -> evidence/tool issue; remain unverified.
Is the expected result actually authorized by requirements/domain evidence?
  no -> repair the requirement/test, not the ontology.
Is the defect conceptual?
  yes -> fix the conceptual model, then formalization and migration.
Is a minimal causal axiom/shape/import/mapping known?
  no -> obtain explanation/minimize before editing.
Can the repair preserve protected identifiers and entailments?
  yes -> minimal repair + regression.
  no -> classify as breaking, design migration, obtain authority.
```

## Refactor versus migration

It is a refactor only if the agreed public semantic contract remains stable. Renaming IRIs, changing referents, removing supported entailments, strengthening constraints on accepted data, or changing mapping semantics requires migration/change governance even if the file looks cleaner.

## Release disposition

- **Pass**: all required evidence succeeded.
- **Pass-with-actions**: non-blocking follow-up is owned and dated.
- **Revise**: the ontology or release set fails its contract.
- **Blocked**: authority, license, provenance, sensitive-data control, stable identifiers, or critical evidence is missing.
- **Unverified**: a required check was not executed or could not be interpreted.

Apply them in this order: an unexcepted required failure gives `revise`; absent
authority, license, critical input, dependency, or safety prerequisite gives
`blocked`; otherwise missing evidence gives `unverified`; valid exceptions or
owned non-blocking work give `pass-with-actions`; only complete required
evidence gives `pass`. Keep every underlying check result separate from any
`accepted-exception`. Never convert `unverified` or an execution error into
`pass`.
