# Ontology engineering anti-patterns

Use this catalog as a review prompt. Confirm each suspected issue against the ontology contract; not every heuristic is a defect in every ontology.

## Requirements and process

| Anti-pattern | Failure mode | Correction |
|---|---|---|
| Terms before questions | Vocabulary grows without a testable purpose. | Define users, scope, CQs, examples, and acceptance evidence first. |
| Model the source schema as truth | Storage/legacy accidents become domain commitments. | Separate observed data structure from domain analysis and mapping. |
| One-expert ontology | Unchallenged idiolect becomes a shared standard. | Use multiple domain perspectives and record decisions/disagreements. |
| Big-bang taxonomy | Interactions are discovered after thousands of terms. | Build CQ-driven vertical slices with reasoning and tests. |
| Tool-green development | Passing one validator substitutes for semantic review. | Use layered QA and independent domain validation. |
| Chat-only decisions | Meaning and authority vanish after the session. | Write decisions into the canonical project artifacts. |
| Undefined ownership | Requests, conflicts, and deprecations stall. | Assign Owner, DRI, reviewers, and release authority. |

## Conceptualization and taxonomy

| Anti-pattern | Failure mode | Correction |
|---|---|---|
| Label-as-concept | Homonyms/polysemy collapse distinct meanings. | Define referents; use separate IRIs and contextual labels. |
| Synonyms as sibling classes | Equivalent labels create fake distinctions. | Use alternate labels or justified equivalence. |
| `is-a` catch-all | Part-of, located-in, made-of, role, and state become subclasses. | Name and define the actual relation. |
| Role under rigid type | Anti-rigid classifications distort identity. | Model roles/situations and their contexts. |
| Mixed sibling principle | Function, material, location, and form appear at one level. | Separate classification axes or use defined cross-products. |
| State explosion | Every status combination becomes a class. | Model states/roles/qualities with time and constraints. |
| Class-individual confusion | Enumerated values or records become classes without need. | Choose class, individual, SKOS concept, or literal from CQs. |
| Relation blindness | A binary edge loses time, evidence, participants, or occurrence identity. | Use a qualified relation/event/situation pattern. |
| Generic part-of | Incompatible meronomies and transitivity are mixed. | Define part-whole subrelations and composition behavior. |
| Record identity as real identity | Duplicate records are asserted `owl:sameAs`. | Model records/identifiers and reconciliation evidence separately. |
| Universal timeless value | Changing measurements or roles are attached directly forever. | Model observation/state/time/provenance. |
| Circular or label-restating definition | Definitions do not decide membership. | Use differentiating conditions, examples, and counterexamples. |

## RDF/RDFS/OWL formalization

| Anti-pattern | Failure mode | Correction |
|---|---|---|
| Domain/range as validation | Bad input is inferred into the stated types. | Use SHACL for accepted-input constraints. |
| Functional property as uniqueness check | Distinct values may be inferred equal instead of rejected. | Use SHACL/storage uniqueness; retain logical functionality only if true. |
| Different IRIs imply different things | OWL has no unique-name assumption. | Assert difference only with evidence or validate identifiers outside OWL. |
| Missing triple means false | Open-world absence is treated as negation. | Use explicit closure, SHACL, complete datasets, or application policy. |
| `only` means `some` | Universal restriction is used to require existence. | Combine universal and existential restrictions when both are intended. |
| Equivalence for similarity | New bidirectional entailments create wrong classifications. | Use weaker mappings or documented relatedness. |
| `owl:sameAs` for mappings | All properties propagate across non-identical entities. | Use exact/close/broad/narrow mapping with provenance. |
| Overasserted disjointness | Legitimate overlap creates inconsistency/unsatisfiability. | Assert only conceptually impossible overlap; test boundary cases. |
| Unjustified transitivity | Path composition creates unintended distant relations. | Prove transitivity for the exact relation and contexts. |
| Broad property chain | Remote axioms infer unexpected assertions and types. | Scope the relation design and add negative entailment tests. |
| Hidden OWL Full | Punning/metamodeling or RDF constructs exceed selected tools. | Declare the semantic regime or refactor to OWL DL-compatible patterns. |
| Import suppression | Removing dependencies hides contradiction and changes meaning. | Diagnose the interaction; use governed modules or mappings. |
| Blank-node public terms | Terms cannot be referenced, reviewed, or deprecated reliably. | Give public vocabulary entities persistent IRIs. |
| Serialization diff as semantic diff | Reordering/prefix/blank-node changes appear semantic. | Compare parsed graphs and entailment contracts. |

