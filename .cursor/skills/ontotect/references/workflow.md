# Ontology engineering workflow

## Contents

1. Lifecycle model
2. Mode routes
3. Stage gates
4. Iteration protocol
5. Work state and stopping rules

## 1. Lifecycle model

Treat the lifecycle as an evidence-producing loop, not a document sequence.

### Stage A - Charter

Produce:

- ontology project brief;
- Owner, DRI, domain reviewers, release authority, and source of truth;
- intended uses, users, integrations, in-scope and out-of-scope statements;
- numbered competency questions and representative examples;
- constraints for language, reasoning, scale, licensing, privacy, and deployment;
- acceptance and release evidence matrix.

Gate A: every must-have competency question has an owner and an observable acceptance method. If the domain is exploratory, approve a time-bounded prototype and record undecided commitments.

### Stage B - Knowledge acquisition and reuse

Acquire evidence from domain experts, datasets, standards, existing ontologies, schemas, queries, code, forms, reports, and regulations. Record provenance and confidence. Distinguish authoritative definitions from usage observations.

For each reuse candidate, record:

- ontology and version IRI;
- governance and maintenance status;
- license and access conditions;
- intended scope and ontological commitments;
- language/profile and dependency closure;
- coverage of competency questions;
- term-level fit, granularity, and known conflicts;
- chosen strategy: direct use, import, module, extension, mapping, or reject.

Gate B: reuse decisions are attributable and license-compatible; conflicts in identity, time, granularity, or upper-level commitments are visible.

### Stage C - Conceptual model

Produce a term inventory, concept map, relation inventory, example/counterexample set, and unresolved modeling questions. Define terms with genus-differentia or equally testable definitions where appropriate. Identify identity criteria, dependence, rigidity, temporality, participation, and part-whole semantics.

Gate C: domain reviewers can classify representative examples consistently, class hierarchies pass `is-a` and OntoClean-style checks where applicable, and the model answers the competency questions informally without relying on syntax accidents.

### Stage D - Formal architecture

Decide and record:

- SKOS/RDFS/OWL/SHACL/SPARQL roles;
- OWL 2 profile target or explicit use of OWL DL/Full;
- entailment regime and reasoner assumptions;
- ontology, version, term, and document IRI policies;
- prefix and serialization policy;
- module/import/catalog architecture;
- annotation and provenance model;
- mapping model and confidence/evidence vocabulary;
- asserted versus generated artifact boundaries.

Translate conceptual statements into formal axioms and constraints. For every strong axiom, list at least one intended consequence and one plausible unintended consequence.

Gate D: the stack is no stronger than required, global restrictions are understood, every public axiom traces to a requirement or source, and operational constraints are not confused with logical entailments.

### Stage E - Vertical implementation slices

Implement a small, coherent slice:

1. select one or more competency questions;
2. add or reuse the minimum vocabulary;
3. add labels, definitions, provenance, examples, and status;
4. add axioms and explicit constraints;
5. add positive, negative, entailment, and query fixtures;
6. classify, validate, and inspect the slice;
7. obtain domain feedback;
8. merge only after the slice evidence passes.

Keep public IRIs stable during ordinary iteration. Use temporary namespaces only in explicitly disposable prototypes.

Gate E: the slice satisfies its competency questions, introduces no unexplained incoherence, and includes tests that would fail if its essential semantics regressed.

### Stage F - Integrated verification

Run the layered verification model from [validation-and-testing.md](validation-and-testing.md). Preserve an untouched baseline before repairs, refactors, or optimizations, using a separate copy or an existing VCS reference. A cryptographic hash is not needed by default. Record the tool, relevant configuration, imports, entailment regime, inputs, outputs, exit status, and date; pin or repeatedly verify versions only when the acceptance contract or risk context requires it.

Gate F: required automated checks pass, accepted exceptions have an Owner and rationale, and domain reviewers validate affected meanings. A parser success is not a semantic pass.

### Stage G - Release and operation

Classify the change, generate a semantic diff, prepare migrations, publish the complete release set, notify affected stakeholders, and assign maintenance. Monitor unresolved issues, usage, term requests, import drift, broken PURLs, and deprecation deadlines.

Gate G: release authority approves actual evidence; permanent identifiers resolve; previous releases and migration paths remain available according to policy.

