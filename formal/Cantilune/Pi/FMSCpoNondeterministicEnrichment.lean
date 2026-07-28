import Cantilune.Pi.FMSCpoNondeterministicCategory

/-!
# Omega-CPO enrichment of nondeterministic computations

The Fiore--Moggi--Sangiorgi powerdomain is induced by an enriched
free/forgetful adjunction.  Before constructing that adjunction, the algebra
category itself must have omega-CPO hom objects.

This file constructs the pointwise omega-CPO on strict continuous
semilattice homomorphisms.  Closure under omega-suprema is proved from:

* strictness of every arrow at divergence and deadlock; and
* continuity of the target choice operation.

No free powerdomain, enriched left adjoint, or solution-set argument is
assumed here.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicEnrichment

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoNondeterministicCategory

namespace NDωCPO

variable (source target : NDωCPO)

/-- Pointwise order on strict continuous semilattice arrows. -/
instance homPartialOrder : PartialOrder (source ⟶ target) where
  le left right :=
    ∀ value, left.hom value ≤ right.hom value
  le_refl morphism value := le_rfl
  le_trans left middle right first second value :=
    le_trans (first value) (second value)
  le_antisymm left right first second := by
    apply NDωCPO.Hom.ext
    apply ContinuousHom.ext
    intro value
    exact le_antisymm (first value) (second value)

/-- Forget a strict semilattice arrow to its underlying continuous map. -/
def homOrderHom :
    (source ⟶ target) →o
      ContinuousHom source.carrier.carrier target.carrier.carrier where
  toFun := fun morphism => morphism.hom
  monotone' := by
    intro left right ordered value
    exact ordered value

/-- Pointwise evaluation of a chain of strict semilattice arrows. -/
def evaluationChain
    (chain : Chain (source ⟶ target))
    (value : source.carrier) :
    Chain target.carrier :=
  chain.map
    { toFun := fun morphism => morphism.hom value
      monotone' := by
        intro left right ordered
        exact ordered value }

@[simp]
theorem evaluationChain_apply
    (chain : Chain (source ⟶ target))
    (value : source.carrier)
    (index : ℕ) :
    evaluationChain source target chain value index =
      (chain index).hom value :=
  rfl