## SHACL, SPARQL, and tests

| Anti-pattern | Failure mode | Correction |
|---|---|---|
| Shape without inference contract | Targets and class constraints vary by processor/setup. | Record entailment/materialization and test target discovery. |
| Closed shape everywhere | Legitimate extension/provenance properties are rejected. | Close only stable interfaces and list ignored properties. |
| Warning laundering | Blocking violations are downgraded to make CI green. | Tie severity to policy and approve exceptions explicitly. |
| Query tests without expected sets | Execution success says nothing about correctness. | Store normalized expected bindings/graphs. |
| Positive-only fixtures | Overgeneralization and unintended entailments survive. | Add negative, boundary, and near-miss fixtures. |
| Self-fulfilling tests | Test data explicitly asserts the expected inferred result. | Separate premises from expected consequences; mutation-check critical tests. |
| Validator equals reasoner | Data conformance is mistaken for logical consistency. | Report SHACL and OWL evidence separately. |

## Reuse, modules, and mappings

| Anti-pattern | Failure mode | Correction |
|---|---|---|
| Reuse by label | Lexical matches hide different commitments. | Compare definitions, examples, hierarchy, identity, and context. |
| Import the universe | Dependency size/conflicts overwhelm the use case. | Assess imports; extract a coherent, provenance-preserving module when justified. |
| Copy without provenance | Local terms drift invisibly from upstream. | Preserve source/version/license and update policy. |
| Flat crosswalk | Mapping direction, evidence, confidence, and scope disappear. | Use SSSOM or an explicit mapping model. |
| Automatic mapping as truth | Similarity candidates become authoritative axioms. | Separate candidate generation from expert adjudication. |
| Module by file deletion | Required entailments or declarations are lost unpredictably. | Use a stated extraction signature/method and coverage tests. |

## Governance and release

| Anti-pattern | Failure mode | Correction |
|---|---|---|
| Recycle an IRI | Existing consumers silently receive a different referent. | Mint a new IRI; deprecate and migrate the old one. |
| Version number without policy | Consumers cannot infer compatibility. | Define semantic change classes and migration expectations. |
| Latest imports without control | Builds and entailments drift. | Use catalogs/resolution policy and rerun regressions on updates. |
| Release ontology only | Shapes, queries, mappings, docs, and evidence fall out of sync. | Publish a coordinated release set. |
| Unknown asset license | Redistribution creates legal/provenance risk. | Resolve license, link instead of bundle, or exclude. |
| Permanent deprecation limbo | Consumers cannot plan migration or retirement. | Assign replacement, schedule, notifications, and owner. |
| Fabricated verification | Trust is based on checks that never ran. | Mark unavailable evidence `unverified`; retain actual tool outputs. |

## Fast smells

Investigate when you see:

- `owl:sameAs` or equivalence used much more often than documented mappings;
- many public terms without definitions or sources;
- one property named `has`, `relatedTo`, `partOf`, or `is` carrying unrelated meanings;
- multiple domain/range statements apparently intended as alternatives;
- a highly connected root such as `Entity` with little semantic differentiation;
- cycles, unexpected equivalences, unsatisfiable classes, or a sudden inferred-hierarchy collapse;
- mappings without source/target versions, predicate, evidence, author, or review status;
- a new release whose tests use a different import closure or entailment regime than production;
- fixes that delete the axiom exposing an error but add no regression or domain decision.
