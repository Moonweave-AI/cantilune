# Governance, versioning, provenance, and release

## Contents

1. Decision rights and lifecycle
2. Change control
3. Identifier and version policy
4. Deprecation and migration
5. Provenance and licensing
6. FAIR and OBO-aligned practices
7. Release set and maintenance

## 1. Decision rights and lifecycle

Assign roles explicitly:

- **Owner**: accountable for scope, sustained value, and resourcing;
- **DRI/maintainer**: drives issues, implementation, evidence, and release preparation;
- **domain authority/reviewer**: approves meanings and scientific/business commitments;
- **ontology engineer**: owns formalization quality and tool interpretation;
- **consumer representative**: validates queries, integrations, and migration impact;
- **release authority**: approves publication based on evidence;
- **infrastructure steward**: maintains PURLs, registries, CI, catalogs, and publication.

One person may hold multiple roles in a small project, but accountability must remain visible. Chat approval is not a durable source of truth; record decisions in issues, decision records, ontology annotations, release records, or the canonical repository.

Use lifecycle states such as `proposed`, `draft`, `active`, `deprecated`, and `retired` for terms, and `idea`, `prototype`, `active`, `deprecated`, and `retired` for the ontology. Define who may change each state and the evidence required.

## 2. Change control

Require a change proposal to include:

- problem, requester, affected users/CQs, and urgency;
- terms, axioms, shapes, mappings, imports, queries, or policies affected;
- authoritative domain evidence and alternatives;
- compatibility and migration analysis;
- test plan and required reviewers;
- proposed change class and release target.

Classify by semantic impact, not text diff:

- **patch-compatible**: fixes metadata, documentation, serialization, or implementation without changing the protected semantic contract;
- **additive**: adds terms/axioms that preserve existing intended results but may produce new entailments or validation outcomes;
- **deprecating**: retains old identifiers while steering consumers to replacements;
- **breaking**: changes/removes meanings, entailments, constraints, identifiers, mappings, query results, or supported profiles in a way that requires consumer action.

An added disjointness, domain, range, equivalence, cardinality, or property characteristic can be breaking even when no term is removed.

Decision path:

1. triage and assign Owner/DRI;
2. evaluate domain evidence and CQs;
3. choose conceptual/formal design and alternatives;
4. implement in a controlled branch/workspace;
5. execute QA proportional to impact;
6. obtain domain, engineering, consumer, and release approvals;
7. publish, notify, migrate, and monitor.

## 3. Identifier and version policy

### Persistent identifiers

- Give every public term a persistent IRI.
- Never reuse an IRI for a different referent.
- Keep labels, organizational ownership, and hierarchy out of the identifier when they are likely to change.
- Define behavior for current, versioned, deprecated, and retired resources.
- Preserve redirects/tombstones and machine-readable deprecation information.
- Test resolution and content negotiation when Web dereferenceability is promised.

### Ontology and version IRIs

Distinguish ontology identity from the versioned document. State whether consumers import the stable ontology IRI, a version IRI, or a catalog-resolved artifact. Preserve prior versions according to policy.

Version labels may use semantic-version-like numbers, dates, or another scheme, but define what the components mean for ontology consumers. Software SemVer cannot be applied mechanically because logical additions can change entailments and data validation.

Record:

- current version and prior version;
- release date and status;
- target language/profile;
- import/dependency versions or resolution policy;
- compatible/incompatible predecessor claims with evidence;
- source and generated artifact identity.

## 4. Deprecation and migration

When a public term should no longer be used:

1. keep the IRI and mark it deprecated with the project's standard annotation;
2. preserve its last stable definition and change history;
3. provide replacement/mapping only when semantically valid;
4. state the reason, migration instructions, effective release, and removal/retirement policy;
5. keep query and validation behavior explicit during the transition;
6. notify affected consumers and track adoption;
7. never repurpose the IRI.

Replacement relations differ:

- exact logical equivalence can justify OWL equivalence, with all its entailments;
- a preferred successor or editorial replacement needs a weaker project annotation;
- vocabulary mappings may use SKOS or SSSOM with scope and evidence;
- data migrations require transformation rules and validation, not only ontology annotations.

For splits and merges, provide a decision table or executable migration based on distinguishing data. A single exact mapping is usually insufficient.

## 5. Provenance and licensing

Record provenance for:

- requirements and domain definitions;
- reused/imported terms and modules;
- mapping assertions and their evidence/confidence;
- generated files, build tools, and responsible agents;
- reviews, approvals, and releases;
- datasets and fixtures used for tests.

Use PROV-O or another agreed model when machine-readable provenance is needed. Distinguish entity, activity, agent, derivation, revision, attribution, and generation. Do not embed confidential review material or personal data in a public ontology merely for traceability.

Licensing checks:

- identify the license and attribution requirements of each imported or copied asset;
- distinguish linking/reuse by IRI from redistributing source content;
- verify that module extraction and modified redistribution are allowed;
- preserve notices required by upstream projects;
- treat unknown or incompatible licensing as a release blocker for bundled content;
- do not copy substantial copyrighted text into definitions or documentation; synthesize and cite.

## 6. FAIR and OBO-aligned practices

Apply FAIR as operational design goals:

- **Findable**: persistent identifiers, rich metadata, registry/index inclusion, version links;
- **Accessible**: resolvable identifiers and documented standard protocols, with authentication/authorization described when required;
- **Interoperable**: formal shared languages, qualified references, reused vocabularies, mappings with explicit semantics, and machine-readable context;
- **Reusable**: clear license, provenance, scope, definitions, community standards, versioning, and quality evidence.

FAIR does not mean open without restriction, correct, or logically coherent. Evaluate those properties separately.

Generalize relevant OBO Foundry principles beyond biomedicine when appropriate:

- open or clearly licensed availability;
- common formal format;
- unique persistent identifier space;
- documented versioning;
- clear non-overlapping scope;
- textual definitions and source attribution;
- reuse of established relations;
- user and developer documentation;
- demonstrated users and collaborative development;
- a locus of authority;
- naming conventions and change notification;
- active maintenance, stable term meaning, and responsiveness.

Do not claim OBO Foundry compliance unless the ontology is in scope for that community and has passed its actual review/dashboard process. Report `OBO-aligned practices` instead.

## 7. Release set and maintenance

Release together:

- canonical source ontology;
- versioned, documented distributions and modules;
- import catalog/resolution policy;
- SHACL shapes and their supported features;
- competency queries, fixtures, entailment/non-entailment tests, and results;
- mappings with provenance, confidence/evidence, and review status;
- generated human-readable documentation;
- machine-readable metadata, license, creators, dates, versions, and dependencies;
- semantic diff, change classification, deprecations, and migrations;
- reproducible build/CI configuration and evidence manifest.

Before publication, verify the release checklist in `assets/release-checklist.md` and assign a disposition to every failed or unavailable check.

Maintain after release:

- monitor issue and term-request channels;
- review dependency/import updates and security/tool changes;
- test PURLs, documentation, catalogs, and distributions;
- track usage, unresolved CQs, accepted exceptions, and deprecations;
- schedule domain/technical review proportional to change rate and impact;
- define withdrawal, rollback, orphaned-project, and succession procedures.

A release is complete only when consumers can identify what changed, determine semantic impact, obtain the exact artifacts, validate them, and know who owns the next maintenance decision.
