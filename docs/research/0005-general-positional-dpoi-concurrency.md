# General positional DPOI and concurrency: implementation evidence

Status: implementation evidence; not a QA-L4 approval  
Date: 2026-07-23  
Risk / quality / maturity: S2 / QA-L4 target / Pre-FCP-M1  
Decision authority: RFC-0002 and ADR-0001

## Scope

This log supersedes the open technical items in research log 0004 for the
typed-presheaf DPOI bridge. It does not change RFC or ADR status and does not
promote the proof-obligation manifest. Those governance transitions require
the designated independent reviews.

## Mechanically checked additions

### Positional typed open hypergraphs

`formal/Cantilune/Core/FinitePresheafDPOI.lean` now types source and target
incidences by `(generator, Fin port-position)`. Repeated ports of the same
object type therefore remain distinct in the type graph.

`formal/Cantilune/Core/PositionalDPOI.lean` defines all finite positional
typed open hypergraphs for a signature and fixed input/output boundary types.
Its morphisms are all morphisms between the corresponding objects of the
typed incidence-presheaf slice, rather than inclusions inside one host. The
file proves:

- finite carriers for every object, generator, positional incidence, and
  boundary sort;
- a category of these finite open hypergraphs;
- source- and target-position preservation by every morphism;
- a full and faithful encoding into the typed presheaf slice; and
- an equivalence with the encoding functor's categorical essential image.

The theorem intentionally says “essential image,” not “the whole slice.”
An arbitrary slice object need not have exactly one source or target
incidence for every edge/position pair, so equivalence with the unrestricted
slice would be false without an additional well-formedness predicate.

### Arbitrary monic matches and pushout complements

`formal/Cantilune/Core/PresheafComplementDPO.lean` works with any linear rule,
host, and monic match in the typed incidence-presheaf slice. It defines the
deleted elements pointwise and uses the following gluing condition:

> every retained element remains retained under every incidence map.

For monic rule legs and monic matches, the usual identification condition is
automatic; the stated closure condition is the remaining dangling condition.
The file constructs the retained subpresheaf and proves:

- the componentwise deletion square is a pushout in `Type`;
- those pointwise squares lift to the presheaf and typed-slice pushout;
- a pushout complement exists if the gluing condition holds;
- existence of any pushout complement implies the gluing condition;
- hence complement existence iff `LegalMatch`; and
- every arbitrary complement is isomorphic to the canonical retained
  complement, compatibly with both interface and host legs.

No use is made of adhesivity as an existence theorem. Adhesivity supplies
stability and Van Kampen consequences only after a complement square has
been constructed.

### Standard parallel independence and DPO concurrency

`formal/Cantilune/Core/DPOConcurrency.lean` defines parallel independence
only by the two standard factorisations:

- the first left-hand-side match factors through the second complement; and
- the second left-hand-side match factors through the first complement.

The record contains no residual derivation, final result, common object, or
result-isomorphism witness. From those factorisations, the file derives:

1. the pullback of the two retained contexts;
2. embeddings of both rule interfaces into that joint context;
3. by Van Kampen base change, both context-decomposition pushout squares;
4. the standard residual context
   `R₂ ⨿[K₂] D` and residual derivation of rule one after rule two;
5. the symmetric residual context
   `R₁ ⨿[K₁] D` and residual derivation of rule two after rule one;
6. a general reassociation theorem for the residual complement squares;
7. a general interchange theorem for the two iterated result pushouts; and
8. a canonical isomorphism between the two sequential results, compatible
   with both residual context legs and both original right-hand sides.

This is the standard parallel-independence/local-Church--Rosser form of the
DPO concurrency theorem. It is general over the typed presheaf slice and is
not restricted to fixed-host inclusions or identity rules.

## Regression coverage

The following regression modules exercise the new surface:

- `Cantilune.Tests.PositionalDPOI`: two same-typed source positions remain
  distinct; fullness, faithfulness, and positional preservation elaborate.
- `Cantilune.Tests.PresheafComplementDPO`: an arbitrary monic identity match
  exercises legal-match equivalence and compatible complement uniqueness.
- `Cantilune.Tests.DPOConcurrency`: a factorisation-only independent pair
  elaborates both context decompositions, both residual derivations, and the
  final concurrency isomorphism.

The full `lake build` and placeholder audit are recorded in the task handoff,
not asserted here until actually rerun against the final shared tree.

## Exact remaining boundary

The following are not claimed by these files:

- equivalence of well-formed finite hypergraphs with the unrestricted
  presheaf slice;
- infinitary hypergraphs or infinitely supported signatures inside an epoch;
- critical-pair completeness, termination, or confluence for an arbitrary
  rule system;
- compatibility of every product-level DAG/Petri projection rule with this
  general categorical bridge; or
- QA-L4 review, RFC FCP passage, ADR acceptance, or manifest promotion.

The new concurrency theorem proves commutation for a supplied
parallel-independent pair. It does not decide parallel independence for all
possible finite inputs, enumerate critical pairs, or turn local confluence
into global confluence without the usual additional hypotheses.
