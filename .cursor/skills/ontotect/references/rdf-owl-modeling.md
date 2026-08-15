# RDF, RDFS, and OWL modeling

## Contents

1. RDF foundations
2. RDFS entailment
3. OWL interpretation discipline
4. OWL constructs and restrictions
5. Property characteristics
6. Profile selection
7. Imports, modules, and ontology identity
8. Modeling checks
9. Standards status

## 1. RDF foundations

An RDF graph is a set of triples. Ordering, prefix choice, whitespace, and concrete serialization do not change graph meaning. An RDF dataset contains a default graph and zero or more named graphs; dataset semantics and application conventions must be stated rather than assumed.

### Nodes

- Use IRIs for stable, globally referenceable entities and vocabulary terms.
- Use literals for values with an appropriate datatype or language tag.
- Use blank nodes for existential/local structures only when persistent reference, merging, provenance, and review do not require stable identity.
- Do not treat a prefixed name as the identifier; it abbreviates an IRI under a prefix declaration.
- Do not infer identity from equal labels or inequality from different IRIs.

### IRI policy

Define:

- ontology IRI and document retrieval policy;
- version IRI pattern;
- term namespace and local identifier policy;
- slash/hash behavior and content negotiation if published on the Web;
- permanence, redirects, tombstones, and deprecation;
- separation of stable identifiers from mutable labels or organizational ownership.

Prefer opaque or meaning-light persistent IDs when labels and organizational structures are expected to change. Human-readable IRIs are acceptable only with an explicit stability policy.

## 2. RDFS entailment

RDFS supplies classes, subclass/subproperty hierarchies, domain/range entailments, and basic vocabulary description.

Interpret these axioms correctly:

```turtle
:employs rdfs:domain :Organization ;
          rdfs:range :Person .
```

If `:x :employs :y` is asserted, RDFS entails `:x rdf:type :Organization` and `:y rdf:type :Person`. It does not reject a triple because types were omitted, nor does it constrain the property to be used only on predeclared organizations and persons. Use SHACL for that operational validation need.

Multiple `rdfs:domain` or `rdfs:range` statements are conjunctive entailments, not alternatives. Model alternative allowed types with a union class in OWL or a SHACL `sh:or`, according to intent.

`rdfs:subClassOf` and `rdfs:subPropertyOf` are transitive. Cycles entail equivalence-like mutual subsumption; determine whether they expose synonyms or modeling errors.

## 3. OWL interpretation discipline

OWL describes classes of possible interpretations. Apply these assumptions explicitly:

- **Open world**: missing information is unknown, not false.
- **No unique-name assumption**: different names may denote the same individual unless difference is stated or entailed.
- **Monotonicity**: adding facts does not normally retract previous entailments; defaults and exceptions require another layer or pattern.
- **Classical semantics**: inconsistency is not an ordinary validation report. Under classical entailment, an inconsistent ontology trivializes entailment, so consistency must be checked.

Distinguish:

- asserted axioms from entailed axioms;
- ontology consistency from class satisfiability/coherence;
- necessary conditions (`subClassOf`) from necessary-and-sufficient conditions (`equivalentClass`);
- schema/TBox statements from individual/ABox assertions;
- entailment from integrity validation.

### Necessary versus sufficient

```text
SubClassOf(Heart Valve)
```

says every heart is a valve only if that is what the terms mean; it does not define all valves as hearts. An equivalence such as `Heart EquivalentTo Valve and partOf some CardiovascularSystem` supports classification in both directions and must be justified by a complete definition.

Do not use equivalence to indicate similarity, preferred mapping, shared label, or approximate coverage.

## 4. OWL constructs and restrictions

### Class constructors

- intersection: all operands apply;
- union: at least one operand applies;
- complement: membership outside a class, under open-world semantics;
- enumeration/oneOf: exactly the listed individuals, subject to identity semantics;
- existential restriction `some`: at least one value in the filler class exists;
- universal restriction `only`: all known/possible values are in the filler class, but no value is required;
- minimum/maximum/exact cardinality: logical restrictions whose interactions with identity and missing information must be understood;
- hasValue: at least one specified value;
- hasSelf: relation to self.

Common closure pattern:

```text
SubClassOf(hasIngredient some Fruit)
SubClassOf(hasIngredient only (Fruit or Water))
```

The existential requires an ingredient; the universal closes the allowed filler classes logically for members of the class. It does not validate an incomplete RDF record without the intended inference assumptions.

### Disjointness

Use disjointness to expose impossible overlap and improve classification, but only when overlap is conceptually impossible. Current data separation, different departments, or user-interface tabs do not prove disjointness.

Use pairwise disjointness or `DisjointUnion` deliberately. A covering partition without disjointness and a disjoint set without coverage express different commitments.

### Keys and identity

