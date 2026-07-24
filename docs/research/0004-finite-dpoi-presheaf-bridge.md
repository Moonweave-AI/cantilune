# Finite DPOI–presheaf bridge: proved fragment and stopping boundary

Status: implementation/review evidence; not a QA-L4 approval  
Date: 2026-07-23  
Risk / quality / maturity: S2 / QA-L4 target / Pre-FCP-M1  
Decision authority: RFC-0002 and ADR-0001

> **Historical-scope note:** this file records the first fixed-host thin
> inclusion/`InterfaceLocal` bridge. Research logs 0005 and 0006 supersede that
> limitation with arbitrary-monic presheaf gluing/complement/concurrency,
> finite positional complement/result/residual closure, and functorial
> active-support normalization that sends globally injective concrete matches
> to typed-slice monomorphisms. They do not prove a whole-slice equivalence or
> an unconditional intrinsic M-adhesive theorem.

## Implemented theorem surface

`formal/Cantilune/Core/FinitePresheafDPOI.lean` constructs:

- a six-sort incidence category and typed presheaf slice;
- finite active-support views of one certified typed open hypergraph;
- the thin category of inclusions between those views;
- a faithful functor from that fixed-host inclusion category into the slice;
- componentwise intersection/union pushouts in `Type`;
- their pointwise lift to incidence presheaves and reflection into the typed
  slice;
- a contextual identity-match DPO witness for every executable inclusion
  event; and
- for every event satisfying `InterfaceLocal`, a selected
  `L ← K → R` rule and two genuine, generally nonidentity DPO pushout squares.

The executable complement is constructed by finite deletion under the
identification, dangling, and boundary conditions in `DPOI.AdmissibleRewrite`.
For a fixed executable support, it is equal-unique as a certified graph; this
equality yields an isomorphism of its encoded whole views. Adhesivity is used
only after the pushout squares have been constructed. It is not used as an
existence theorem for pushout complements.

Targeted local verification succeeded for the core file and
`Cantilune.Tests.FinitePresheafDPOI`. The tree remained uncommitted, so this
evidence does not promote a central obligation.

## Independent review result

An independent read-only Agent review accepted the scoped theorem:

> For a fixed certified host, finite active-support views and inclusion
> morphisms embed faithfully into the fixed typed presheaf slice.
> Intersection/union support squares are pushouts there. An
> `InterfaceLocal` executable inclusion event produces both DPO squares.

The review rejected every stronger general-equivalence claim for four
independent reasons.

1. The concrete source/target incidence carriers retain `Fin` port positions,
   but the type graph records only `(generator, object type)`. Repeated ports
   of the same type can therefore be permuted by ambient slice morphisms.
2. The source of `encodingFunctor` is the thin view category for one fixed
   host, not the category of all typed open hypergraphs and general
   structure-preserving morphisms. Its faithfulness does not establish
   fullness, object reflection, essential image, or equivalence.
3. `Contextual.derivation` is a legitimate but degenerate wrapper with rule
   `G ← D → H` and identity match. It does not characterize host-independent
   rules or legal matches.
4. `Local.derivation` proves complement existence only for the selected
   inclusion event plus `InterfaceLocal`. There is no theorem for arbitrary
   monic matches and no categorical concurrency/critical-pair theorem.

## Remaining proof obligations

Before CENTRAL-02/CENTRAL-03 or T2 may be promoted, the theory still needs:

- a positional type graph, such as dependent port types
  `Σ g, Fin (input g).length` and `Σ g, Fin (output g).length`;
- the intended category of typed open hypergraphs, boundaries, and ordered
  incidence-preserving morphisms;
- a full/faithful or essential-image characterization connecting that category
  to the appropriate slice subcategory;
- an explicit `LegalMatch` predicate for arbitrary monic matches;
- complement existence iff the selected gluing/application conditions hold,
  plus uniqueness up to a compatible isomorphism;
- sequential derivations, independence conditions, composite rules, result
  isomorphisms, and the categorical concurrency theorem; and
- the connection from those derivations to the intended DAG and Petri
  projection rule maps.

Accordingly, `dpo_result_unique` and `dpo_concurrency` remain
`partial_scaffold`; RFC-0002 remains Draft, ADR-0001 remains Proposed, and
QA-L4 human review remains pending.
