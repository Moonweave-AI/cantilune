# Patterns, reuse, modules, and mappings

## Contents

1. Pattern discipline
2. Conceptual and logical patterns
3. OntoClean taxonomy analysis
4. Upper ontology decisions
5. Reuse and module extraction
6. Alignment and mapping governance

## 1. Pattern discipline

An ontology design pattern is a reusable solution to a recurring modeling problem under stated assumptions. Do not copy a pattern from its diagram alone. Record:

- problem and competency questions;
- intended participants and ontological commitments;
- axioms and expected entailments;
- consequences for identity, cardinality, time, and provenance;
- target OWL profile and reasoner behavior;
- alternatives and trade-offs;
- source, license, and adaptations;
- positive, negative, and boundary tests.

Prefer a small set of consistently applied patterns over many locally modified variants. When adapting a pattern, rename and document the variant so later reviewers do not assume the original semantics.

## 2. Conceptual and logical patterns

### Qualified n-ary relation / situation

Create an individual representing the relation occurrence and connect role-specific participants. Use when a relation has more than two participants, time, provenance, certainty, quantity, order, or its own lifecycle. Do not confuse this domain relation pattern with RDF statement reification or named-graph provenance.

### Role and context

Represent a role as anti-rigid and dependent on a context/relationship. Connect bearer, role type, context, and validity time when required. Use for employee, patient, reviewer, customer, participant, or device-in-a-deployment classifications that entities can gain or lose.

### Participation in event/process

Represent an event/process and participant roles rather than attaching all context to the participant. This supports multiple occurrences, causation, time, inputs/outputs, and provenance.

### Time-indexed state/relation

Represent a state/situation whose validity interval qualifies a property or relation. Use when the same entity persists through changing status, owner, location, membership, or capability.

### Observation and measurement

Separate observed entity, observable property/quality, observation act, result, numeric/categorical value, unit, method, agent, time, and uncertainty. Reuse a compatible observation/unit vocabulary when possible. Avoid properties such as `weightInKg2025`.

### Information realization

Separate information content from its files, pages, database rows, or physical carriers. Connect creation, revision, derivation, attribution, and concretization. Use for ontologies, plans, policies, datasets, documents, and software specifications.

### Collection and membership

Use membership for member-collection, not generic part-whole or subclassing. State whether the collection is extensional, ordered, closed, or versioned; RDF lists impose structural semantics different from an unordered collection.

### Sequence/list

Choose an RDF list when closed order and list operations are part of the exchange; otherwise model membership plus an explicit index/precedence relation. Validate list well-formedness and duplication operationally.

### Value partition

Use mutually disjoint and covering classes/individuals only when the domain truly supplies a closed partition. Under open world, declaring options without coverage does not close the set. For accepted input values, SHACL `sh:in` may be the correct layer.

### Closure restriction

Combine existential restrictions with universal restrictions when a defined class requires at least one value and limits all values. Test import interactions and remember this is logical closure for class members, not record completeness validation.

### Provenance

Reuse PROV-O's Entity, Activity, Agent, generation, usage, attribution, association, and derivation patterns when compatible. Qualify relations when their roles/time need detail. Keep provenance bundles and the entities they describe distinct.

### Vocabulary versus ontology

Use SKOS for concept schemes, labels, documentation, informal semantic relations, collections, and mapping relations. Use OWL classes/properties when formal model-theoretic entailment is intended. A `skos:Concept` is not automatically an `owl:Class`; combine only with a documented metamodeling strategy and compatible tools.

## 3. OntoClean taxonomy analysis

Annotate or reason informally about meta-properties:

- **rigidity**: an essential property of all instances (`+R`), anti-rigid (`~R`), or non-rigid (`-R`);
- **identity**: supplies or carries an identity criterion;
- **unity**: supplies or carries a unity criterion;
- **dependence**: instances depend on other entities.

Key review rule: an anti-rigid property must not subsume a rigid property. For example, `Student` should not be the parent of `Person`; the role depends on enrollment while personhood is not gained/lost that way.

Use OntoClean to expose taxonomic errors, not to auto-generate the domain. Meta-property judgments require domain analysis and may remain contested.

## 4. Upper ontology decisions

An upper ontology can align identity, time, process, role, quality, and relation modeling across modules. It also introduces substantial commitments and dependencies.

Evaluate:

- realist/descriptive/conceptual stance and intended domain;
- continuant/occurrent or endurant/perdurant distinctions;
- identity, dependence, time, and modality commitments;
- relation and pattern ecosystem;
- formal language/profile and reasoning/tool support;
- governance, maintenance, license, documentation, and community fit;
- existing domain-ontology alignment and migration cost.

Choose one of:

- import and conform to an upper ontology;
- reuse selected patterns/relations without full import, with provenance;
- map a local foundational layer to one or more upper ontologies;
- remain upper-neutral and document local category commitments.

Do not claim neutrality while silently mixing incompatible foundational categories.

## 5. Reuse and module extraction

### Direct reuse and import

Reuse a term only after comparing definition, examples, hierarchy, constraints, granularity, temporal/context assumptions, and authority. Import only when the dependency closure and all relevant commitments are acceptable.

### Module extraction

Define the extraction objective:

- signature/seed terms;
- CQs and required entailments;
- extraction method (for example, locality or reachability policy);
- upstream ontology/version and license;
- update/re-extraction policy;
- declarations/annotations to retain;
- known lost entailments or context.

Test the module against the upstream import closure for every protected CQ/entailment. A file subset produced by manual deletion is not a governed module.

### Extension

Place local specializations in the local namespace. Do not edit or redeclare upstream meanings under their namespace. Track upstream changes and test whether local subclasses, equivalences, and restrictions remain coherent.

## 6. Alignment and mapping governance

Treat a mapping as a claim with scope and provenance, not a string match.

Record at least:

- subject and object IRIs;
- mapping predicate and direction;
- source and target ontology/version;
- mapping justification/evidence;
- creator, creation date, review status, and method;
- confidence when meaningful, including how it was computed;
- semantic scope/context and known limitations;
- superseded mapping or issue reference.

Use SSSOM for shareable, provenance-rich mapping sets when its model fits. Keep candidate mappings separate from approved mappings.

### Mapping strength

- identity/equivalence: substitutable under all relevant semantics; highest proof burden;
- exact match: same intended concept within the chosen mapping framework, not automatically OWL equivalence;
- broader/narrower: directional inclusion at a concept-scheme level;
- close/related: useful correspondence without safe substitution;
- custom mapping: define semantics, direction, scope, and inference policy.

Validate mappings by:

1. lexical and definition comparison;
2. hierarchy and neighborhood compatibility;
3. examples/counterexamples and extension overlap;
4. logical coherence after any mapping axioms are activated;
5. CQ/query impact;
6. expert adjudication;
7. provenance and version completeness.

Mapping tools may generate candidates with lexical, structural, logical, or embedding methods. Never let a similarity threshold alone authorize `owl:sameAs`, class equivalence, or production migration.
