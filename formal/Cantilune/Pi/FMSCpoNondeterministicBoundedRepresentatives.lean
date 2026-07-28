import Cantilune.Pi.FMSCpoNondeterministicGeneratedCardinality
import Mathlib.Logic.Equiv.Set

/-!
# Small bounded representatives for generated nondeterministic computations

For a fixed source `X`, every generated subalgebra has cardinality bounded
by `countableClosureBound X`.  This file turns that cardinal estimate into
an honest `Type 0` family:

* embed each generated carrier into the fixed type
  `(countableClosureBound X).out`;
* use the range of that embedding as its support;
* transport the omega-CPO and pointed continuous-semilattice structure to
  that support;
* encode the resulting structure and generator entirely by `Type 0` data.

The resulting presentations decode to actual `NDωCPO` objects and are
continuously isomorphic to the generated subalgebras.  No object of the
large type `NDωCPO : Type 1` occurs in the indexing data.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicBoundedRepresentatives

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicGeneratedSubalgebra
open Cantilune.Pi.FMSCpoNondeterministicGeneratedCardinality
open Cantilune.Pi.FMSCpoNondeterministicCardinalClosure

/-! ## Transport of omega-CPO structure along an equivalence -/

namespace Reindex

variable {α β : Type} [omega : OmegaCompletePartialOrder α]

/-- The partial order on `β` pulled back along an equivalence with `α`. -/
@[implicit_reducible]
def partialOrder (equivalence : α ≃ β) : PartialOrder β :=
  @PartialOrder.lift β α omega.toPartialOrder
    equivalence.symm equivalence.symm.injective

/-- The inverse equivalence as a monotone map for the pulled-back order. -/
def backwardOrderHom
    (equivalence : α ≃ β) :
    @OrderHom β α
      (@PartialOrder.toPreorder β (partialOrder equivalence))
      (@PartialOrder.toPreorder α
        (@OmegaCompletePartialOrder.toPartialOrder α omega)) :=
  @OrderHom.mk β α
    (@PartialOrder.toPreorder β
      (partialOrder equivalence))
    (@PartialOrder.toPreorder α
      (@OmegaCompletePartialOrder.toPartialOrder α omega))
    equivalence.symm
    (fun _ _ ordered => ordered)

/-- The forward equivalence as a monotone map for the pulled-back order. -/
def forwardOrderHom
    (equivalence : α ≃ β) :
    @OrderHom α β
      (@PartialOrder.toPreorder α
        (@OmegaCompletePartialOrder.toPartialOrder α omega))
      (@PartialOrder.toPreorder β
        (partialOrder equivalence)) :=
  @OrderHom.mk α β
    (@PartialOrder.toPreorder α
      (@OmegaCompletePartialOrder.toPartialOrder α omega))
    (@PartialOrder.toPreorder β
      (partialOrder equivalence))
    equivalence
    (fun _ _ ordered => by
      change
        equivalence.symm (equivalence _) ≤
          equivalence.symm (equivalence _)
      simpa using ordered)

/-- The omega supremum transported to the pulled-back order. -/
abbrev transportedOmegaSup
    (equivalence : α ≃ β)
    (chain :
      @Chain β
        (@PartialOrder.toPreorder β
          (partialOrder equivalence))) :
    β := by
  letI : PartialOrder β := partialOrder equivalence
  exact
    equivalence
      (ωSup (chain.map (backwardOrderHom equivalence)))

/-- The full omega-CPO structure transported along an equivalence. -/
@[implicit_reducible]
def omegaCompletePartialOrder
    (equivalence : α ≃ β) :
    OmegaCompletePartialOrder β :=
  @OmegaCompletePartialOrder.lift α β omega
      (partialOrder equivalence)
      (backwardOrderHom equivalence)
      (transportedOmegaSup equivalence)
      (fun left right ordered => by
        change
          equivalence.symm left ≤ equivalence.symm right
        exact ordered)
      (fun chain => by
        letI : PartialOrder β := partialOrder equivalence
        change
          equivalence.symm
              (equivalence
                (ωSup
                  (chain.map
                    (backwardOrderHom equivalence)))) =
            ωSup
              (chain.map
                (backwardOrderHom equivalence))
        exact equivalence.symm_apply_apply
          (ωSup (chain.map (backwardOrderHom equivalence))))

/-- The forward equivalence is continuous for the transported omega-CPO. -/
def forward
    (equivalence : α ≃ β) :
    @ContinuousHom α β omega
      (@omegaCompletePartialOrder α β omega equivalence) :=
  @ContinuousHom.mk α β omega
    (@omegaCompletePartialOrder α β omega equivalence)
    (forwardOrderHom equivalence)
    (by
      letI : OmegaCompletePartialOrder β :=
        @omegaCompletePartialOrder α β omega equivalence
      intro chain
      apply equivalence.symm.injective
      change
        equivalence.symm
            (equivalence (ωSup chain)) =
          equivalence.symm
            (equivalence
              (ωSup
                ((chain.map
                  (forwardOrderHom equivalence)).map
                  (backwardOrderHom equivalence))))
      simp only [equivalence.symm_apply_apply]
      congr 1
      ext index
      exact (equivalence.symm_apply_apply _).symm)

