# Evidence register and source status

This register records the corpus used to construct Ontotect and the authority boundaries that should govern future updates. It is an evidence map, not a claim that the open Web has a finite or exhaustively enumerable ontology-engineering literature.

**Research cut-off:** 2026-08-07

**Local coverage:** 29 PDFs, 2,045 pages, 791,157 extracted words (about 1.05M estimated tokens)

**Web coverage:** standards bodies, original method authors, official projects, institutional repositories, and primary research were searched to topic saturation.

## Contents

1. [How to use evidence](#how-to-use-evidence)
2. [Local books](#local-books)
3. [Local method and application papers](#local-method-and-application-papers)
4. [Local tool material](#local-tool-material)
5. [Stable standards and draft watch](#stable-standards-and-draft-watch)
6. [Foundations and engineering methods](#foundations-and-engineering-methods)
7. [Patterns, reuse, alignment, quality, and governance](#patterns-reuse-alignment-quality-and-governance)
8. [Tools and implementations](#tools-and-implementations)
9. [Agent Skills host compatibility](#agent-skills-host-compatibility)
10. [Coverage limits and update protocol](#coverage-limits-and-update-protocol)

## How to use evidence

Prefer evidence in this order, while respecting the project's approved requirements and applicable law:

1. normative standards and the target domain's authoritative definitions;
2. original method papers and official project documentation;
3. peer-reviewed comparisons, experiments, and surveys;
4. books that synthesize the field;
5. tool blogs and community experience.

Classify claims before adopting them:

- **normative**: a standard or formally adopted policy;
- **experimental**: tested with disclosed tasks, samples, metrics, and limitations;
- **case evidence**: useful in its context but not automatically generalizable;
- **proposal/prototype**: a design candidate, not a quality guarantee;
- **synthesis**: a reasoned consolidation that must retain its source trail.

Never promote a source's assertion directly into a domain axiom. Record its authority, scope, interpretation, conflicts, and approving Owner. Historical material supplies durable principles; current official documentation governs contemporary command syntax and tool behavior.

## Local books

Every machine-readable page was included in extraction and semantic review. Blank or decorative pages were identified rather than counted as substantive text; at least one representative visual page per volume was checked.

| Research input | Pages | Contribution to Ontotect |
|---|---:|---|
| C. Maria Keet, *An Introduction to Ontology Engineering*, v1.5 | 306 | Lifecycle, ontological commitments, OntoClean, relations and mereology, profiles, patterns, modules, evaluation |
| *Knowledge Engineering and Knowledge Management: Ontologies and the Semantic Web*, EKAW 2002 proceedings | 424 | All 35 papers covered; semantic commitment, DOLCE, roles, mappings, extraction, integration, change and versioning |
| Noy & McGuinness, *Ontology Development 101* | 25 | Iterative seven-step foundation, scope, reuse, taxonomy, properties, facets, instances, practical heuristics |
| Allemang, Hendler & Gandon, *Semantic Web for the Working Ontologist* | 512 | RDF/RDFS/OWL semantics, SPARQL, SHACL, OWA/no UNA, restrictions, imports, patterns, modeling failures |
| *Towards the Semantic Web: Ontology-Driven Knowledge Management* | 308 | OTK/OTKM lifecycle, ORSD and CQs, organizational feasibility, evaluation, application integration, evolution |

Local filenames contained third-party distribution-site markers for some books. Those filenames are not an endorsement or provenance claim. Ontotect includes only original synthesis and short conventional names; it does not redistribute the PDFs or extracted text. Public citations should point to authors, publishers, standards bodies, or official institutional copies.

## Local method and application papers

All 17 PDFs and all 267 pages were read. The first, middle, and last page of each file (51 pages total) were also rendered for visual confirmation of headings, method diagrams, results, and references.

| File / identified work | Pages | Evidence used and boundary |
|---|---:|---|
| `ADOBA.pdf` — Abdallah & Fan, ontology-based applications for aircraft-maintenance records | 7 | Co-development of ontology and application; a limited case/proposal, not universal proof |
| `AMOD.pdf` — Abdelghany et al., agile ontology development | 12 | Owner/engineer/user roles and sprint activities; small evaluation and partial process coverage |
| `Cognite01.pdf` — design ontology for cognitive-thread traceability | 25 | Model/task/stakeholder/permission traceability; case counts contain an internal inconsistency |
| `Cognite02.pdf` — ontology and cognitive outcomes | 19 | Distinguishes belief, confidence, warrant, and knowledge; conceptual proposal |
| `COntE.pdf` — continuous ontology engineering | 8 | CI/deployment/evaluation/configuration as continuous concerns; work-in-progress framework |
| `DASH.pdf` — agile knowledge-graph system | 5 | Separates demands, algorithms, data resources, and humans; platform demonstration does not prove semantics |
| `InPro.pdf` — industrial-production workflow ontology | 16 | Module sprints, reasoner/expert/CQ/SPARQL evaluation; domain case without gold standard |
| `KM.pdf` — AI-KM agent skills and ontology-driven modeling | 6 | LLM extraction and planning as candidate acquisition; insufficient as full engineering evidence |
| `MOMo-onto01.pdf` — Commonsense Ontology Micropatterns | 10 | LLM-generated micropattern candidates plus human curation; exposes duplication and modeling errors |
| `MOMo-onto02.pdf` — MoMo model-mapping/transformation ontology | 6 | Operation taxonomy for mapping, transformation, migration, and refactoring; prototype |
| `MOMo-onto03.pdf` — Modular Ontology Modeling | 31 | Diagram-first, modules, patterns, late OWL, spanning axioms; controlled tool study has a small sample |
| `SAMOD.pdf` — Simplified Agile Methodology for Ontology Development | 15 | Scenario/CQ/glossary/TBox/ABox/query test case and iterative regression; small evaluation |
| `Scrum-onto01.pdf` — Scrum reference ontology and application integration | 18 | Reference/operational/application separation and explicit mapping; single-organization case |
| `Scrum-onto02.pdf` — ScrumOntoBDD | 45 | User stories and executable behavior acceptance; limited action-research validation |
| `Scrum-onto03.pdf` — ontology-based multi-agent Scrum effort estimation | 13 | Approval and knowledge-maintenance roles; prediction result is not ontology-quality evidence |
| `Scrum-onto04.pdf` — cooperative domain-ontology evolution | 9 | Integration team, shared baseline, conflict and propagation governance; uncontrolled case claims |
| `YAMO.pdf` — large-scale faceted ontology construction | 22 | Facet analysis and terminology normalization; evaluation has a denominator-selection caveat |

These papers support route selection rather than a single mandatory methodology: METHONTOLOGY/SABiO for lifecycle structure; SAMOD/TDD for small test units; MOMo/eXtreme Design for modules and patterns; NeOn/DILIGENT for reuse and distributed collaboration; evolution methods for controlled change.

## Local tool material

All seven PDFs and all 203 pages were read. Eight key visual pages and three pages without extractable text were visually checked.

| Research input | Pages | Durable contribution and limitation |
|---|---:|---|
| `tools/NeOn.pdf` | 18 | ORSD, purpose, scope, users, uses, CQs, requirement validation and prioritization; old UI is not current guidance |
| `tools/ODK/ODK01.pdf` | 19 | Containerized reproducible build architecture, source/release separation, templates, imports, tests, documentation |
| `tools/ODK/ODK02.pdf` | 39 | Term IDs, import/deprecation/merge/release workflows; old release, branch, CI, and UI details were not copied |
| `tools/Protégé/Protégé01.pdf` | 77 | OWL authoring, restrictions, reasoning, DL Query, unsatisfiable classes, explanations, catalogs; historical UI |
| `tools/Protégé/Protégé02.pdf` | 14 | Replayable term selection and module evaluation from a research plugin; small study |
| `tools/ROBOT/ROBOT01.pdf` | 2 | Command chaining and automated OWL workflows; current official docs govern options |
| `tools/ROBOT/ROBOT02.pdf` | 34 | OMG Robotic Service Ontology beta draft—not ROBOT CLI documentation; used only as a cross-artifact consistency case |

All 29 files had usable text layers and were processed with page/source boundaries. Visual sampling was used for diagrams and non-text pages; it was not a claim of pixel-by-pixel comparison of every page. Tool commands appearing in the research corpus were checked against current official documentation before inclusion. Reference commands remain recipes until executed in a target project.

## Stable standards and draft watch

Use published Recommendations as the default baseline. Draft features require an explicit need, implementation support, portability tests, and a disclosed compatibility risk.

| Area | Default stable baseline | Status watch at 2026-08-07 |
|---|---|---|
| RDF model and semantics | [RDF 1.1 Concepts](https://www.w3.org/TR/rdf11-concepts/), [RDF 1.1 Semantics](https://www.w3.org/TR/rdf11-mt/), [RDF Schema 1.1](https://www.w3.org/TR/rdf-schema/) | [RDF 1.2 Concepts](https://www.w3.org/TR/rdf12-concepts/) and [RDF 1.2 Semantics](https://www.w3.org/TR/rdf12-semantics/) were Candidate Recommendation Snapshots |
| RDF syntax | [Turtle 1.1](https://www.w3.org/TR/turtle/), [RDF/XML 1.1](https://www.w3.org/TR/rdf-syntax-grammar/), [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/) | RDF 1.2 syntax work must be treated according to each document's stated status |
| OWL | [OWL 2 Overview](https://www.w3.org/TR/owl2-overview/), [Structural Specification](https://www.w3.org/TR/owl2-syntax/), [Direct Semantics](https://www.w3.org/TR/owl2-direct-semantics/), [Profiles](https://www.w3.org/TR/owl2-profiles/), [Conformance](https://www.w3.org/TR/owl2-conformance/) | Do not present editor extensions or RDF 1.2 patterns as OWL 2 Direct Semantics without proof |
| SPARQL | [SPARQL 1.1 Query](https://www.w3.org/TR/sparql11-query/) and [Update](https://www.w3.org/TR/sparql11-update/) | [SPARQL 1.2 Query](https://www.w3.org/TR/sparql12-query/) was a Working Draft |
| Shapes | [SHACL 2017 Recommendation](https://www.w3.org/TR/shacl/) | [SHACL 1.2 Core](https://www.w3.org/TR/shacl12-core/) and [SPARQL Extensions](https://www.w3.org/TR/shacl12-sparql/) were Working Drafts |
| Knowledge organization | [SKOS Reference](https://www.w3.org/TR/skos-reference/) | Project rules are still required before translating SKOS relations into OWL axioms |
| Provenance | [PROV-O](https://www.w3.org/TR/prov-o/) | Named graphs and statement-level provenance require a project-specific semantic contract |

The standard status is intentionally not “version pinning.” It prevents a draft feature from being silently represented as a stable interoperable contract.

## Foundations and engineering methods

### Definitions and ontological analysis

- [Gruber, *A Translation Approach to Portable Ontology Specifications*](https://doi.org/10.1006/knac.1993.1008)
- [Stanford Ontology Development 101](https://protege.stanford.edu/publications/ontology_development/ontology101-noy-mcguinness.html)
- [University of Toronto competency-question method](https://eil.mie.utoronto.ca/theory/enterprise-modelling/entmethod/)
- [Guarino, formal ontology and information systems](https://www.loa.istc.cnr.it/wp-content/uploads/2020/03/FOIS98.pdf)
- [Guarino & Welty, OntoClean](https://www.loa.istc.cnr.it/old/Papers/GuarinoWeltyOntoCleanv3.pdf)
- [DOLCE project](https://www.loa.istc.cnr.it/index.php/dolce/)
- [ISO/IEC 21838-2:2021, Basic Formal Ontology](https://www.iso.org/standard/74572.html) and [BFO 2020 artifacts](https://bfo-ontology.github.io/BFO-2020/)

OntoClean, DOLCE, BFO, and other foundations support disciplined analysis but embody choices. Compare fit and record commitments; do not combine upper ontologies mechanically or declare one universally optimal.

### Lifecycle and agile methods

- [METHONTOLOGY original paper](https://aaai.org/papers/0005-ss97-06-005-methontology-from-ontological-art-towards-ontological-engineering/)
- [NeOn methodology deliverables](https://research-archive.stem.open.ac.uk/neon/deliverables/)
- [On-To-Knowledge methodology chapter](https://doi.org/10.1007/978-3-540-24750-0_6)
- [eXtreme Design original paper](https://ceur-ws.org/Vol-516/pap21.pdf)
- [SAMOD primary method](https://essepuntato.it/papers/samod-owled2016.html)
- [Test-Driven Development of Ontologies](https://doi.org/10.1007/978-3-319-34129-3_39)
- [SABiO](https://ceur-ws.org/Vol-1301/ontocomodise2014_2.pdf)
- [Linked Open Terms methodology](https://lot.linkeddata.es/)
- [DILIGENT institutional record](https://publikationen.bibliothek.kit.edu/1000018389)

No comparative evidence establishes one method as best in every domain. Ontotect therefore fixes required artifacts and gates, then routes the work according to task size, reuse, collaboration, application coupling, and risk.

### Evolution and change

- [User-Driven Ontology Evolution Management](https://www.cs.ox.ac.uk/boris.motik/pubs/smms02userdriven.pdf)
- [Ontology Change: Classification and Survey](https://users.ics.forth.gr/~fgeo/files/KER08.pdf)
- [Ontology evolution: a process-centric survey](https://doi.org/10.1017/S0269888913000349)
- [Ontology versioning and management](https://pmc.ncbi.nlm.nih.gov/articles/PMC516243/)
- [PROMPT merging and alignment](https://cdn.aaai.org/AAAI/2000/AAAI00-069.pdf)

These sources support capture -> representation -> impact -> atomic implementation -> propagation -> validation, plus an explicit distinction among text, asserted structure, inferred semantics, and operational impact.

## Patterns, reuse, alignment, quality, and governance

### Patterns, modules, and mappings

- [Ontology Design Patterns Association](https://odpa.github.io/) and [ODP portal](https://ontologydesignpatterns.org/wiki/Main_Page)
- [W3C note on n-ary relations](https://www.w3.org/TR/swbp-n-aryRelations/)
- [Modular Reuse of Ontologies](https://ora.ox.ac.uk/objects/uuid%3Ae5c268c0-ca7c-4718-ad81-fd4e35f4d8b6)
- [Just the Right Amount: Extracting Modules](https://research.manchester.ac.uk/en/publications/just-the-right-amount-extracting-modules-from-ontologies/)
- [Ontology atomic decomposition](https://staff.cs.manchester.ac.uk/~sattler/publications/IJCAI2011.pdf)
- [SSSOM specification](https://mapping-commons.github.io/sssom/) and [primary paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC9216545/)
- [Ontology Alignment Evaluation Initiative](https://oaei.ontologymatching.org/)

A pattern, module, or mapping remains a candidate until semantic fit, dependencies, provenance, protected entailments, competency questions, and domain review pass. Lexical similarity never proves equivalence or identity.

### Evaluation and reporting

- [Ontology evaluation survey by Brank et al.](https://aile3.ijs.si/dunja/SiKDD2005/Papers/BrankEvaluationSiKDD2005.pdf)
- [OOPS! research record](https://oa.upm.es/35873/) and [current pitfall catalogue](https://oops.linkeddata.es/catalogue.jsp)
- [OQuaRE research record](https://research.manchester.ac.uk/en/publications/oquare-a-square-based-approach-for-evaluating-the-quality-of-onto/)
- [FOCA evaluation method](https://arxiv.org/abs/1612.03353)
- [MIRO reporting guidelines](https://doi.org/10.1186/s13326-017-0172-7)

Metric and pitfall results locate review targets. They do not replace requirements, logic, domain truth, application testing, or governance evidence.

### Governance and FAIR practice

- [OBO Foundry principles](https://obofoundry.org/principles/fp-000-summary.html), [development guidelines](https://obofoundry.org/docs/DevelopmentGuidelines.html), and [dashboard](https://dashboard.obofoundry.org/)
- [OBO Relation Ontology](https://oborel.github.io/)
- [FAIR Guiding Principles](https://doi.org/10.1038/sdata.2016.18)
- [Ten Simple Rules for Making a Vocabulary FAIR](https://pmc.ncbi.nlm.nih.gov/articles/PMC8238180/)
- [W3C vocabulary-publication recipes](https://www.w3.org/TR/swbp-vocab-pub/)
- [DCAT 3](https://www.w3.org/TR/vocab-dcat-3/)

OBO Foundry is a mature community model, especially useful for open scientific ontologies, not an automatic rulebook for every private ontology. Tailor governance while preserving authority, scope, identifiers, definitions, change notification, maintenance, and term stability.

### LLM-assisted ontology work

- [LLMs4OL 2024 proceedings](https://www.tib-op.org/ojs/index.php/ocp/issue/view/169)
- [Ontology Generation using Large Language Models](https://arxiv.org/abs/2503.05388)
- [LLMs for competency-question retrofitting](https://doi.org/10.1609/aaaiss.v4i1.31793)
- [CQ4OE benchmark](https://oeg-upm.github.io/cq4oe-benchmark/leaderboard/index.html)
- [Benchmark for LLM-generated ontologies](https://www.eurecom.fr/en/publication/7945)

LLMs can propose terms, CQs, patterns, mappings, axioms, queries, tests, documentation, and repairs. They do not supply domain authority. Preserve provenance and require deterministic checks plus authorized human decisions for consequential semantics.

## Tools and implementations

- [Protégé official documentation](https://protegeproject.github.io/protege/)
- [ROBOT official documentation](https://robot.obolibrary.org/)
- [Ontology Development Kit](https://incatools.github.io/ontology-development-kit/)
- [OWLAPI](https://owlcs.github.io/owlapi/)
- [Apache Jena](https://jena.apache.org/documentation/) and [Jena SHACL](https://jena.apache.org/documentation/shacl/)
- [Eclipse RDF4J](https://rdf4j.org/documentation/) and [RDF4J SHACL](https://rdf4j.org/documentation/programming/shacl/)
- [TopBraid SHACL API](https://github.com/TopQuadrant/shacl)
- [pySHACL](https://github.com/RDFLib/pySHACL)
- [Ontop](https://ontop-vkg.org/guide/)
- [WIDOCO](https://dgarijo.github.io/Widoco/)
- [OOPS!](https://oops.linkeddata.es/)
- [NeOn Toolkit archive](https://research-archive.stem.open.ac.uk/neon-toolkit/)

Read [tools-and-automation.md](tools-and-automation.md) for responsibility boundaries and verified command forms. Actual results remain `unverified` until run against the target artifacts with a disclosed execution contract.

## Agent Skills host compatibility

Ontotect follows the open Agent Skills directory model: a `SKILL.md` front door plus relative `references/`, `assets/`, `scripts/`, and optional host metadata. Compatibility design was checked against:

- [Agent Skills specification](https://github.com/agentskills/agentskills)
- virgiliojr94, [*book-to-skill*](https://github.com/virgiliojr94/book-to-skill) (computer software), used as a construction, generated-skill scanning, and static host-lens reference.
- [Codex skills documentation](https://developers.openai.com/codex/skills)
- [Codex skill creator sample](https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md)
- [Claude Code skills documentation](https://code.claude.com/docs/en/slash-commands)
- [OpenCode skills documentation](https://opencode.ai/docs/skills/)
- [Kilo Code skills documentation](https://kilo.ai/docs/customize/skills)
- [Cursor Agent Skills announcement](https://cursor.com/changelog/2-4)

### npm distribution

- [npm `package.json` documentation](https://docs.npmjs.com/cli/configuring-npm/package-json/) for `name`, `version`, `license`, `files`, and `bin` semantics.
- [npm `npx` documentation](https://docs.npmjs.com/cli/commands/npx/) for running a package binary locally or after registry acquisition.
- [npm pack documentation](https://docs.npmjs.com/cli/pack/) for `--dry-run`, JSON reporting, and tarball inspection.
- The initial public registry lookup for the superseded unscoped name `ontotect` returned `E404` on 2026-08-07.
- After ADR 0003 selected the organization scope, registry lookup for `@moonweave-ai/ontotect` also returned `E404`; npm authentication reported that the operator is an owner of the `moonweave-ai` organization with read-write access to its existing package. These are preflight observations, not publication or permanent reservation evidence.
- Post-release verification on 2026-08-07 confirmed `@moonweave-ai/ontotect@0.1.0` as a public MIT package with `latest` set to `0.1.0`, anonymous registry access, organization read-write access, successful public npx help, and project-scoped installation into isolated Cursor, Codex, Kilo, OpenCode, and Claude Code layouts. Live-host loading was not exercised.

Host discovery paths and portability tests are recorded in [agent-compatibility.md](agent-compatibility.md). `agents/openai.yaml` is optional Codex/OpenAI UI metadata and does not control the portable workflow.

## Coverage limits and update protocol

The following claims would be misleading and must not be made:

- that every Web page about ontology engineering has been read;
- that a historical method or old screenshot describes current tool behavior;
- that a framework proposal, single case, or small usability study proves universal superiority;
- that a reasoner, SHACL engine, CQ suite, linter, metric, or expert score alone proves total correctness;
- that source text settles a domain identity, role, time, part-whole, legal, scientific, or governance dispute without an authorized decision;
- that commands documented here have passed for a target ontology when they were not run.

For a future update:

1. identify the changed standard, method, tool, domain, or host question;
2. search the standards body, official project, original authors, and primary literature;
3. record publication/status date and whether the evidence is normative, experimental, case, proposal, or synthesis;
4. compare the new evidence with the current ontology-engineering contract;
5. update the smallest affected reference and any corresponding test/template;
6. validate internal links, scripts, examples, and cross-host discovery again;
7. disclose unresolved implementation or domain questions as `unverified`.
