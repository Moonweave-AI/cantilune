import Cantilune.Core.PositionalConcurrencyClosure

/-!
# General finite typed-open-hypergraph DPOI theorem

This module collects the categorical statements which are otherwise spread
across the positional encoding, complement closure, pushout closure, and
adhesive concurrency developments.

The category called `FiniteOpenHypergraph` below contains every finite typed
open hypergraph with the prescribed ordered boundary and exact positional
incidence.  It is equivalent to its full, replete essential image in the
adhesive typed-presheaf slice.  The unrestricted slice is intentionally not
used: it also contains infinite and incidence-incomplete presheaves.

For arbitrary morphisms of this category whose ambient images are monic, the
ordinary gluing condition and boundary retention construct a complete DPO
witness.  No inclusion-map or `InterfaceLocal` hypothesis occurs.  For two
parallel-independent such matches, the standard adhesive construction
produces both residual intrinsic witnesses and a canonical commuting result
isomorphism.
-/

noncomputable section

namespace Cantilune.Core.GeneralFiniteOpenDPOI

open CategoryTheory
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Core.PositionalDPOI
open Cantilune.Core.PositionalComplementClosure
open Cantilune.Core.PositionalPushoutClosure
open Cantilune.Core.PositionalPushoutClosure.CanonicalPositionalDPO
open Cantilune.Core.PositionalConcurrencyClosure
open Cantilune.Core.PositionalConcurrencyClosure.CanonicalConcurrency

variable (σ : FinSignature) (inputTypes outputTypes : List σ.Obj)

/-- Every intrinsic finite typed open hypergraph of the stated interface. -/
abbrev FiniteOpenHypergraph :=
  PositionalDPOI.FiniteHypergraph σ inputTypes outputTypes

/-- Its exact full and replete image inside the adhesive presheaf slice. -/
abbrev AdhesiveFiniteImage :=
  (PositionalDPOI.encodingFunctor σ inputTypes outputTypes).EssImageSubcategory

/--
The general categorical bridge for finite, incidence-complete typed open
hypergraphs.  This is a genuine equivalence, not a thin-inclusion encoding.
-/
def finite_open_hypergraph_equivalence :
    FiniteOpenHypergraph σ inputTypes outputTypes ≌
      AdhesiveFiniteImage σ inputTypes outputTypes :=
  PositionalDPOI.equivalenceEssImage σ inputTypes outputTypes

/--
The canonical occurrence of an intrinsic finite graph in the replete
essential image.  Keeping this object public inside the theorem module makes
the unit comparison below state the transport back to the *original*
intrinsic graph, rather than merely to an unspecified preimage.
-/
def canonicalImageObject
    (X : FiniteOpenHypergraph σ inputTypes outputTypes) :
    AdhesiveFiniteImage σ inputTypes outputTypes :=
  ⟨X.encoded, ⟨X, ⟨Iso.refl X.encoded⟩⟩⟩

/--
The inverse-image object selected by the essential-image equivalence is
canonically isomorphic to the original intrinsic finite graph.
-/
noncomputable def finite_image_preimage_iso
    (X : FiniteOpenHypergraph σ inputTypes outputTypes) :
    (finite_open_hypergraph_equivalence σ inputTypes outputTypes).inverse.obj
        (canonicalImageObject σ inputTypes outputTypes X) ≅
      X :=
  ((finite_open_hypergraph_equivalence σ inputTypes outputTypes).unitIso.app X).symm

/--
The inverse equivalence transports an encoded intrinsic arrow back to the
same original arrow, up to the unit isomorphisms at its endpoints.

This is the comparison square used below for the three arrows of every
`FiniteWitnessType`.
-/
@[reassoc]
theorem finite_image_preimage_map_commutes
    {X Y : FiniteOpenHypergraph σ inputTypes outputTypes}
    (f : X ⟶ Y) :
    (finite_open_hypergraph_equivalence σ inputTypes outputTypes).inverse.map
          (ObjectProperty.homMk f :
            canonicalImageObject σ inputTypes outputTypes X ⟶
              canonicalImageObject σ inputTypes outputTypes Y) ≫
        (finite_image_preimage_iso σ inputTypes outputTypes Y).hom =
      (finite_image_preimage_iso σ inputTypes outputTypes X).hom ≫ f := by
  let E := finite_open_hypergraph_equivalence σ inputTypes outputTypes
  change
    E.inverse.map (E.functor.map f) ≫ E.unitInv.app Y =
      E.unitInv.app X ≫ f
  exact E.unitInv.naturality f

