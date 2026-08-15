# `release` command

Use `release` for Stage G: verify a candidate, classify semantic change,
prepare migration and a coordinated distribution set, and obtain a release
disposition. Preparing a release does not itself authorize remote publication.

## Entry

Require a named candidate and baseline, intended consumers, change proposal or
scope, evidence target, release authority, and distribution policy. If Stage F
evidence is incomplete, perform a preflight and apply the deterministic gate
precedence in [command-contract.md](command-contract.md): an unexcepted
contract failure yields `revise`; a known missing prerequisite yields
`blocked`; otherwise missing or uninterpretable evidence yields `unverified`.
Never choose among them only because one sounds more cautious.

## Procedure

1. Classify changes using semantics and consumer impact, not line count.
2. Compare ontology/version IRIs, imports, public terms, logical axioms,
   inferred hierarchy, CQs, shapes, mappings, documentation, and operational
   behavior as applicable.
3. Prepare deprecation and migrations without recycling identifiers.
4. Assemble canonical source, distributions/modules, shapes, queries, fixtures,
   mappings, documentation, metadata/license/provenance, semantic diff, change
   log, migrations, and evidence manifest.
5. Reparse and rerun applicable gates on distributed artifacts.
6. Record domain, engineering, consumer, and release-authority decisions.

## Exit

Return `pass`, `pass-with-actions`, `revise`, `blocked`, or `unverified`, plus
the exact release set, semantic impact, consumer action, approvals, unresolved
items, and maintenance owner. A valid exception may support
`pass-with-actions` only when its underlying result remains visible and release
policy plus release authority permit it. Only perform a remote publish step
when the user has explicitly authorized its destination and scope.
