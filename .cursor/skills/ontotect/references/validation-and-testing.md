# Validation, testing, and quality evidence

## Contents

1. Quality model
2. Layered verification
3. Logical reasoning tests
4. SHACL and data validation
5. Competency and regression tests
6. Metrics and pitfall scans
7. Evidence interpretation
8. Quality levels

## 1. Quality model

Evaluate quality against intended use. Keep dimensions separate:

- **syntactic**: documents parse and serialize correctly;
- **logical**: consistency, satisfiability, intended entailments, and profile conformance;
- **conceptual**: classes, relations, definitions, identity, and granularity represent the domain adequately;
- **requirements**: competency questions and user tasks are covered;
- **constraint/data**: target graphs meet declared integrity rules;
- **interoperability**: identifiers, reuse, mappings, formats, and profiles work with consumers;
- **documentation**: labels, definitions, provenance, examples, and usage guidance support humans and machines;
- **operational**: classification, queries, builds, and publication fit scale and reliability targets;
- **governance**: ownership, licensing, versioning, change control, maintenance, and release evidence are adequate.

A single aggregate score can hide a critical defect. Report dimension results and release-blocking conditions before any optional score.

## 2. Layered verification

### Layer 1 - Parse and round-trip

- parse every claimed distribution with at least one conforming parser;
- round-trip only when needed and compare graphs, not formatting;
- check datatypes, language tags, relative IRIs, invalid escapes, and prefix declarations;
- distinguish RDF parse success from OWL DL conformance.

### Layer 2 - Metadata, IRI, and dependency hygiene

- ontology declaration, ontology/version IRIs, title, description, creators, dates, license, prior version, and imports;
- public-term labels, definitions, sources, examples, status, and replacement links;
- duplicate or unstable identifiers, accidental namespace drift, unresolved PURLs, and broken catalogs;
- direct and transitive import closure, cycles, unavailable dependencies, and source/version provenance;
- generated versus source artifacts and reproducibility.

Use `scripts/ontology_audit.py` as an advisory check when RDFLib is available. Review every warning; some projects intentionally omit generic domain/range or use different definition properties.

### Layer 3 - OWL profile and global restrictions

Run a profile validator for the declared target. Report the exact violating axioms and whether they are intentional. Check OWL 2 DL global restrictions, especially interactions among property chains, simple/non-simple properties, cardinalities, disjoint properties, and property characteristics.

### Layer 4 - Consistency, satisfiability, and classification

With a reasoner suitable for the ontology profile:

- check ontology consistency;
- find unsatisfiable named classes;
- classify and compare the inferred hierarchy with expectations;
- inspect unexpected equivalences;
- test representative individual types and property assertions;
- include required imports and state reasoner settings.

An ontology can be consistent while containing unsatisfiable classes. Treat unintended unsatisfiable public classes as serious defects.

### Layer 5 - Expected entailments and non-entailments

Maintain explicit positive and negative suites for:

- subclass and equivalence classification;
- disjointness and incompatibility;
- property characteristics and inverses;
- property chains;
- domain/range typing;
- identity/difference behavior;
- existential, universal, and cardinality restrictions;
- mapping axioms and imported interactions.

An expected non-entailment is evidence only relative to the tested ontology, imports, reasoner, and semantics. It does not establish closed-world negation.

### Layer 6 - Competency queries

Execute CQ-linked SPARQL queries against fixed fixtures and compare normalized results. Record dataset construction and entailment/materialization. Include empty, boundary, multilingual, historical, and conflicting-provenance cases when relevant.

### Layer 7 - SHACL

Validate the intended data graph against the exact shapes graph. Record:

- SHACL version/features (Core, SPARQL extensions, advanced features);
- entailment regime or pre-materialization;
- target selection and named/default graph behavior;
- severity policy and whether warnings block release;
- shape imports and deactivated shapes;
- validator implementation and options.

### Layer 8 - Pitfall, taxonomy, mapping, and documentation review

Use automated pitfall scanners as leads, then verify semantically. Review OntoClean meta-properties, relation definitions, n-ary patterns, part-whole semantics, mapping strength/provenance, label/definition quality, modularity, and consumer documentation.

### Layer 9 - Domain and user validation

Ask independent domain reviewers to classify examples, explain definitions, inspect surprising inferences, and answer CQs. Capture disagreements and decisions. Automated reasoning cannot establish scientific or business truth.

### Layer 10 - Operational verification

Benchmark classification, query latency, validation time, memory, import resolution, build reproducibility, and publication checks with representative scale. Record the benchmark inputs and relevant environment conditions precisely, but do not mistake a single machine's result for a universal guarantee or add version locks without a stated need.

## 3. Logical reasoning tests

### Minimal failure localization

When inconsistency or unsatisfiability appears:

1. reproduce with the same import closure and reasoner;
2. identify the affected class/individual;
3. obtain explanations/justifications from the tool when supported;
4. minimize the causal axiom set;
5. translate the explanation into domain language;
6. determine whether an axiom, import, mapping, fixture, or expectation is wrong;
7. repair minimally and rerun the full interacting suite.