section OneStep

variable {σ inputTypes outputTypes}
variable {K L R G : FiniteOpenHypergraph σ inputTypes outputTypes}
variable (left : K ⟶ L) (right : K ⟶ R) (occurrence : L ⟶ G)

/--
Every boundary-retaining legal match whose three participating arrows are
monic in the adhesive image has a complete two-pushout witness back in the
intrinsic finite category.

The occurrence is an arbitrary categorical morphism.  In particular, the
statement has neither a fixed host nor a thin-inclusion/`InterfaceLocal`
restriction.
-/
theorem arbitrary_legal_monic_match_has_intrinsic_dpoi
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (legal : Legal left occurrence)
    (boundary : BoundaryRetained left occurrence) :
    Nonempty
      (PositionalDPOIBridge.FiniteWitnessType
        (canonicalWitness left right occurrence legal)
        (canonicalWitness_in_positionalImage
          left right occurrence legal boundary)) :=
  canonical_finite_bridge_exists left right occurrence legal boundary

/--
The chosen intrinsic witness, rather than only its propositional
inhabitedness.  Its three span arrows are the inverse-equivalence images of
the encoded `left`, `right`, and `occurrence` arrows.
-/
noncomputable def arbitrary_legal_monic_match_intrinsic_witness
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (legal : Legal left occurrence)
    (boundary : BoundaryRetained left occurrence) :
    PositionalDPOIBridge.FiniteWitnessType
      (canonicalWitness left right occurrence legal)
      (canonicalWitness_in_positionalImage
        left right occurrence legal boundary) :=
  PositionalDPOIBridge.finiteWitness
    (canonicalWitness left right occurrence legal)
    (canonicalWitness_in_positionalImage
      left right occurrence legal boundary)

/--
All three arrows underlying the chosen `FiniteWitnessType` commute with the
original intrinsic rule and occurrence under the equivalence-unit
isomorphisms.  This is the explicit transport statement missing from mere
existence of the inverse-image witness.
-/
theorem arbitrary_legal_monic_match_original_arrows
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (_legal : Legal left occurrence)
    (_boundary : BoundaryRetained left occurrence) :
    ((finite_open_hypergraph_equivalence σ inputTypes outputTypes).inverse.map
          (ObjectProperty.homMk left :
            canonicalImageObject σ inputTypes outputTypes K ⟶
              canonicalImageObject σ inputTypes outputTypes L) ≫
        (finite_image_preimage_iso σ inputTypes outputTypes L).hom =
      (finite_image_preimage_iso σ inputTypes outputTypes K).hom ≫ left) ∧
    ((finite_open_hypergraph_equivalence σ inputTypes outputTypes).inverse.map
          (ObjectProperty.homMk right :
            canonicalImageObject σ inputTypes outputTypes K ⟶
              canonicalImageObject σ inputTypes outputTypes R) ≫
        (finite_image_preimage_iso σ inputTypes outputTypes R).hom =
      (finite_image_preimage_iso σ inputTypes outputTypes K).hom ≫ right) ∧
    ((finite_open_hypergraph_equivalence σ inputTypes outputTypes).inverse.map
          (ObjectProperty.homMk occurrence :
            canonicalImageObject σ inputTypes outputTypes L ⟶
              canonicalImageObject σ inputTypes outputTypes G) ≫
        (finite_image_preimage_iso σ inputTypes outputTypes G).hom =
      (finite_image_preimage_iso σ inputTypes outputTypes L).hom ≫
        occurrence) :=
  ⟨finite_image_preimage_map_commutes
      σ inputTypes outputTypes left,
    finite_image_preimage_map_commutes
      σ inputTypes outputTypes right,
    finite_image_preimage_map_commutes
      σ inputTypes outputTypes occurrence⟩

