# Tools and automation

Use tools as independent evidence providers. No editor, reasoner, validator, linter, or documentation generator proves ontology quality by itself.

## Contents

1. [Select the toolchain](#select-the-toolchain)
2. [Use seven independent gates](#use-seven-independent-gates)
3. [Define an execution contract](#define-an-execution-contract)
4. [Organize the repository](#organize-the-repository)
5. [Apply tool-specific rules](#apply-tool-specific-rules)
6. [Run the pipeline](#run-the-pipeline)
7. [Interpret failure safely](#interpret-failure-safely)
8. [Authoritative documentation](#authoritative-documentation)

## Select the toolchain

| Need | Prefer | Do not infer |
|---|---|---|
| Interactive OWL authoring, classification, explanations, DL Query | Protégé plus a reasoner appropriate to the ontology profile | A file that opens or displays a hierarchy is logically valid |
| Reproducible OWL/OBO builds, reports, SPARQL lint, module extraction, release | ROBOT; add ODK when a standardized long-lived repository and containerized toolchain are useful | Automation replaces requirements, conceptual analysis, or domain review |
| Embedded Java OWL manipulation | OWLAPI | Its structural interfaces constitute a complete engineering workflow |
| RDF datasets, parsing, SPARQL, storage, Java SHACL | Apache Jena or Eclipse RDF4J | Generic RDF handling checks all OWL DL constraints |
| Python SHACL validation | pySHACL | Its optional inference, advanced features, imports, or JS are enabled by default |
| Transaction-time SHACL in an RDF4J repository | RDF4J SHACL Sail | Every SHACL extension behaves identically across engines |
| Java SHACL rules or TopBraid-compatible processing | TopBraid SHACL API | Rule inference and validation are interchangeable operations |
| Virtual knowledge graph over relational data | Ontop, normally with RDFS or OWL 2 QL commitments | Arbitrary OWL DL axioms participate in SPARQL-to-SQL rewriting |
| Human-readable ontology publication | WIDOCO | Generated documentation proves semantic or domain correctness |
| Heuristic pitfall discovery | OOPS! or comparable scanners | No reported pitfall means the ontology is correct |
| Historical networked-ontology methods | NeOn methodology | The archived NeOn Toolkit is the default current runtime |

Choose for the deployed environment. If production and CI use different parsers, reasoners, or SHACL engines, create portability fixtures and compare actual behavior.

## Use seven independent gates

| Gate | Question | Typical evidence |
|---|---|---|
| G1 Parse and IRI | Do all source, shape, fixture, and release files parse strictly, and do imports resolve? | Parser reports from the target ecosystem; complete import-resolution record |
| G2 Profile and logic | Is the ontology in the target profile, consistent, coherent, and free of forbidden equivalences? | Profile report; named reasoner, import closure, unsatisfiable-class and equivalence results |
| G3 Structural quality | Are identifiers, labels, definitions, axioms, and known pitfalls acceptable? | ROBOT report/verify, local audit, and human interpretation at entity/axiom level |
| G4 Graph constraints | Do positive and negative data fixtures behave as intended under the declared SHACL regime? | Complete SHACL validation report, engine and options, fixture outcomes |
| G5 Competency questions | Does the model answer its intended information needs? | CQ manifest plus deterministic SPARQL, DL-query, or entailment expectations |
| G6 Change regression | Are asserted and behavioral changes understood and within budget? | Text diff, RDF/axiom diff, inferred hierarchy/entailment diff, CQ and SHACL regression |
| G7 Release integrity | Do generated distributions, metadata, imports, documentation, and links agree? | Reparsed and retested release artifacts, documentation checks, human approval |

Normally run G1 -> G2 -> G3/G4/G5 -> G6 -> G7. An early blocker prevents a release claim, but independent diagnostics may continue when they cannot produce a misleading conclusion.

## Define an execution contract

Record and echo the following for every automated operation:

- exact ontology, data, shapes, query, mapping, and baseline inputs;
- actual syntax and base IRI, not just filename extensions;
- ontology catalog, import closure, and offline/online resolution policy;
- default graph, named graphs, or graph union;
- target OWL profile, reasoner, reasoner settings, and materialization policy;
- SHACL engine, entailment regime, Meta-SHACL/Advanced/SPARQL/JS options, severity threshold, focus-node selection, and whether the report is truncated;
- timeout, memory boundary, output files, exit status, and tool limitations.

Without this contract, statements such as “consistent,” “conforms,” or “query passed” are not reproducible. Mark a planned but unexecuted command `unverified`.

## Organize the repository

Separate maintainable sources from generated artifacts:

```text
ontology-project/
  src/
    ontology/       # author-maintained source of truth
    modules/        # project modules
    imports/        # reproducibly extracted upstream modules
    mappings/       # bridge/alignment artifacts
    templates/      # tabular or pattern inputs
  config/           # prefix, catalog, import and build policy
  shapes/
  queries/
    competency/
    lint/
  tests/
    fixtures/positive/
    fixtures/negative/
    expected/
  build/            # generated intermediate artifacts
  reports/          # machine and human reports
  release/          # generated distributions
  docs/             # generated publication
```

Do not edit `build/`, `release/`, or generated documentation to fix a source problem. Keep local bridge axioms separate from upstream ontology content.

## Apply tool-specific rules

### Protégé and reasoners

- Inspect ontology IRI/version IRI, imports, entity IRI, label, definition, provenance, and logical axioms together.
- Distinguish asserted from inferred information. State the active ontology, import closure, selected reasoner, and last synchronization/classification state.
- Treat `SubClassOf` as a necessary-condition assertion; use `EquivalentClasses` only when necessary-and-sufficient meaning is justified.
- Never exchange `some` and `only` by linguistic intuition.
- For an inconsistency or unsatisfiable class, obtain an explanation/justification, locate the smallest causal axiom set, fix the semantically wrong commitment, restart or resynchronize the reasoner, and rerun the suite.
- A structural reasoner is useful for navigation but is not evidence of complete OWL DL reasoning.

### ROBOT and ODK

ROBOT is the default command-line choice for many OWL/OBO workflows. Confirm every option with the installed command's help and current official documentation.

- `reason`: record reasoner and profile; fail on inconsistency, forbidden unsatisfiable classes, and unexpected equivalence according to project policy.
- `report`: a configured quality report; it does not replace reasoning, SHACL, CQs, or human review. Large inputs and report limits can affect completeness.
- `verify`: SPARQL `SELECT` queries identify violations; returned rows normally mean failure. This is the opposite convention from many competency queries.
- `diff`: compare OWL axioms, not serialization layout. Still run behavioral regression because asserted change and semantic impact differ.
- `merge`: make import-closure and ontology-annotation handling explicit; check ontology metadata after merging.
- `extract`: record source, seed signature, BOT/TOP/STAR/MIREOT method, import/individual/annotation policy, and must-preserve entailments.
- `template`: fail fast on malformed cells; do not use force merely to keep CI green.
- `convert`: assume a conversion may be lossy until target artifacts reparse and pass logic, constraint, CQ, and diff checks.

Use ODK when its conventions, shared Make targets, containerized tools, import refresh, and release layouts fit the project. Treat its current project configuration and official commands as authoritative; do not copy old tutorial screenshots or legacy CI settings. Local and CI checks should invoke the same project targets.

### Jena, RDF4J, and OWLAPI

- Use Jena RIOT or RDF4J Rio for strict RDF parsing; keep XML external-entity protections enabled.
- Use ARQ/SPARQL with explicit dataset scope. `SELECT` results are unordered unless the query uses `ORDER BY`; compare sets or multisets intentionally.
- Jena SHACL supports Core and SPARQL constraints; RDF4J SHACL is especially useful as a transaction gate. Do not assume graph scope or extension parity.
- Use RDF graph isomorphism for blank-node-heavy reports and fixtures, not text equality.
- With OWLAPI, explicitly manage IRI mapping, import loading, ontology-manager lifetime, reasoner lifecycle, and round-trip serialization.
- TDB1 and TDB2 are not interchangeable. Validate bulk input before non-transactional or high-throughput loading.

### SHACL engines

- Validate the shapes graph itself when the engine supports Meta-SHACL.
- Give every critical shape a stable IRI, target, path, severity, human message, requirement/CQ trace, a conforming fixture, and a violating fixture.
- Compare `sh:conforms` first and then report content. A negative fixture that passes often exposes a target or graph-scope error.
- pySHACL uses exit 0 for conformant data, 1 for non-conformance, 2 for runtime error, and 3 for an unimplemented feature. Interpret the report and exit status, not debug text fragments.
- Treat SHACL-JS or other executable extensions as code and enable them only in a controlled environment.

### Ontop, WIDOCO, and OOPS!

- For Ontop, validate ontology, mappings, database metadata, datatypes, and credentials separately. Keep secrets out of ontology artifacts and reports. Benchmark the endpoint rather than treating CLI startup as query performance.
- Run WIDOCO only after core gates pass. Check generated metadata, term pages, namespace, version, provenance, license, serialization links, diagrams, and changelog for drift or placeholders.
- Treat OOPS! findings as review prompts. Resolve each against the ontology contract; do not mechanically repair every warning.
- Never upload a private, sensitive, or unreleased ontology to a remote documentation or checking service without explicit authorization.

## Run the pipeline

```text
parse sources, shapes, fixtures
  -> resolve imports/catalog
  -> validate OWL profile
  -> generate imports/templates/modules
  -> reason: consistency, satisfiability, classification, equivalence
  -> structural lint and custom SPARQL violation queries
  -> Meta-SHACL and positive/negative SHACL fixtures
  -> competency queries and entailment/non-entailment regression
  -> text + asserted graph/axiom + behavioral diff
  -> generate required release distributions
  -> reparse and rerun applicable gates on every distribution
  -> generate and inspect documentation
  -> release only after required human review
```

Produce both machine-readable results with stable rule IDs and a human report grouped by blocker, root cause, and minimal safe action. Preserve timeouts, skipped checks, degraded modes, and report truncation; never turn a caught exception into success.

Use `scripts/ontology_audit.py` as an advisory RDF/OWL structure and optional SHACL check. Use `scripts/ontology_diff.py` to compare asserted RDF graphs modulo triple order and blank-node labels. Neither script performs complete OWL reasoning or inferred semantic equivalence.

## Interpret failure safely

| Signal | Check before editing |
|---|---|
| Development import works but CI import fails | Ontology catalog, accidental cache/network access, redirected or missing IRI |
| EL reasoner passes a DL ontology | Profile violations or unsupported constructs; run profile validation and a suitable reasoner |
| OWL is consistent but required data is absent | Open-world semantics; express the operational completeness rule in SHACL |
| SHACL always conforms | Wrong target, focus node, graph scope, inference regime, or missing negative fixture |
| Text diff is huge but behavior appears stable | Prefix/order/blank-node serialization noise; compare canonical graph/axiom and behavior |
| Text diff is small but behavior changed | Imports, equivalence, disjointness, domain/range, cardinality, or property characteristics |
| Module opens but CQ fails | Seed-only acceptance missed required semantic dependencies |
| Converted file exists but axioms disappeared | Lossy target format or permissive conversion option; reparse, diff, reason, and regress |
| Entity merge causes many new equivalences | Combined definitions/restrictions; inspect reasoner explanations and downstream mappings |
| Documentation or pitfall scanner is clean | Their coverage is limited; complete G1-G7 as applicable |

## Authoritative documentation

- [ROBOT documentation](https://robot.obolibrary.org/), including [reason](https://robot.obolibrary.org/reason.html), [report](https://robot.obolibrary.org/report.html), [verify](https://robot.obolibrary.org/verify.html), [diff](https://robot.obolibrary.org/diff.html), and [extract](https://robot.obolibrary.org/extract.html)
- [Ontology Development Kit](https://incatools.github.io/ontology-development-kit/)
- [Protégé documentation](https://protegeproject.github.io/protege/) and [reasoning guide](https://protegeproject.github.io/protege/getting-started/)
- [OWLAPI project](https://owlcs.github.io/owlapi/)
- [Apache Jena tools](https://jena.apache.org/documentation/tools/), [ARQ](https://jena.apache.org/documentation/query/), and [SHACL](https://jena.apache.org/documentation/shacl/)
- [Eclipse RDF4J programming documentation](https://rdf4j.org/documentation/programming/) and [SHACL](https://rdf4j.org/documentation/programming/shacl/)
- [pySHACL](https://github.com/RDFLib/pySHACL) and [TopBraid SHACL API](https://github.com/TopQuadrant/shacl)
- [Ontop guide](https://ontop-vkg.org/guide/), [WIDOCO](https://dgarijo.github.io/Widoco/), and [OOPS! catalogue](https://oops.linkeddata.es/catalogue.jsp)
- [W3C OWL 2 Profiles](https://www.w3.org/TR/owl2-profiles/), [SPARQL 1.1 Query](https://www.w3.org/TR/sparql11-query/), and [SHACL Recommendation](https://www.w3.org/TR/shacl/)

Consult [sources.md](sources.md) for the evidence register and standards status.