/-- The inverse equivalence is continuous for the transported omega-CPO. -/
def backward
    (equivalence : α ≃ β) :
    @ContinuousHom β α
      (@omegaCompletePartialOrder α β omega equivalence) omega :=
  @ContinuousHom.mk β α
    (@omegaCompletePartialOrder α β omega equivalence) omega
    (backwardOrderHom equivalence)
    (by
      letI : OmegaCompletePartialOrder β :=
        @omegaCompletePartialOrder α β omega equivalence
      intro chain
      change
        equivalence.symm
            (equivalence
              (ωSup
                (chain.map
                  (backwardOrderHom equivalence)))) =
          ωSup
            (chain.map
              (backwardOrderHom equivalence))
      exact equivalence.symm_apply_apply _)

@[simp]
theorem forward_apply
    (equivalence : α ≃ β)
    (value : α) :
    forward equivalence value = equivalence value :=
  rfl

@[simp]
theorem backward_apply
    (equivalence : α ≃ β)
    (value : β) :
    backward equivalence value = equivalence.symm value :=
  rfl

/-- Apply the inverse equivalence componentwise to a product. -/
def backwardPair
    (equivalence : α ≃ β) :
    @ContinuousHom (β × β) (α × α)
      (@Prod.instOmegaCompletePartialOrder β β
        (@omegaCompletePartialOrder α β omega equivalence)
        (@omegaCompletePartialOrder α β omega equivalence))
      (@Prod.instOmegaCompletePartialOrder α α
        omega omega) := by
  letI : OmegaCompletePartialOrder β :=
    @omegaCompletePartialOrder α β omega equivalence
  exact
    { toFun := fun pair =>
        (equivalence.symm pair.1,
          equivalence.symm pair.2)
      monotone' := fun _ _ ordered => ordered
      map_ωSup' := by
        intro chain
        apply Prod.ext
        · change
            equivalence.symm
                (ωSup (chain.map OrderHom.fst)) =
              ωSup
                ((chain.map
                  { toFun := fun pair =>
                      (equivalence.symm pair.1,
                        equivalence.symm pair.2)
                    monotone' := fun _ _ ordered => ordered }).map
                  OrderHom.fst)
          exact (backward equivalence).continuous
            (chain.map OrderHom.fst)
        · change
            equivalence.symm
                (ωSup (chain.map OrderHom.snd)) =
              ωSup
                ((chain.map
                  { toFun := fun pair =>
                      (equivalence.symm pair.1,
                        equivalence.symm pair.2)
                    monotone' := fun _ _ ordered => ordered }).map
                  OrderHom.snd)
          exact (backward equivalence).continuous
            (chain.map OrderHom.snd) }

end Reindex

/-! ## A universe-small code for a nondeterministic computation -/

/--
All data of a nondeterministic computation on a fixed `Type 0` carrier.

The omega-CPO instance is supplied explicitly to every dependent field, so
this record itself remains in `Type 0`.
-/
structure SmallComputation (carrier : Type) where
  omega : OmegaCompletePartialOrder carrier
  divergence : carrier
  divergence_le :
    ∀ value,
      @LE.le carrier omega.toPartialOrder.toLE divergence value
  deadlock : carrier
  choice :
    @ContinuousHom (carrier × carrier) carrier
      (@Prod.instOmegaCompletePartialOrder carrier carrier omega omega)
      omega
  choice_assoc :
    ∀ left middle right,
      choice (choice (left, middle), right) =
        choice (left, choice (middle, right))
  choice_comm :
    ∀ left right,
      choice (left, right) = choice (right, left)
  choice_idem :
    ∀ value,
      choice (value, value) = value
  deadlock_choice :
    ∀ value,
      choice (deadlock, value) = value

namespace SmallComputation

/-- Decode a small code as an actual nondeterministic computation. -/
def decode
    {carrier : Type}
    (code : SmallComputation carrier) :
    NondeterministicComputation := by
  letI : OmegaCompletePartialOrder carrier := code.omega
  exact
    { carrier := ωCPO.of carrier
      divergence := code.divergence
      divergence_le := code.divergence_le
      deadlock := code.deadlock
      choice := code.choice
      choice_assoc := code.choice_assoc
      choice_comm := code.choice_comm
      choice_idem := code.choice_idem
      deadlock_choice := code.deadlock_choice }

/-- Decode a small code directly as an `NDωCPO` object. -/
def object
    {carrier : Type}
    (code : SmallComputation carrier) :
    NDωCPO where
  computation := decode code

variable
    {α β : Type}
    (source : NDωCPO)
    (equivalence : source.carrier ≃ β)

private abbrev transportedOmega :
    OmegaCompletePartialOrder β :=
  Reindex.omegaCompletePartialOrder equivalence

/-- Choice transported along the carrier equivalence. -/
def transportedChoice :
    @ContinuousHom (β × β) β
      (@Prod.instOmegaCompletePartialOrder β β
        (transportedOmega source equivalence)
        (transportedOmega source equivalence))
      (transportedOmega source equivalence) := by
  letI : OmegaCompletePartialOrder β :=
    transportedOmega source equivalence
  exact
    (Reindex.forward equivalence).comp
      (source.computation.choice.comp
        (Reindex.backwardPair equivalence))

@[simp]
theorem transportedChoice_apply
    (left right : β) :
    transportedChoice source equivalence (left, right) =
      equivalence
        (source.computation.choice
          (equivalence.symm left,
            equivalence.symm right)) :=
  rfl

/-- Transport a nondeterministic computation along a carrier equivalence. -/
def reindex : SmallComputation β where
  omega := transportedOmega source equivalence
  divergence := equivalence source.computation.divergence
  divergence_le := by
    intro value
    calc
      equivalence.symm
          (equivalence source.computation.divergence) =
          source.computation.divergence :=
        equivalence.left_inv _
      _ ≤ equivalence.symm value :=
        source.computation.divergence_le _
  deadlock := equivalence source.computation.deadlock
  choice := transportedChoice source equivalence
  choice_assoc := by
    intro left middle right
    rw [transportedChoice_apply,
      transportedChoice_apply,
      transportedChoice_apply,
      transportedChoice_apply]
    simp only [equivalence.symm_apply_apply]
    exact congrArg equivalence
      (source.computation.choice_assoc _ _ _)
  choice_comm := by
    intro left right
    rw [transportedChoice_apply,
      transportedChoice_apply]
    exact congrArg equivalence
      (source.computation.choice_comm _ _)
  choice_idem := by
    intro value
    rw [transportedChoice_apply]
    rw [source.computation.choice_idem]
    exact equivalence.apply_symm_apply value
  deadlock_choice := by
    intro value
    rw [transportedChoice_apply]
    simp only [equivalence.symm_apply_apply]
    rw [source.computation.deadlock_choice]
    exact equivalence.apply_symm_apply value

/-- The forward carrier equivalence as a strict semilattice arrow. -/
def forwardHom :
    source ⟶ object (reindex source equivalence) where
  hom := Reindex.forward equivalence
  map_divergence := rfl
  map_deadlock := rfl
  map_choice := by
    intro left right
    change
      equivalence
          (source.computation.choice (left, right)) =
        equivalence
          (source.computation.choice
            (equivalence.symm (equivalence left),
              equivalence.symm (equivalence right)))
    simp

/-- The inverse carrier equivalence as a strict semilattice arrow. -/
def backwardHom :
    object (reindex source equivalence) ⟶ source where
  hom := Reindex.backward equivalence
  map_divergence := equivalence.left_inv _
  map_deadlock := equivalence.left_inv _
  map_choice := by
    intro left right
    change
      equivalence.symm
          (equivalence
            (source.computation.choice
              (equivalence.symm left, equivalence.symm right))) =
        source.computation.choice
          (equivalence.symm left, equivalence.symm right)
    exact equivalence.left_inv _

@[simp]
theorem forward_backward :
    forwardHom source equivalence ≫
        backwardHom source equivalence =
      𝟙 source := by
  apply NDωCPO.Hom.ext
  apply ContinuousHom.ext
  intro value
  exact equivalence.left_inv value

@[simp]
theorem backward_forward :
    backwardHom source equivalence ≫
        forwardHom source equivalence =
      𝟙 (object (reindex source equivalence)) := by
  apply NDωCPO.Hom.ext
  apply ContinuousHom.ext
  intro value
  exact equivalence.right_inv value

end SmallComputation

/-! ## Fixed-support presentations for one source -/

namespace Presentation

variable (source : ωCPO)

/-- The fixed `Type 0` large enough for every generated carrier over `source`. -/
abbrev BoundType : Type :=
  (countableClosureBound source.carrier).out

/--
A complete small presentation: a support inside the fixed bound, all
nondeterministic computation structure on that support, and the continuous
source generator.
-/
structure Code where
  support : Set (BoundType source)
  computation : SmallComputation support
  generator :
    source ⟶
      NDωCPO.forget.obj
        (SmallComputation.object computation)

/-- Decode a presentation to an actual target object. -/
def object (code : Code source) : NDωCPO :=
  SmallComputation.object code.computation

@[simp]
theorem object_carrier
    (code : Code source) :
    NDωCPO.forget.obj (object source code) =
      NDωCPO.forget.obj
        (SmallComputation.object code.computation) :=
  rfl

end Presentation

end Cantilune.Pi.FMSCpoNondeterministicBoundedRepresentatives