/--
The canonical pushout-complement square of every arbitrary legal intrinsic
monic match is Van Kampen in the adhesive presheaf image.

This conclusion is about the ambient square constructed from a well-formed
finite positional hypergraph.  It does not assert that every object of the
unrestricted typed-presheaf slice is positional or finite.
-/
theorem arbitrary_legal_monic_match_complement_vanKampen
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (legal : Legal left occurrence) :
    (canonicalDerivation left right occurrence legal).complementSquare.IsVanKampen :=
  AdhesiveDPOI.Derivation.complement_vanKampen
    (canonicalDerivation left right occurrence legal)

/--
The canonical result square of the same arbitrary legal intrinsic monic match
is Van Kampen.
-/
theorem arbitrary_legal_monic_match_result_vanKampen
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (legal : Legal left occurrence) :
    (canonicalDerivation left right occurrence legal).resultSquare.IsVanKampen :=
  AdhesiveDPOI.Derivation.result_vanKampen
    (canonicalDerivation left right occurrence legal)

/--
Bundled form used by consumers which need both Van Kampen squares of the
canonical finite DPOI derivation.
-/
theorem arbitrary_legal_monic_match_squares_vanKampen
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right)]
    [Mono
      ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
        occurrence)]
    (legal : Legal left occurrence) :
    (canonicalDerivation left right occurrence legal).complementSquare.IsVanKampen ∧
      (canonicalDerivation left right occurrence legal).resultSquare.IsVanKampen :=
  ⟨arbitrary_legal_monic_match_complement_vanKampen
      left right occurrence legal,
    arbitrary_legal_monic_match_result_vanKampen
      left right occurrence legal⟩

end OneStep

section Concurrency

variable {σ inputTypes outputTypes}
variable
  {K₁ L₁ R₁ K₂ L₂ R₂ G :
    FiniteOpenHypergraph σ inputTypes outputTypes}
  (left₁ : K₁ ⟶ L₁) (right₁ : K₁ ⟶ R₁)
  (occurrence₁ : L₁ ⟶ G)
  (left₂ : K₂ ⟶ L₂) (right₂ : K₂ ⟶ R₂)
  (occurrence₂ : L₂ ⟶ G)

variable
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left₁)]
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right₁)]
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
      occurrence₁)]
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map left₂)]
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map right₂)]
  [Mono
    ((PositionalDPOI.encodingFunctor σ inputTypes outputTypes).map
      occurrence₂)]

/--
The two residual derivations of any pair of legal, boundary-retaining,
parallel-independent matches both transport back to the intrinsic finite
typed-open-hypergraph category.
-/
theorem arbitrary_parallel_independent_matches_have_intrinsic_residuals
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    Nonempty
        (PositionalDPOIBridge.FiniteWitnessType
          (toWitness independent.firstAfterSecond)
          (firstAfterSecondWitness_in_positionalImage
              left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
              legal₁ boundary₁ legal₂ boundary₂ independent)) ∧
      Nonempty
        (PositionalDPOIBridge.FiniteWitnessType
          (toWitness independent.secondAfterFirst)
          (secondAfterFirstWitness_in_positionalImage
              left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
              legal₁ boundary₁ legal₂ boundary₂ independent)) :=
  residual_finite_bridges_exist
      left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂ independent

/-- The chosen intrinsic witness for the “second, then first” residual. -/
noncomputable def first_after_second_intrinsic_witness
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    PositionalDPOIBridge.FiniteWitnessType
      (toWitness independent.firstAfterSecond)
      (firstAfterSecondWitness_in_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent) :=
  PositionalDPOIBridge.finiteWitness
    (toWitness independent.firstAfterSecond)
    (firstAfterSecondWitness_in_positionalImage
      left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂ independent)

/-- The chosen intrinsic witness for the “first, then second” residual. -/
noncomputable def second_after_first_intrinsic_witness
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    PositionalDPOIBridge.FiniteWitnessType
      (toWitness independent.secondAfterFirst)
      (secondAfterFirstWitness_in_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent) :=
  PositionalDPOIBridge.finiteWitness
    (toWitness independent.secondAfterFirst)
    (secondAfterFirstWitness_in_positionalImage
      left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂ independent)

