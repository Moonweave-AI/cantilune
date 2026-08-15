# Conceptual modeling and ontological analysis

## Contents

1. Model the domain, not the file format
2. Categories and instantiation
3. Taxonomies and OntoClean checks
4. Identity, unity, and dependence
5. Relations and qualified relations
6. Part-whole modeling
7. Time, change, and events
8. Information, qualities, and measurements
9. Definitions and review questions

## 1. Model the domain, not the file format

Create a conceptual model before choosing OWL constructs. State what kinds of things exist in the intended domain, how they are identified, which distinctions matter to users, and which claims are stable enough to govern.

Maintain four separations:

- a word is not the concept it labels;
- a class is not a database table or UI category;
- an ontology axiom is not an input-validation rule;
- an observed dataset pattern is not automatically a universal domain truth.

Use examples, counterexamples, and boundary cases. When experts disagree, preserve the disagreement as an unresolved decision or context-specific view rather than manufacturing false consensus.

## 2. Categories and instantiation

Distinguish at least:

- **individual/particular**: a specific entity, event, quantity, or information artifact;
- **class/type/universal**: what multiple individuals instantiate;
- **relation**: how entities are connected;
- **quality**: a specifically dependent feature such as color or mass;
- **role**: an anti-rigid classification held in a context, such as reviewer or patient;
- **disposition/capability**: a realizable potential, such as solubility or sensing capability;
- **process/event**: something that unfolds or occurs in time;
- **information content entity**: a proposition, plan, dataset, model, or document content;
- **carrier**: a physical or digital artifact that concretizes information content.

### Class versus individual

Ask:

1. Can the candidate have multiple instances?
2. Does the ontology need to quantify over those instances?
3. Is the candidate a repeatable kind, or a particular standard/code/release?
4. Would representing it as a class create unintended metamodeling or reasoning?

Do not make a class merely because a value appears in a drop-down list. Use individuals, SKOS concepts, literal values, or value partitions according to the intended semantics.

### Role versus type

Model a classification as a role when an entity can gain and lose it without ceasing to exist as the same entity and when the classification depends on a context or relation. Represent the bearer, role, context, and relevant time explicitly when those distinctions answer CQs.

Avoid permanent subclasses such as `CustomerPerson` if a person is a customer only relative to an organization or contract. A role pattern often prevents combinatorial subclasses such as `EmployeeCustomerReviewer`.

## 3. Taxonomies and OntoClean checks

For every `A subClassOf B`, test:

- **is-a**: every A is a B in the intended interpretation;
- **identity inheritance**: A instances inherit B's identity criterion;
- **rigidity**: a rigid type must not be placed under an anti-rigid role;
- **unity**: subclasses do not mix wholes governed by incompatible unity criteria;
- **dependence**: dependence conditions are not lost or inverted;
- **exhaustiveness**: a partition is declared covering only with evidence;
- **disjointness**: sibling disjointness is asserted only if overlap is impossible, not merely absent from current data;
- **level consistency**: siblings classify along the same principle and granularity.

Common signals of a bad taxonomy:

- parent and child differ only by workflow state or data completeness;
- a relation such as `part-of`, `made-of`, or `used-for` is encoded as subclassing;
- an anti-rigid role subsumes a rigid kind;
- siblings mix function, material, location, and structural type;
- an asserted cycle hides synonymy or inconsistent direction;
- a class has a single child with no independent distinction;
- polyhierarchy produces unintended inherited restrictions.

Use multiple inheritance only when every parent characterization is independently true and their combined commitments are satisfiable.

## 4. Identity, unity, and dependence

### Identity

State what makes an entity the same entity across observations and change. Distinguish:

- persistent identity from identifiers or names;
- information-content identity from file/checksum identity;
- material object identity from role, owner, location, or state;
- process identity from its participants or output;
- version identity from work identity.

Do not use `owl:sameAs` for two records, identifiers, close matches, versions, or representations unless they denote the identical individual in every relevant interpretation.

### Unity

Ask what makes an aggregate one whole: physical connectedness, functional organization, membership rule, spatial boundary, institutional authority, or declared collection. Different unity criteria often require different classes or explicit views.

### Dependence

