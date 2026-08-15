# Review, repair, optimization, and refactoring

## Contents

1. Review protocol
2. Finding severity and format
3. Root-cause diagnosis
4. Repair protocol
5. Refactoring catalog
6. Optimization protocol
7. Semantic diff and completion

## 1. Review protocol

Freeze the review target before analysis:

- source files and generated distributions;
- ontology/version IRIs and import closure;
- data and shapes graphs;
- query/test fixtures;
- reasoners, validators, profiles, catalogs, and build configuration;
- intended uses, competency questions, governance policy, and protected interfaces.

Review in this order:

1. reconstruct the intended contract and mark assumptions;
2. inventory artifacts, namespaces, modules, imports, mappings, and generated outputs;
3. run applicable verification layers;
4. inspect conceptual commitments and definitions;
5. inspect high-impact axioms, property characteristics, restrictions, and mappings;
6. trace failed CQs or validations to causal artifacts;
7. assess identifier, migration, license, maintenance, and release risks;
8. report evidence-led findings without modifying the baseline.

Sample representative terms only after using deterministic checks for complete categories. State the sampling strategy and never imply uninspected material was reviewed.

## 2. Finding severity and format

Assign severity from impact, reachability, and release relevance:

- **blocker**: publishing would violate law/license, leak sensitive data/secrets, recycle identifiers, ship an unbounded high-impact behavior, or lack required authority/evidence;
- **critical**: inconsistency, widespread wrong entailments, destructive identifier/mapping break, or a must-have CQ systematically fails;
- **major**: unsatisfiable public classes, materially incomplete/incorrect semantics, invalid constraints, unstable build/imports, or significant migration burden;
- **minor**: localized metadata, documentation, maintainability, or low-impact modeling defect;
- **advisory**: optional improvement or future risk with no demonstrated contract violation.

Do not assign severity from aesthetic preference or tool category alone.

Write each finding as:

```text
F-### Title
Severity / confidence
Affected IRI, axiom, shape, mapping, or artifact
Observed evidence and reproduction
Intended behavior or violated requirement
Semantic and downstream impact
Root-cause analysis
Minimal remediation and alternatives
Verification needed after the change
Owner and decision/release gate
```

Separate one causal problem from its repeated symptoms. Group only when one remediation and one verification path resolve the entire set.

## 3. Root-cause diagnosis

Classify defects before editing:

- **requirement**: CQ, scope, user, or acceptance criterion is missing or contradictory;
- **knowledge acquisition**: source authority, example, or domain evidence is wrong/incomplete;
- **conceptualization**: category, identity, taxonomy, relation, time, or granularity is wrong;
- **formalization**: conceptual intent was translated into an incorrect or overly strong/weak axiom;
- **assertion/data**: ABox data contradicts the intended ontology or lacks required evidence;
- **constraint**: SHACL/application policy does not match the declared valid graph;
- **mapping**: correspondence strength, direction, scope, evidence, or provenance is wrong;
- **dependency**: import, module extraction, catalog, or upstream drift changed semantics;
- **serialization/build**: source/generation/formatting introduces loss or nondeterminism;
- **tool/configuration**: wrong reasoner, profile, entailment regime, dataset, graph, or option;
- **governance**: ownership, identifiers, review, versioning, documentation, or release controls failed.

For logical failures, obtain a justification/minimal explanation when supported. Translate the causal set into domain statements and ask which statement or expectation is false. A minimal logical explanation is not automatically the minimal safe organizational repair.

## 4. Repair protocol

1. Preserve the untouched baseline and failing evidence with a separate copy or existing VCS reference; do not create hashes or version locks unless integrity risk or the acceptance contract requires them.
2. Define the intended semantic result and protected invariants.
3. Minimize the causal terms, axioms, shapes, mappings, imports, or build steps.
4. Consider repairs at the earliest defective layer: requirements before concept model, concept model before syntax.
5. Select the smallest repair that restores intent without weakening unrelated guarantees.
6. Add a regression that fails on the baseline and passes on the repair.
7. Rerun interacting logical, SHACL, CQ, mapping, documentation, and build checks.
8. Produce semantic and migration impact; request authority for breaking changes.

Repair decision examples:

