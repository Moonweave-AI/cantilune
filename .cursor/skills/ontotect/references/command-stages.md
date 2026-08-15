# Lifecycle stage commands

Use `stage <stage>` or the direct alias to work on exactly one lifecycle gate.
Report the next gate without entering it unless the user requested a range.

## `charter` — Stage A

Entry: an ontology idea, problem, integration, or change request. Produce the
project brief, roles, intended use, scope/non-goals, numbered competency
questions, representative positive/negative cases, constraints, and acceptance
matrix. Gate A passes when every must-have CQ has an owner and observable
acceptance method.

## `reuse` — Stage B

Entry: an approved scope and CQs. Produce an attributable candidate inventory
and decisions among direct reuse, import, module extraction, specialization,
mapping, or local definition. Gate B passes when semantic fit, commitments,
dependencies, governance, provenance, and license are understood.

## `conceptualize` — Stage C

Entry: scoped requirements and reuse context. Produce term/relation inventories,
definitions, examples/counterexamples, categories, identity, rigidity,
dependence, time, part-whole, qualified relations, and unresolved decisions.
Gate C passes when reviewers can classify representative cases and answer CQs
informally without syntax accidents.

## `formalize` — Stage D

Entry: reviewed conceptual commitments. Produce the SKOS/RDFS/OWL/SHACL/SPARQL
responsibility split, profile and inference assumptions, IRI/import/module,
annotation/provenance, serialization, mapping, and axiom plan. Gate D passes
when every strong axiom traces to evidence and its intended/unintended
consequences are understood.

## `implement` — Stage E

Entry: approved formal architecture. Produce one or more CQ-sized vertical
slices with public annotations, axioms, shapes, SPARQL, positive/negative and
boundary fixtures, and an iteration record. Gate E passes when the slice's CQs
work and essential semantics have regressions.

## `verify` — Stage F

Entry: named artifacts and an explicit validation contract. Execute the
applicable independent evidence layers and report each separately. Gate F
passes only when required checks succeeded, accepted exceptions have authority,
their underlying results and durable decisions remain visible, and domain
meaning has been reviewed. Missing complete OWL reasoning remains
`unverified` even if the bundled advisory audit is green.

## `release` — Stage G

Entry: a named candidate with Stage F evidence. Use the same contract as the
top-level [`release`](command-release.md) command. Gate G passes when the
coordinated release set, semantic impact, migrations, approvals, and maintenance
ownership are complete.

Direct stage aliases never bypass prerequisites. A missing prior gate yields a
visible assumption, `blocked`, `unverified`, or a deliberately bounded
prototype—not an implicit pass.
