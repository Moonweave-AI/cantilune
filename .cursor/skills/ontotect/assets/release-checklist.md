# Ontology release checklist

## Authority and scope

- [ ] Owner, DRI, reviewers, and release authority are recorded.
- [ ] Release scope and change classification are approved.
- [ ] Canonical source and generated distributions are distinguishable.
- [ ] Licenses and provenance are documented for reused ontologies, mappings, and data.

## Semantic compatibility

- [ ] Ontology IRI and version IRI follow policy.
- [ ] Existing IRIs have not been recycled for different referents.
- [ ] Additions, deprecations, replacements, and breaking changes are enumerated.
- [ ] Semantic diff covers asserted and inferred changes under the agreed reasoner/profile.
- [ ] Migrations and replacement mappings exist for affected consumers.

## Verification

- [ ] Every check records its underlying result separately from any exception.
- [ ] Every exception records authority, rationale, scope, a durable decision artifact, and review/expiry condition; release policy and release authority permit it.

- [ ] Every distribution parses in its declared format.
- [ ] OWL profile/global restrictions are checked when applicable.
- [ ] Consistency, satisfiability, and classification checks pass or exceptions are approved.
- [ ] Expected entailment and non-entailment tests pass or valid exceptions are recorded.
- [ ] Competency-question SPARQL tests pass or valid exceptions are recorded.
- [ ] SHACL validation passes under the documented entailment regime, or the underlying failure and valid exception remain explicit.
- [ ] Imports, catalog resolution, mappings, and generated modules are reproducible.
- [ ] Documentation, labels, definitions, examples, and deprecations are checked.
- [ ] Domain reviewers approve the meanings affected by this release.
- [ ] Scale/performance checks pass when operational limits apply.

## Release set

- [ ] Source ontology and canonical serialization
- [ ] Required derived serializations or modules
- [ ] Shapes, queries, fixtures, and test results
- [ ] Mapping sets with provenance and confidence/evidence
- [ ] Human-readable documentation
- [ ] Machine-readable metadata, license, creators, dates, and version links
- [ ] Change notes, migration guidance, and deprecation schedule
- [ ] Reproducible build instructions and dependency/import policy

## Publication and maintenance

- [ ] Persistent IRIs resolve to intended artifacts.
- [ ] Previous versions remain available according to policy.
- [ ] Stakeholders receive required advance or release notification.
- [ ] Feedback and issue channels are active.
- [ ] Post-release monitoring, rollback/withdrawal, and next-maintenance ownership are assigned.