Do not remove disjointness, ranges, or imports merely because they expose contradictions. They may be correctly detecting a deeper modeling or data defect.

### Reasoner selection

Select by profile and task:

- EL-optimized reasoners for large OWL EL ontologies;
- complete OWL DL reasoners for expressive consistency and classification;
- rule-based engines for OWL RL/materialization;
- query rewriting systems for OWL QL/OBDA;
- structural reasoners only for editor assistance, never as evidence of logical consistency unless their limitations satisfy the contract.

Record completeness limitations. A timeout or unsupported construct yields `unverified`, not pass or fail.

## 4. SHACL and data validation

Keep OWL and SHACL responsibilities explicit:

| Need | OWL | SHACL |
|---|---|---|
| Infer types and relationships | Primary | Possible rules/extensions, implementation-dependent |
| State domain truths | Primary | Can describe expected graph shape but not equivalent semantics |
| Report missing required values | Open-world logic does not do this | `sh:minCount` |
| Limit accepted input values | May infer inconsistency/identity under strong axioms | `sh:in`, datatype/class, patterns, closed shapes |
| Validate cardinality in a record | Logical cardinality may merge identities or remain unknown | `sh:minCount`/`sh:maxCount` |
| Produce actionable result paths/messages | Not its purpose | Native validation report |

SHACL conformance is scoped: a data graph conforms to a shapes graph under a processor/configuration. It does not prove ontology consistency, completeness, truth, or fitness for every use.

Test shapes themselves:

- positive data that should conform;
- one minimal negative fixture per constraint component;
- boundary cardinalities and datatypes;
- target discovery under the declared inference regime;
- severity and message content;
- recursion and SPARQL behavior when used;
- closed-shape interaction with system/provenance properties.

## 5. Competency and regression tests

For each must-have CQ, require at least one executable or reviewable acceptance artifact. A robust suite includes:

- representative positive answers;
- plausible negative and near-miss cases;
- edge cases for time, units, language, provenance, and context;
- expected entailments and non-entailments;
- queries whose result sets are stable and reviewable;
- a domain-review protocol for judgments that cannot be automated.

Build regressions around semantic contracts, not serialized line positions. Normalize SPARQL results; compare RDF graphs modulo triple order and blank-node renaming; compare inferred taxonomies under the same reasoner and imports.

Use mutation checks selectively: remove or weaken a target axiom in an isolated copy and confirm the relevant test fails. This exposes tests that do not actually protect the intended semantics.

## 6. Metrics and pitfall scans

Useful descriptive metrics include:

- counts of classes, properties, individuals, logical axioms, annotations, imports, modules, and mappings;
- maximum/average taxonomy depth, branching, multiple inheritance, roots, leaves, and disconnected entities;
- missing labels/definitions/sources and language coverage;
- unsatisfiable classes and unexpected equivalences;
- profile violations and reasoner time;
- CQ coverage and test pass rates;
- deprecated terms with/without replacements;
- mapping relation distribution, confidence, evidence, and review status;
- import size, build time, query/validation time, and change churn.

Interpret metrics with context. A deep hierarchy is not inherently bad; few disjointness axioms may be appropriate; high annotation coverage says nothing about correctness. Use trends, thresholds tied to policy, and comparisons against the ontology's own contract.

OOPS!, ROBOT report, OBO Dashboard, FOOPS!, and similar tools provide useful automated findings but differ in scope and may produce false positives or omit conceptual defects. Preserve the tool report and record human disposition for each release-blocking issue.

## 7. Evidence interpretation

Report each check as:

```text
Check: OWL 2 DL consistency
Tool/configuration: <reasoner and options>
Inputs: <ontology plus import closure>
Observed result: consistent
Scope: classical OWL 2 direct semantics
Limitations: CQ fixtures and SHACL data not included
Evidence artifact: <path or URL>
```

Use these underlying check results:

- `pass`: the executed check met its declared expectation;
- `fail`: the executed check contradicted its expectation;
- `error`: the check did not complete because of tool/input/environment failure;
- `unverified`: the check was not executed or its evidence is unavailable;
- `not-applicable`: the approved contract excludes this layer, with rationale.

Record `accepted-exception` separately as a decision overlay on the original
result. It requires authority, rationale, scope, a durable decision artifact,
and an expiry or review condition. Never collapse `fail`, `error`,
`unverified`, or `accepted-exception` into `pass`.

## 8. Quality levels

Scale evidence to impact:

- **QA-L0**: exploratory notes; no conformance claims.
- **QA-L1**: parses, basic metadata/IRI checks, and manual CQ walkthrough.
- **QA-L2**: automated profile/reasoning or SHACL checks plus executable CQ tests for changed scope.
- **QA-L3**: full regression suite, semantic diff, independent domain review, and reproducible build.
- **QA-L4**: cross-tool verification, negative/mutation tests, operational benchmarks, governance/release evidence, and consumer migration checks.
- **QA-L5**: high-assurance or regulated evidence with independent review, traceability of every critical requirement, controlled environments, formal approval, and post-release monitoring.

Choose a level from user impact, integration reach, reversibility, regulatory/scientific consequences, and automation permissions. Do not claim a higher level unless every required evidence class was actually produced.