OWL 2 `HasKey` participates in logical identity reasoning for named class instances; it is not a database uniqueness constraint. Use SHACL or storage constraints for input uniqueness. Test key behavior with the selected reasoner and import closure.

## 5. Property characteristics

Assert characteristics only when universally true over the intended relation:

- **functional**: each subject has at most one distinct value;
- **inverse functional**: each object has at most one distinct subject;
- **transitive**: relation composes with itself;
- **symmetric/asymmetric**: direction is equivalent/prohibits reverse;
- **reflexive/irreflexive**: every/no individual in the interpretation relates to itself under the relevant restrictions;
- **inverse**: argument reversal is exact;
- **property chain**: a path entails a superproperty assertion.

Risks:

- functionality may cause two values to be inferred identical rather than reported as an error;
- transitivity with cardinality restrictions can violate OWL DL global restrictions or produce unintended entailments;
- domain/range and chains can type individuals far from the asserted triple;
- inverse-functional identifiers can collapse records incorrectly;
- a chain is one-way entailment, not a rule equivalence.

Maintain positive and negative entailment tests for every nontrivial characteristic or chain.

## 6. Profile selection

Choose an OWL 2 profile from reasoning tasks and ontology structure:

| Profile | Prefer when | Typical strength/trade-off |
|---|---|---|
| EL | Very large class hierarchies with existential restrictions; classification is central. | Polynomial-time standard reasoning; restricted negation, universals, and cardinalities. |
| QL | Ontology-based access over large relational data; query rewriting is central. | Efficient query answering through database technology; limited schema expressivity. |
| RL | Rule engines, RDF data, and scalable materialization are central. | Rule-friendly polynomial reasoning; restricted constructors and axiom forms. |
| DL | Required semantics exceed profiles and decidable complete reasoning remains necessary. | Greater expressivity with potentially high reasoning cost and global restrictions. |
| Full/RDF-based | Metamodeling or unrestricted RDF use is intentional and compatible tools are selected. | Reasoning completeness/decidability and tool interoperability may be lost. |

Do not select a profile from file size alone. Run a profile checker and document any out-of-profile axiom, its purpose, and accepted tool impact.

## 7. Imports, modules, and ontology identity

`owl:imports` imports the ontology identified by its ontology IRI according to the tool's resolution mechanism. It is a semantic dependency, not a textual include.

For reproducibility:

- record direct and transitive dependencies;
- use catalogs or an equivalent controlled resolver in builds;
- preserve source ontology/version IRIs and licenses;
- distinguish upstream source from extracted/local modules;
- document the extraction signature and method;
- rerun tests when imports change;
- avoid editing third-party ontology content under its original namespace.

Distinguish:

- ontology IRI: identity of the ontology;
- version IRI: identity of a particular version;
- ontology document location: where a serialization is retrieved;
- prior/backward compatibility annotations: metadata claims that require a project policy.

## 8. Modeling checks

Before accepting an axiom, ask:

1. Which requirement or authoritative source supports it?
2. Is it universally true or only typical, contextual, temporal, or procedural?
3. What intended entailment should a reasoner produce?
4. What unintended entailment could interact with imports?
5. Does it preserve the target OWL profile and global restrictions?
6. Is the same need better expressed as SHACL, SPARQL, a mapping assertion, or application logic?
7. Are positive and negative fixtures available?
8. Does the axiom alter identity, disjointness, cardinality, or public subsumption?

High-risk OWL mistakes include:

- using universal restrictions without an existence restriction when existence is required;
- using `some` as if it meant all;
- using `owl:sameAs` for close matches or duplicate records;
- adding domain/range to validate rather than infer;
- declaring properties functional to catch duplicate input;
- treating two differently named individuals as different;
- assuming a reasoner will report missing data;
- hiding an inconsistency by removing imports;
- treating unsatisfiable classes as harmless because the ontology itself remains consistent;
- relying on an editor's displayed hierarchy without recording the reasoner and configuration.

## 9. Standards status

Use stable Recommendations as the default interoperability baseline unless the project explicitly adopts a newer draft:

- RDF 1.1 Concepts and RDFS 1.1 are W3C Recommendations.
- OWL 2 Second Edition is the stable W3C Recommendation family.
- SHACL 2017 is the latest Recommendation; SHACL 1.2 was a Working Draft in 2026.
- SPARQL 1.1 is the stable Recommendation family; SPARQL 1.2 documents remained Working Drafts in 2026.
- RDF 1.2 Concepts reached Candidate Recommendation Snapshot in April 2026 and adds triple terms and directional language-tagged strings; treat adoption as an explicit compatibility decision until Recommendation status changes.

Recheck W3C status pages at release time. Record syntax and feature versions in the ontology contract rather than assuming that a parser's acceptance guarantees ecosystem support.
