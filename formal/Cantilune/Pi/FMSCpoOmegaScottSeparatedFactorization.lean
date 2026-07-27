import Cantilune.Pi.FMSCpoFiniteSupportTensor
import Cantilune.Pi.FMSCpoOmegaScottStrength

/-!
# Factoring omega-Scott computations through the separated tensor

The finite-support tensor is a subtype of the cartesian product: its points
are precisely pairs with disjoint support.  This file identifies exactly when
an omega-Scott computation on the cartesian product factors through that
subtype.

This is a compatibility theorem between the existing support-separated tensor
and the existing lower/Hoare omega-Scott power construction.  It does not make
the latter into an Abramsky powerdomain, and it does not assert that arbitrary
computations have separated support.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottSeparatedFactorization

open OmegaCompletePartialOrder
open Set
open Topology
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength

universe u v

variable
    {Resource : Type u}
    [DecidableEq Resource]

namespace Supported

variable
    (left right :
      SupportedOmegaCpo.{u, v} Resource)

/-- The order embedding underlying the forgetful map from separated pairs. -/
def forgetOrderHom :
    (Separated.tensor left right).Carrier →o
      left.Carrier × right.Carrier where
  toFun := fun value => (value.fst, value.snd)
  monotone' := by
    intro first second ordered
    exact ordered

/--
Forget the proof that the two components have disjoint finite support.
Componentwise omega-suprema make this map omega-continuous.
-/
def forgetContinuous :
    (Separated.tensor left right).Carrier →𝒄
      left.Carrier × right.Carrier where
  toOrderHom := forgetOrderHom left right
  map_ωSup' := by
    intro chain
    rfl

@[simp]
theorem forgetContinuous_apply
    (value : (Separated.tensor left right).Carrier) :
    forgetContinuous left right value =
      (value.fst, value.snd) :=
  rfl

/--
The closed lower locus of cartesian pairs whose supports are disjoint.

Closedness uses the support-stabilisation field of `SupportedOmegaCpo`.
-/
def separatedLocus :
    OmegaScottPower (left.Carrier × right.Carrier) :=
  ⟨
    { value |
      Disjoint
        (left.support value.1)
        (right.support value.2) },
    by
      apply isClosed_iff_isLowerSet_and_chainSupClosed.mpr
      constructor
      · intro upper lower ordered upperSeparated
        exact
          Disjoint.mono
            (left.support_mono ordered.1)
            (right.support_mono ordered.2)
            upperSeparated
      · rintro _ ⟨chain, rfl⟩ members _ _ limit isLimit
        have limitEq : limit = ωSup chain :=
          OmegaCompletePartialOrder.ωSup_eq_of_isLUB isLimit
        subst limit
        let leftChain : Chain left.Carrier :=
          chain.map OrderHom.fst
        let rightChain : Chain right.Carrier :=
          chain.map OrderHom.snd
        rcases
            left.support_omegaSup_bounded leftChain with
          ⟨leftIndex, leftBound⟩
        rcases
            right.support_omegaSup_bounded rightChain with
          ⟨rightIndex, rightBound⟩
        let common := max leftIndex rightIndex
        have leftAtCommon :
            left.support (leftChain leftIndex) ⊆
              left.support (leftChain common) :=
          left.support_mono
            (leftChain.monotone
              (Nat.le_max_left _ _))
        have rightAtCommon :
            right.support (rightChain rightIndex) ⊆
              right.support (rightChain common) :=
          right.support_mono
            (rightChain.monotone
              (Nat.le_max_right _ _))
        change
          Disjoint
            (left.support (ωSup leftChain))
            (right.support (ωSup rightChain))
        exact
          Disjoint.mono
            (leftBound.trans leftAtCommon)
            (rightBound.trans rightAtCommon)
            (members ⟨common, rfl⟩)
  ⟩

@[simp]
theorem mem_separatedLocus_iff
    (value : left.Carrier × right.Carrier) :
    WithOmegaScott.toOmegaScott value ∈
        carrier (separatedLocus left right) ↔
      Disjoint
        (left.support value.1)
        (right.support value.2) :=
  Iff.rfl

