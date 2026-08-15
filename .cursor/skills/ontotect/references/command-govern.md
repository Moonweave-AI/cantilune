# `govern` command

Use `govern` for authority, ownership, change control, persistent identifiers,
version policy, deprecation, provenance, licensing, maintenance, and lifecycle
operation. It may create project governance artifacts but does not publish a
release unless publication is explicitly authorized.

## Entry

Identify the ontology community, Owner, DRI, domain authority, ontology
engineer, consumer representative, release authority, source of truth, and
current lifecycle state. When authority is absent, produce a draft and mark
approval `unverified`.

## Procedure

1. Define proposal, review, decision, implementation, release, notification,
   appeal, deprecation, retirement, and succession paths.
2. Define stable ontology/term/version IRI behavior without recycling IRIs.
3. Classify changes by semantic impact: patch-compatible, additive,
   deprecating, or breaking.
4. Define provenance, source, license, import/module, mapping, generated-artifact,
   and evidence records.
5. Define migration, consumer notification, maintenance, PURL, issue, term
   request, accepted-exception, and orphaned-project procedures.
6. Couple policies to machine-checkable controls where practical while keeping
   domain-semantic decisions under human authority.

## Exit

Return decision rights, policies, canonical artifacts, unresolved approvals,
maintenance cadence, and the evidence required to enter `release`. Do not claim
FAIR, OBO Foundry, regulatory, or organizational compliance without the actual
scope-specific review.