/--
The ambient concurrency isomorphism transported through the full essential
image and then through the inverse equivalence.  Its endpoints are exactly
the result objects of the two chosen intrinsic residual witnesses.
-/
noncomputable def intrinsic_concurrency_result_iso
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    (first_after_second_intrinsic_witness
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent).result.cocone.pt ≅
      (second_after_first_intrinsic_witness
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent).result.cocone.pt := by
  let E := finite_open_hypergraph_equivalence σ inputTypes outputTypes
  let hFirst :=
    firstAfterSecondWitness_in_positionalImage
      left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂ independent
  let hSecond :=
    secondAfterFirstWitness_in_positionalImage
      left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂ independent
  let liftedIso :
      (⟨independent.firstAfterSecond.result, hFirst.result_mem⟩ :
        AdhesiveFiniteImage σ inputTypes outputTypes) ≅
      (⟨independent.secondAfterFirst.result, hSecond.result_mem⟩ :
        AdhesiveFiniteImage σ inputTypes outputTypes) :=
    ObjectProperty.isoMk _ independent.concurrencyIso
  exact E.inverse.mapIso liftedIso

/--
The image of the second rule's right-hand side in the first sequential
result, transported to the intrinsic finite category.
-/
noncomputable def intrinsic_second_right_to_first_result
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    (finite_open_hypergraph_equivalence σ inputTypes outputTypes).inverse.obj
          (canonicalImageObject σ inputTypes outputTypes R₂) ⟶
      (first_after_second_intrinsic_witness
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent).result.cocone.pt := by
  let E := finite_open_hypergraph_equivalence σ inputTypes outputTypes
  let hFirst :=
    firstAfterSecondWitness_in_positionalImage
      left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂ independent
  let lifted :
      canonicalImageObject σ inputTypes outputTypes R₂ ⟶
        (⟨independent.firstAfterSecond.result, hFirst.result_mem⟩ :
          AdhesiveFiniteImage σ inputTypes outputTypes) :=
    ObjectProperty.homMk
      (independent.secondRightToFirstResidualContext ≫
        independent.firstAfterSecond.complementToResult)
  exact E.inverse.map lifted

/--
The image of the first rule's right-hand side in the second sequential
result, transported to the intrinsic finite category.
-/
noncomputable def intrinsic_first_right_to_second_result
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    (finite_open_hypergraph_equivalence σ inputTypes outputTypes).inverse.obj
          (canonicalImageObject σ inputTypes outputTypes R₁) ⟶
      (second_after_first_intrinsic_witness
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent).result.cocone.pt := by
  let E := finite_open_hypergraph_equivalence σ inputTypes outputTypes
  let hSecond :=
    secondAfterFirstWitness_in_positionalImage
      left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
      legal₁ boundary₁ legal₂ boundary₂ independent
  let lifted :
      canonicalImageObject σ inputTypes outputTypes R₁ ⟶
        (⟨independent.secondAfterFirst.result, hSecond.result_mem⟩ :
          AdhesiveFiniteImage σ inputTypes outputTypes) :=
    ObjectProperty.homMk
      (independent.firstRightToSecondResidualContext ≫
        independent.secondAfterFirst.complementToResult)
  exact E.inverse.map lifted