/-- Restrict a cartesian computation to its separated points. -/
def restrictSeparated
    (values :
      OmegaScottPower (left.Carrier × right.Carrier)) :
    OmegaScottPower
      (Separated.tensor left right).Carrier :=
  preimage (forgetContinuous left right) values

@[simp]
theorem mem_restrictSeparated_iff
    (values :
      OmegaScottPower (left.Carrier × right.Carrier))
    (value : (Separated.tensor left right).Carrier) :
    WithOmegaScott.toOmegaScott value ∈
        carrier (restrictSeparated left right values) ↔
      WithOmegaScott.toOmegaScott
          (value.fst, value.snd) ∈
        carrier values :=
  Iff.rfl

/--
Forgetting after restriction is intersection with the separated locus.
-/
theorem mapRaw_forget_restrictSeparated
    (values :
      OmegaScottPower (left.Carrier × right.Carrier)) :
    mapRaw (forgetContinuous left right)
        (restrictSeparated left right values) =
      values ⊓ separatedLocus left right := by
  apply mapRaw_eq_of_image_eq
  ext value
  constructor
  · rintro ⟨source, sourceMember, rfl⟩
    exact ⟨sourceMember, source.separated⟩
  · intro member
    refine
      ⟨
        { fst := WithOmegaScott.ofOmegaScott value.1
          snd := WithOmegaScott.ofOmegaScott value.2
          separated := member.2 },
        ?_,
        ?_
      ⟩
    · exact member.1
    · rfl

/--
A cartesian computation is recovered exactly after restriction and forgetting
iff every one of its results lies in the separated locus.
-/
theorem mapRaw_forget_restrictSeparated_iff
    (values :
      OmegaScottPower (left.Carrier × right.Carrier)) :
    mapRaw (forgetContinuous left right)
        (restrictSeparated left right values) =
        values ↔
      values ≤ separatedLocus left right := by
  rw [mapRaw_forget_restrictSeparated]
  exact inf_eq_left

/--
Every result selected independently from `leftValues` and `rightValues` has
disjoint support.
-/
def CrossSeparated
    (leftValues : OmegaScottPower left.Carrier)
    (rightValues : OmegaScottPower right.Carrier) :
    Prop :=
  ∀ leftValue rightValue,
    WithOmegaScott.toOmegaScott leftValue ∈
        carrier leftValues →
    WithOmegaScott.toOmegaScott rightValue ∈
        carrier rightValues →
    Disjoint
      (left.support leftValue)
      (right.support rightValue)

theorem fubiniRaw_le_separatedLocus_iff
    (leftValues : OmegaScottPower left.Carrier)
    (rightValues : OmegaScottPower right.Carrier) :
    fubiniRaw leftValues rightValues ≤
        separatedLocus left right ↔
      CrossSeparated left right leftValues rightValues := by
  constructor
  · intro inclusion leftValue rightValue leftMember rightMember
    have pairMember :
        WithOmegaScott.toOmegaScott
            (leftValue, rightValue) ∈
          carrier (fubiniRaw leftValues rightValues) := by
      change
        WithOmegaScott.toOmegaScott leftValue ∈
            carrier leftValues ∧
          WithOmegaScott.toOmegaScott rightValue ∈
            carrier rightValues
      exact ⟨leftMember, rightMember⟩
    have result := inclusion pairMember
    change
      Disjoint
        (left.support leftValue)
        (right.support rightValue) at result
    exact result
  · intro cross value member
    exact
      cross
        (WithOmegaScott.ofOmegaScott value.1)
        (WithOmegaScott.ofOmegaScott value.2)
        member.1
        member.2

/--
The ordinary cartesian Fubini computation factors through the support-
separated tensor exactly when its two computations are cross-separated.
-/
theorem fubiniRaw_factors_through_separated_iff
    (leftValues : OmegaScottPower left.Carrier)
    (rightValues : OmegaScottPower right.Carrier) :
    mapRaw (forgetContinuous left right)
        (restrictSeparated left right
          (fubiniRaw leftValues rightValues)) =
        fubiniRaw leftValues rightValues ↔
      CrossSeparated left right
        leftValues rightValues := by
  rw [mapRaw_forget_restrictSeparated_iff]
  exact
    fubiniRaw_le_separatedLocus_iff
      left right leftValues rightValues

end Supported

end Cantilune.Pi.FMSCpoOmegaScottSeparatedFactorization