Model whether an entity cannot exist without another entity, a bearer, a process, or a context. Distinguish:

- specific dependence on a particular bearer;
- generic dependence on some bearer of a type;
- historical dependence from current dependence;
- logical constraints from metaphysical claims.

Use dependence carefully: strong universal/existential axioms can make classes unsatisfiable when imported commitments interact.

## 5. Relations and qualified relations

Define every relation with:

- domain and range meanings stated in prose;
- argument order and inverse, if valid;
- temporal and contextual scope;
- cardinality expectations and their enforcement layer;
- symmetry, asymmetry, reflexivity, irreflexivity, transitivity, and functionality only when universally true;
- examples, non-examples, and provenance.

RDF/OWL properties are binary. Introduce a relation individual (often a situation, participation, assignment, observation, or transaction) when the relation needs any of:

- more than two essential participants;
- time interval or validity period;
- provenance, evidence, confidence, authority, or source;
- quantity, rank, sequence, or other attributes;
- multiple occurrences between the same participants;
- lifecycle or governance of the relationship itself.

Connect the relation individual to each participant with explicit roles. Do not confuse RDF statement reification, RDF 1.2 triple terms, named graphs, and domain-level relation patterns; they solve different provenance and semantic problems.

## 6. Part-whole modeling

Do not use one generic `partOf` without deciding the meronymy:

- component-integral object;
- member-collection;
- portion-mass;
- material-object;
- feature-activity;
- place-area;
- phase/process segment.

State whether the relation is transitive and whether that transitivity remains valid across subrelation composition. `hasPart` is not normally functional. Part cardinality, order, and required composition often belong in SHACL or a qualified composition pattern.

Distinguish:

- permanent versus temporary part;
- essential versus optional part;
- direct versus transitive part;
- part of an individual versus subclass of a type;
- material composition versus organizational membership.

## 7. Time, change, and events

Choose a time model from the CQs:

- attach a timestamp to an observation when only recorded state matters;
- model time-indexed situations/states when relations change and history matters;
- model events/processes with participants and intervals when causes, transitions, or provenance matter;
- distinguish valid time (domain truth) from transaction/recording time when both are needed.

Avoid encoding every state as a permanent subclass. Use state individuals, role realizations, or qualified relations when entities can change state while retaining identity.

For repeated observations, distinguish the observed entity, property/quality, observation act, result/value, unit, method, observer, and time. This supports provenance and conflicting measurements without assigning multiple timeless values directly to the entity.

## 8. Information, qualities, and measurements

### Information and artifacts

Distinguish a plan from its execution, a law from a copy of the legal text, an ontology from a serialization file, and a dataset from a storage object. Use provenance to connect revisions, generations, derivations, and responsible agents.

### Qualities and values

For a simple, context-free scalar, a datatype property may suffice. Use a measurement/result pattern when unit, uncertainty, method, time, scale, provenance, comparison, or multiple observations matter.

Prefer established quantity/unit vocabularies when semantically compatible. Never hide a unit in a property name when data must interoperate or convert.

### Names and identifiers

Represent names, labels, codes, external identifiers, and IRIs separately. A label can change or be multilingual; an IRI is a persistent identifier; a code may be scoped to an authority and version. Model the issuing scheme and provenance when identifier reconciliation matters.

## 9. Definitions and review questions

Write definitions that help a reviewer decide membership:

- use the broader type plus differentiating conditions when possible;
- avoid circularity, obscurity, unexplained acronyms, and merely restating the label;
- state context and quantifiers explicitly;
- separate definitions from usage notes, examples, and implementation instructions;
- cite the source or decision authority.

Before formalization, ask:

1. What are the intended instances and clear non-instances?
2. What preserves identity through change?
3. Is the classification essential, contingent, contextual, or temporal?
4. Does the parent supply the same identity and unity criteria?
5. Is a purported class actually a role, state, value, relation, record, or concept-scheme entry?
6. Does a binary property lose participant roles, time, evidence, or multiple occurrences?
7. What does absence mean under the intended information model?
8. Which claims are domain truths, which are data policies, and which are workflow rules?
9. Which expert or source can authorize the commitment?
10. What test would expose a wrong modeling decision?