| Symptom | Investigate first | Unsafe shortcut |
|---|---|---|
| Unsatisfiable class | disjointness, inherited restrictions, ranges, equivalences, imports | delete the disjointness axiom |
| Duplicate values violate application policy | identity assumptions and SHACL/storage constraint | mark property functional and expect an error |
| Missing query result | data, entailment/materialization, direction, CQ semantics | add a broad equivalence axiom |
| Unexpected type | domain/range, property chain, equivalence, imported hierarchy | remove the observed type assertion only |
| Mapping creates inconsistency | mapping strength/scope and source commitments | replace all mappings with `owl:sameAs` or delete imports |
| Shape rejects valid data | target, path, inference, closed-shape policy | deactivate the whole shape |

## 5. Refactoring catalog

Refactor only with an explicit semantic preservation contract.

### Extract module

Create a coherent module around a signature or CQs. Preserve source ontology/version provenance and extraction method. Test required entailments against the original import closure; document lost non-required entailments and update behavior.

### Split overloaded class

When one class combines several meanings, define distinct classes and decide how existing instances migrate. Do not preserve a polysemous IRI by silently changing its definition. Deprecate or retain it as an explicitly defined union only when that meaning is still useful and governed.

### Replace state subclasses

Replace combinatorial subclasses with state/role/situation individuals or qualified relations when classifications are temporal/contextual. Provide compatibility mappings only when their semantics are valid.

### Normalize relation pattern

Replace duplicate ad hoc reifications with one qualified relation pattern. Preserve participant roles, relation occurrence identity, time, provenance, and queries. Do not collapse repeated relation instances into a single binary assertion.

### Move constraint to the correct layer

Move input completeness, format, workflow, and closed-world constraints from OWL to SHACL/application policy when they are not universal domain truths. Keep OWL axioms that support intended entailments.

### Reduce redundant assertions

Remove only assertions provably entailed under the supported import closure and reasoner, and only when consumers do not require materialized triples. Record generation/materialization policy; avoid creating fragile dependence on an unavailable reasoner.

### Rename labels versus migrate IRIs

Change labels and definitions under governance when the referent remains stable. Changing an IRI is a migration even if the label stays the same. Never recycle a deprecated IRI.

### Reorganize modules

Move axioms across source modules while preserving ontology identity, imports, visibility, and generation. Compare full import-closure entailments and build outputs.

## 6. Optimization protocol

Optimization requires a measured objective. Possible targets:

- reasoner classification time or memory;
- SPARQL query latency or result materialization cost;
- SHACL validation time;
- ontology/import/module size;
- build reproducibility and CI duration;
- human review complexity and diff noise.

Procedure:

1. freeze representative ontology, data, imports, queries, tools, and environment;
2. define metric, budget, and protected semantic results;
3. profile to locate the bottleneck;
4. test one change at a time;
5. compare before/after measurements with repeated runs when variance matters;
6. run semantic regressions and profile checks;
7. document the trade-off and rollback path.

Candidate strategies:

- select EL/QL/RL-compatible constructs when the use case fits;
- extract a locality/signature module and validate coverage;
- separate authoring ontology from a generated runtime distribution;
- precompute/materialize selected entailments for read-heavy workloads;
- simplify pathological property chains or highly interacting cardinalities after semantic review;
- optimize store indexes/query shapes at the data layer rather than weakening the ontology;
- partition SHACL shapes or focus targets when validation scope permits;
- cache immutable imports with controlled catalog resolution.

Do not optimize by deleting definitions, provenance, negative tests, or governance evidence. Human maintainability is a valid metric but must not be claimed from line-count reduction alone.

## 7. Semantic diff and completion

Compare at least:

- ontology/version IRIs and imports;
- public term declarations, labels, definitions, status, and replacements;
- added/removed logical axioms and shapes;
- inferred subclass/equivalence hierarchy;
- consistency and unsatisfiable classes;
- expected entailment and non-entailment suites;
- CQ query results;
- SHACL result sets;
- mappings and mapping evidence;
- module/build outputs and operational metrics.

Classify each change as metadata-only, logically inert under the chosen semantics, additive entailment, removed entailment, constraint strengthening/weakening, deprecation, identifier migration, or breaking semantic change. `Logically inert` is always relative to the tested semantics and import closure.

Complete a repair/refactor/optimization only when the target defect or metric is resolved, protected invariants pass, semantic impact is documented, required reviewers approve, and all unavailable evidence is marked `unverified`.