/-- The pointwise supremum of strict arrows is again a strict arrow. -/
def homOmegaSup
    (chain : Chain (source ⟶ target)) :
    source ⟶ target where
  hom :=
    (ωSup (chain.map (homOrderHom source target)) :
      ContinuousHom source.carrier.carrier target.carrier.carrier)
  map_divergence := by
    change
      ContinuousHom.ωSup
          (chain.map (homOrderHom source target))
          source.computation.divergence =
        target.computation.divergence
    rw [ContinuousHom.ωSup_apply]
    change
      ωSup
          (evaluationChain source target chain
            source.computation.divergence) =
        target.computation.divergence
    apply le_antisymm
    · apply ωSup_le
      intro index
      exact le_of_eq (chain index).map_divergence
    · exact le_ωSup_of_le 0
        (le_of_eq (chain 0).map_divergence.symm)
  map_deadlock := by
    change
      ContinuousHom.ωSup
          (chain.map (homOrderHom source target))
          source.computation.deadlock =
        target.computation.deadlock
    rw [ContinuousHom.ωSup_apply]
    change
      ωSup
          (evaluationChain source target chain
            source.computation.deadlock) =
        target.computation.deadlock
    apply le_antisymm
    · apply ωSup_le
      intro index
      exact le_of_eq (chain index).map_deadlock
    · exact le_ωSup_of_le 0
        (le_of_eq (chain 0).map_deadlock.symm)
  map_choice := by
    intro left right
    change
      ContinuousHom.ωSup
          (chain.map (homOrderHom source target))
          (source.computation.choice (left, right)) =
        target.computation.choice
          (ContinuousHom.ωSup
              (chain.map (homOrderHom source target)) left,
            ContinuousHom.ωSup
              (chain.map (homOrderHom source target)) right)
    rw [ContinuousHom.ωSup_apply,
      ContinuousHom.ωSup_apply,
      ContinuousHom.ωSup_apply]
    change
      ωSup
          (evaluationChain source target chain
            (source.computation.choice (left, right))) =
        target.computation.choice
          (ωSup (evaluationChain source target chain left),
            ωSup (evaluationChain source target chain right))
    let pairChain : Chain (target.carrier × target.carrier) :=
      (evaluationChain source target chain left).zip
        (evaluationChain source target chain right)
    have mapped :
        evaluationChain source target chain
            (source.computation.choice (left, right)) =
          pairChain.map target.computation.choice.toOrderHom := by
      apply Chain.ext
      funext index
      exact (chain index).map_choice left right
    rw [mapped]
    let choiceOrderHom :
        (target.carrier × target.carrier) →o target.carrier :=
      { toFun := target.computation.choice
        monotone' := target.computation.choice.monotone }
    have mappedChoice :
        pairChain.map target.computation.choice.toOrderHom =
          pairChain.map choiceOrderHom := by
      apply Chain.ext
      funext index
      rfl
    rw [mappedChoice]
    calc
      ωSup (pairChain.map choiceOrderHom) =
          target.computation.choice (ωSup pairChain) := by
        exact
          (target.computation.choice.continuous pairChain).symm
      _ =
          target.computation.choice
            (ωSup (evaluationChain source target chain left),
              ωSup (evaluationChain source target chain right)) := by
        rw [Prod.ωSup_zip]

@[simp]
theorem homOmegaSup_hom
    (chain : Chain (source ⟶ target)) :
    (homOmegaSup source target chain).hom =
      ωSup (chain.map (homOrderHom source target)) :=
  by
    change
      (ωSup (chain.map (homOrderHom source target)) :
        ContinuousHom source.carrier.carrier target.carrier.carrier) =
        ωSup (chain.map (homOrderHom source target))
    rfl

/-- Strict arrows form an omega-CPO under the pointwise order. -/
instance homOmegaCompletePartialOrder :
    OmegaCompletePartialOrder (source ⟶ target) :=
  OmegaCompletePartialOrder.lift
    (homOrderHom source target)
    (homOmegaSup source target)
    (by
      intro left right ordered value
      exact ordered value)
    (by
      intro chain
      change
        (homOmegaSup source target chain).hom =
          ωSup (chain.map (homOrderHom source target))
      exact homOmegaSup_hom source target chain)

@[simp]
theorem omegaSup_hom
    (chain : Chain (source ⟶ target)) :
    (ωSup chain).hom =
      ωSup (chain.map (homOrderHom source target)) :=
  homOmegaSup_hom source target chain

@[simp]
theorem omegaSup_apply
    (chain : Chain (source ⟶ target))
    (value : source.carrier) :
    (ωSup chain).hom value =
      ωSup (evaluationChain source target chain value) := by
  rw [omegaSup_hom]
  change
    ContinuousHom.ωSup
        (chain.map (homOrderHom source target)) value =
      ωSup (evaluationChain source target chain value)
  rw [ContinuousHom.ωSup_apply]
  rfl

/--
The local action of the carrier functor is omega-continuous on hom objects.
This is the enriched-functor part that can be proved before the free left
adjoint exists.
-/
def forgetHomContinuous
    (source target : NDωCPO) :
    ContinuousHom
      (source ⟶ target)
      (ContinuousHom source.carrier.carrier target.carrier.carrier) where
  toFun := fun morphism => morphism.hom
  monotone' := by
    intro left right ordered value
    exact ordered value
  map_ωSup' := by
    intro chain
    exact omegaSup_hom source target chain

@[simp]
theorem forgetHomContinuous_apply
    (source target : NDωCPO)
    (morphism : source ⟶ target) :
    forgetHomContinuous source target morphism =
      morphism.hom :=
  rfl

/-! ## Continuous enriched composition -/

/-- The first component of a chain of composable arrow pairs. -/
def firstHomChain
    (first middle last : NDωCPO)
    (chain : Chain ((first ⟶ middle) × (middle ⟶ last))) :
    Chain (first ⟶ middle) :=
  chain.map OrderHom.fst

/-- The second component of a chain of composable arrow pairs. -/
def secondHomChain
    (first middle last : NDωCPO)
    (chain : Chain ((first ⟶ middle) × (middle ⟶ last))) :
    Chain (middle ⟶ last) :=
  chain.map OrderHom.snd

/-- Categorical composition is monotone in both strict arrows. -/
def compositionOrderHom
    (first middle last : NDωCPO) :
    ((first ⟶ middle) × (middle ⟶ last)) →o
      (first ⟶ last) where
  toFun := fun pair => pair.1 ≫ pair.2
  monotone' := by
    intro left right ordered value
    change
      left.2.hom (left.1.hom value) ≤
        right.2.hom (right.1.hom value)
    exact le_trans
      (left.2.hom.monotone (ordered.1 value))
      (ordered.2 (right.1.hom value))

/-- The diagonal chain of composites induced by a chain of arrow pairs. -/
def compositionChain
    (first middle last : NDωCPO)
    (chain : Chain ((first ⟶ middle) × (middle ⟶ last))) :
    Chain (first ⟶ last) :=
  chain.map (compositionOrderHom first middle last)

/--
Composition of strict continuous semilattice arrows is jointly
omega-continuous.  This is the load-bearing hom-object part of the
`Cpo`-enrichment of `NDωCPO`.
-/
def compositionContinuous
    (first middle last : NDωCPO) :
    ContinuousHom
      ((first ⟶ middle) × (middle ⟶ last))
      (first ⟶ last) where
  toFun := fun pair => pair.1 ≫ pair.2
  monotone' := by
    intro left right ordered value
    change
      left.2.hom (left.1.hom value) ≤
        right.2.hom (right.1.hom value)
    exact le_trans
      (left.2.hom.monotone (ordered.1 value))
      (ordered.2 (right.1.hom value))
  map_ωSup' := by
    intro chain
    apply NDωCPO.Hom.ext
    apply ContinuousHom.ext
    intro value
    change
      (ωSup (secondHomChain first middle last chain)).hom
          ((ωSup (firstHomChain first middle last chain)).hom value) =
        (ωSup (compositionChain first middle last chain)).hom value
    rw [omegaSup_hom, omegaSup_apply, omegaSup_apply]
    let functionChain :
        Chain
          (ContinuousHom middle.carrier.carrier last.carrier.carrier) :=
      (secondHomChain first middle last chain).map
        (homOrderHom middle last)
    let argumentChain : Chain middle.carrier :=
      evaluationChain first middle
        (firstHomChain first middle last chain) value
    let applicationChain : Chain last.carrier :=
      (functionChain.zip argumentChain).map
        ContinuousHom.Prod.apply.toOrderHom
    calc
      ContinuousHom.ωSup functionChain (ωSup argumentChain) =
          ContinuousHom.Prod.apply
            (ωSup (functionChain.zip argumentChain)) :=
        ContinuousHom.ωSup_apply_ωSup
          functionChain argumentChain
      _ = ωSup applicationChain := by
        exact
          ContinuousHom.Prod.apply.continuous
            (functionChain.zip argumentChain)
      _ =
          ωSup
            (evaluationChain first last
              (compositionChain first middle last chain) value) := by
        apply congrArg ωSup
        apply Chain.ext
        funext index
        rfl

@[simp]
theorem compositionContinuous_apply
    (first middle last : NDωCPO)
    (pair : (first ⟶ middle) × (middle ⟶ last)) :
    compositionContinuous first middle last pair =
      pair.1 ≫ pair.2 :=
  rfl

end NDωCPO

end Cantilune.Pi.FMSCpoNondeterministicEnrichment
