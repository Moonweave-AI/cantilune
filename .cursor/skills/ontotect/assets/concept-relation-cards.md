# Concept and relation cards

Use cards for public or semantically consequential terms. Do not fill them mechanically for every annotation-only term.

## Concept card

- Stable card/term ID:
- Preferred label and language:
- Candidate IRI:
- Category: class | individual | role | state | process/event | quality | information entity | value/SKOS concept | other
- Intensional definition:
- Distinguishing criterion from parent and siblings:
- Positive examples:
- Counterexamples and boundary cases:
- Candidate parent(s) and `is-a` test:
- Necessary conditions:
- Sufficient conditions, if justified:
- Identity criterion:
- Rigidity / role / state analysis:
- Unity and dependence:
- Temporal, spatial, jurisdictional, or contextual scope:
- Synonyms, ambiguous labels, and prohibited labels:
- Source/evidence and authority:
- Related CQs and tests:
- Reuse/import/mapping decision:
- Owner, status, and unresolved questions:

## Relation card

- Stable card/property ID:
- Human reading and argument order:
- Candidate IRI and inverse:
- Domain and range meaning in prose:
- Positive examples:
- Counterexamples and boundary cases:
- Relation family: taxonomic | part-whole | participation | constitution | location | membership | information | other
- Temporal/contextual scope:
- Need for a qualified/n-ary relation node:
- Symmetric / asymmetric:
- Reflexive / irreflexive:
- Transitive, and valid composition boundaries:
- Functional / inverse-functional, including uniqueness scope:
- Candidate subproperty, inverse, or property-chain axioms:
- Cardinality: domain semantics in OWL and/or operational rule in SHACL:
- Provenance/evidence/confidence needs:
- Related CQs, shapes, and queries:
- Source/evidence and authority:
- Owner, status, and unresolved questions:

## Cross-check before formalization

- Every subclass edge passes “every A is a B,” not merely “A relates to B.”
- Role/state classifications can be gained or lost without changing bearer identity.
- Part, member, material, location, participation, and constitution are not collapsed.
- Property characteristics are universal in the declared scope and survive counterexamples.
- `owl:sameAs`, equivalence, disjointness, and uniqueness have evidence stronger than lexical similarity.
- OWL axioms and SHACL rules are assigned to their intended semantic versus operational layers.
