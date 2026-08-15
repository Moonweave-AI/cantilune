# Requirements, competency questions, and scope

## Contents

1. Ontology requirements specification
2. Competency questions
3. Knowledge acquisition
4. Scope and granularity
5. Reuse assessment
6. Acceptance matrix

## 1. Ontology requirements specification

Capture requirements before term design. Use the project brief to record:

- purpose, beneficiaries, and decisions enabled;
- intended users, systems, interfaces, and governance community;
- domain boundary and neighboring models;
- representative tasks, queries, data, and inference needs;
- required languages, labels, definitions, provenance, and documentation;
- logical, validation, scale, latency, deployment, licensing, privacy, and maintenance constraints;
- Owner, DRI, domain experts, ontology engineers, consumers, and release authority;
- assumptions, unknowns, non-goals, and future candidates.

Distinguish requirement types:

| Type | Example | Verification |
|---|---|---|
| Functional | Find every instrument used in a given process. | SPARQL answer set |
| Inferential | Infer that every cardiac valve is an anatomical structure. | Expected entailment |
| Integrity | Every released term has one English preferred label. | SHACL/policy check |
| Interoperability | Map product categories to a maintained external scheme. | Mapping review and test |
| Performance | Classify the release within the CI time budget. | Fixed benchmark |
| Governance | Breaking term changes require release-authority approval. | Release evidence |
| Documentation | Public terms have definitions, source, and examples. | Metadata audit |

Do not formalize a desired business rule as an OWL axiom until the team decides whether it describes the world, valid input, an application policy, or a workflow state. These belong to different enforcement layers.

## 2. Competency questions

A competency question is a natural-language requirement that the ontology, together with its declared data and inference regime, must be able to answer or decide.

Write questions that are:

- bounded by a user and use case;
- independent of a preferred implementation syntax;
- populated with representative variables and examples;
- precise about time, context, quantification, provenance, and granularity;
- associated with an acceptance type and expected result;
- useful for deciding scope and axioms.

Prefer a small hierarchy:

- **Goal CQ**: the stakeholder decision or integration need.
- **Sub-CQ**: a testable semantic capability.
- **Fixture**: concrete positive, negative, boundary, and counterexample data.

Example:

```text
Goal CQ: Which approved sensors can observe a target phenomenon at a location?
CQ-01a: Which sensor types observe the phenomenon type?
CQ-01b: Which installed sensor participates in a deployment at the location and time?
CQ-01c: Which observations satisfy the approval and quality policy?
```

The first two may require ontology entailment; the third may be a SHACL/application-policy constraint. Do not force all three into OWL.

### CQ quality checks

Reject or rewrite a CQ when it:

- can be answered without any domain semantics and is not otherwise useful;
- presupposes an unapproved class, relation, hierarchy, or granularity;
- uses vague quantifiers such as `usually`, `relevant`, or `appropriate` without criteria;
- conflates current state with historical state;
- assumes absence means false under an open-world model;
- lacks an expected positive and plausible negative result;
- cannot be traced to a user, decision, integration, or policy.

### Convert CQs into evidence

For each CQ, select one or more:

- expected entailment axiom;
- expected non-entailment axiom;
- satisfiability expectation;
- SPARQL `SELECT`, `ASK`, or `CONSTRUCT` query plus expected bindings/graph;
- SHACL focus node and expected conformance/result;
- human classification task with inter-reviewer agreement;
- governance evidence such as approval or provenance.

Maintain the mapping in `assets/competency-questions.tsv` or an equivalent machine-readable artifact.

## 3. Knowledge acquisition

Use multiple evidence channels because each exposes different commitments:

- interviews and facilitated modeling sessions;
- authoritative definitions and standards;
- datasets and edge cases;
- forms, reports, APIs, schemas, code, and existing queries;
- incidents, data-quality defects, and integration failures;
- existing ontologies, concept schemes, mappings, and registries;
- literature and validated ontology design patterns.

For each source, record authority, date/version, scope, license, exact claim used, confidence, and conflicting claims. A database schema shows stored distinctions, not necessarily domain truth. A term frequency list suggests vocabulary, not classes.

Use examples and counterexamples to test definitions:

```text
Term: Diagnostic procedure
Definition candidate: A planned process whose objective includes determining a diagnosis.
Positive: pathology examination performed for diagnosis.
Counterexample: the same examination performed only for research.
Boundary: screening performed before symptoms.
Decision: classify by the realized process and objective, not by instrument alone.
```

## 4. Scope and granularity

Define scope along several axes:

- subject domain;
- user and decision context;
- temporal and geographic extent;
- abstraction level;
- instance versus schema coverage;
- normative versus descriptive intent;
- data, inference, query, and validation responsibilities;
- maintenance authority.

Use the minimum ontological commitment that answers the CQs and supports intended reuse. Minimal commitment does not mean underspecification: add every distinction required to prevent wrong answers or integrations.

Control scope creep by assigning every proposed term to:

- directly required by a CQ;
- required as a dependency of another term/axiom;
- reused/imported support vocabulary;
- deferred candidate;
- rejected/out of scope.

## 5. Reuse assessment

Evaluate a candidate with a recorded score or narrative across:

1. semantic and ontological fit;
2. CQ coverage;
3. granularity and contextual assumptions;
4. formal language, profile, and reasoning cost;
5. identifier stability and versioning;
6. maintenance, governance, and community use;
7. documentation, definitions, examples, and test quality;
8. license and redistribution compatibility;
9. dependency/import closure;
10. mapping and migration cost.

Choose a strategy:

- **direct reference** when stable terms already express the required meaning;
- **import** when the dependency and full commitments are acceptable;
- **module extraction** when only a coherent subset is required and provenance can be retained;
- **specialization** when the external meaning is correct but more specific local terms are needed;
- **mapping** when independent vocabularies must remain authoritative;
- **new definition** when no compatible term exists.

Do not use `owl:equivalentClass`, `owl:equivalentProperty`, or `owl:sameAs` as convenient mappings. Prove bidirectional semantic equivalence or select a weaker, explicitly qualified mapping.

## 6. Acceptance matrix

Before implementation, create a matrix:

| Requirement/CQ | Terms/axioms/shapes | Fixture | Expected evidence | Owner | Status |
|---|---|---|---|---|---|
| CQ-001 | | | SPARQL bindings | | proposed |

Require every `must` item to reach `verified` or an explicitly approved exception before release. Record `unverified` when tools, data, or reviewers were unavailable.