/--
The second right-hand-side concurrency equation after applying the inverse
essential-image equivalence.  This explicit mapped-arrow form is useful when
consumers do not want to unfold the transported DPO witnesses.
-/
theorem intrinsic_concurrency_second_right_map
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    let E := finite_open_hypergraph_equivalence σ inputTypes outputTypes
    let hFirst :=
      firstAfterSecondWitness_in_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent
    let hSecond :=
      secondAfterFirstWitness_in_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent
    let firstResult : AdhesiveFiniteImage σ inputTypes outputTypes :=
      ⟨independent.firstAfterSecond.result, hFirst.result_mem⟩
    let secondResult : AdhesiveFiniteImage σ inputTypes outputTypes :=
      ⟨independent.secondAfterFirst.result, hSecond.result_mem⟩
    E.inverse.map
        (ObjectProperty.homMk
          (independent.secondRightToFirstResidualContext ≫
            independent.firstAfterSecond.complementToResult) :
          canonicalImageObject σ inputTypes outputTypes R₂ ⟶ firstResult) ≫
      (E.inverse.mapIso
        (ObjectProperty.isoMk _ independent.concurrencyIso :
          firstResult ≅ secondResult)).hom =
      E.inverse.map
        (ObjectProperty.homMk independent.secondAfterFirst.rightToResult :
          canonicalImageObject σ inputTypes outputTypes R₂ ⟶ secondResult) := by
  dsimp only
  simp only [Functor.mapIso_hom]
  rw [←
    (finite_open_hypergraph_equivalence σ inputTypes outputTypes).inverse.map_comp]
  apply congrArg
    (finite_open_hypergraph_equivalence σ inputTypes outputTypes).inverse.map
  apply ObjectProperty.hom_ext
  exact independent.concurrencyIso_secondRight

/--
The first right-hand-side concurrency equation after applying the inverse
essential-image equivalence.
-/
theorem intrinsic_concurrency_first_right_map
    (legal₁ : Legal left₁ occurrence₁)
    (boundary₁ : BoundaryRetained left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (boundary₂ : BoundaryRetained left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    let E := finite_open_hypergraph_equivalence σ inputTypes outputTypes
    let hFirst :=
      firstAfterSecondWitness_in_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent
    let hSecond :=
      secondAfterFirstWitness_in_positionalImage
        left₁ right₁ occurrence₁ left₂ right₂ occurrence₂
        legal₁ boundary₁ legal₂ boundary₂ independent
    let firstResult : AdhesiveFiniteImage σ inputTypes outputTypes :=
      ⟨independent.firstAfterSecond.result, hFirst.result_mem⟩
    let secondResult : AdhesiveFiniteImage σ inputTypes outputTypes :=
      ⟨independent.secondAfterFirst.result, hSecond.result_mem⟩
    E.inverse.map
        (ObjectProperty.homMk independent.firstAfterSecond.rightToResult :
          canonicalImageObject σ inputTypes outputTypes R₁ ⟶ firstResult) ≫
      (E.inverse.mapIso
        (ObjectProperty.isoMk _ independent.concurrencyIso :
          firstResult ≅ secondResult)).hom =
      E.inverse.map
        (ObjectProperty.homMk
          (independent.firstRightToSecondResidualContext ≫
            independent.secondAfterFirst.complementToResult) :
          canonicalImageObject σ inputTypes outputTypes R₁ ⟶ secondResult) := by
  dsimp only
  simp only [Functor.mapIso_hom]
  rw [←
    (finite_open_hypergraph_equivalence σ inputTypes outputTypes).inverse.map_comp]
  apply congrArg
    (finite_open_hypergraph_equivalence σ inputTypes outputTypes).inverse.map
  apply ObjectProperty.hom_ext
  exact independent.concurrencyIso_firstRight

/--
The same arbitrary pair has the full adhesive concurrency diamond.  The
canonical final-result isomorphism preserves the images of both rule
right-hand sides.
-/
theorem arbitrary_parallel_independent_matches_commute
    (legal₁ : Legal left₁ occurrence₁)
    (legal₂ : Legal left₂ occurrence₂)
    (independent :
      DPOConcurrency.ParallelIndependent
        (canonicalDerivation left₁ right₁ occurrence₁ legal₁)
        (canonicalDerivation left₂ right₂ occurrence₂ legal₂)) :
    ∃ e :
        independent.firstAfterSecond.result ≅
          independent.secondAfterFirst.result,
      (independent.secondRightToFirstResidualContext ≫
          independent.firstAfterSecond.complementToResult) ≫ e.hom =
        independent.secondAfterFirst.rightToResult ∧
      independent.firstAfterSecond.rightToResult ≫ e.hom =
        independent.firstRightToSecondResidualContext ≫
          independent.secondAfterFirst.complementToResult :=
  independent.parallel_independent_concurrency

end Concurrency

end Cantilune.Core.GeneralFiniteOpenDPOI