## 2. Mode routes

### Build

Start at Stage A. Use short Stage C-E loops rather than creating the full taxonomy before tests. Finish through Stage G when the requested outcome includes a releasable ontology.

### Review

1. Freeze the target, import closure, tool configuration, and intended contract.
2. Reconstruct missing requirements without silently declaring them authoritative.
3. Run Stage F evidence layers.
4. Trace findings back through formalization, conceptualization, requirements, and governance.
5. Report findings; do not modify unless separately authorized.

Exit when every finding contains evidence, impact, confidence, remediation, and a verification path, and all unchecked layers are explicit.

### Repair

1. Reproduce the observed failure against a frozen baseline.
2. Minimize the causal axioms, shapes, imports, mappings, or build steps.
3. Decide whether the defect is semantic or whether the expectation/test is wrong.
4. Apply the smallest correction that restores the intended contract.
5. Rerun the failed check and the complete relevant regression set.
6. Produce a semantic impact summary and migration note if public meaning changed.

Do not weaken a constraint or remove an axiom merely to make a tool green without validating the intended meaning.

### Optimize

Define a measurable target such as classification time, query latency, memory, import size, module size, or review complexity. Record protected entailments and query answers. Compare profile restriction, module extraction, axiom normalization, materialization strategy, and storage/index choices. Benchmark with representative data and a fixed environment.

Exit only with before/after measurements and invariant checks. Smaller files alone are not proof of improvement.

### Refactor

Use refactoring when the intended semantics remain stable but organization, naming, modularity, or maintainability must improve. Establish an API/entailment contract, then compare public IRIs, axioms, inferred subsumptions, competency answers, mappings, and annotations. Treat IRI renaming or meaning changes as migrations, not refactors.

### Validate

Ask what conformance means and against which graph, import closure, profile, entailment regime, shapes graph, and policy. Execute only the requested checks plus prerequisites needed to interpret them. Report separate outcomes for syntax, logic, constraints, requirements, documentation, and governance.

### Govern

Start with authority and decision rights. Define proposal, review, approval, implementation, release, notification, appeal, deprecation, and retirement paths. Couple policy statements to machine-checkable controls where possible, but retain human semantic review.

## 3. Stage gates

Use these dispositions:

- **pass**: required evidence succeeded;
- **pass-with-actions**: no release-blocking defect, but owned follow-up remains;
- **revise**: evidence shows the artifact does not meet its contract;
- **blocked**: required authority, source, license, dependency, or safety condition is absent;
- **unverified**: a check was not executed or its result cannot be trusted.

Apply the precedence in [command-contract.md](command-contract.md): unexcepted
required failure, known missing prerequisite, missing evidence, valid
exceptions/non-blocking actions, then complete pass. Keep the underlying check
result separate from an exception decision. Never convert `unverified` to
`pass` from plausibility. A tool failure is not automatically an ontology
failure; diagnose the environment and input before assigning meaning.

## 4. Iteration protocol

Maintain a compact iteration record:

- iteration identifier and competency questions;
- baseline identifier;
- source or issue motivating the change;
- modeling decision and alternatives;
- changed terms, axioms, shapes, mappings, and generated artifacts;
- automated evidence and domain-review result;
- new assumptions, debt, and next slice.

Keep the loop short enough that a reviewer can connect the requirement, axiom, and test without reconstructing weeks of work.

## 5. Work state and stopping rules

Use `idea -> chartered -> conceptualized -> formalized -> implemented -> verified -> released -> maintained -> deprecated -> retired` as a default lifecycle. A project may return to an earlier state when evidence invalidates a commitment.

Stop and escalate when:

- two authoritative domain sources conflict on the meaning being formalized;
- a reuse candidate has incompatible or unknown licensing for the intended distribution;
- a change would recycle an IRI, alter a stable referent, or silently break consumers;
- consistency depends on suppressing required imports or using a different entailment regime;
- sensitive data or unprovenanced content would be embedded in a public artifact;
- no accountable Owner can approve a domain commitment;
- the required reasoner, validator, or test data is unavailable and the claim would otherwise be unverified.

Completion means the requested mode's exit criteria are met, not that every conceivable domain fact has been modeled.
