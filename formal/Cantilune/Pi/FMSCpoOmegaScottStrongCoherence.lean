import Cantilune.Pi.FMSCpoOmegaScottStrength

/-!
# Multiplicative Fubini coherence for the omega-Scott lower monad

This file proves the object-level multiplication/Fubini diagram for the
unseparated omega-Scott closed-set monad.  It deliberately does not add a
fresh divergence point, a free pointed-semilattice universal property, or an
Abramsky/FMS acceptance package.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottStrongCoherence

open CategoryTheory
open OmegaCompletePartialOrder
open Set
open Topology
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength

universe u

/-! ## Carrier of multiplication -/

/-- The union of all closed computations selected by a closed family. -/
def flattenUnion
    {α : Type u}
    [OmegaCompletePartialOrder α]
    (family : OmegaScottPower (OmegaScottPower α)) :
    Set (WithOmegaScott α) :=
  ⋃₀
    ((fun values : OmegaScottPower α =>
        carrier values) ''
      memberSet family)

theorem carrier_flattenRaw
    {α : Type u}
    [OmegaCompletePartialOrder α]
    (family : OmegaScottPower (OmegaScottPower α)) :
    carrier (flattenRaw family) =
      closure (flattenUnion family) := by
  rfl

theorem mem_flattenUnion_iff
    {α : Type u}
    [OmegaCompletePartialOrder α]
    (family : OmegaScottPower (OmegaScottPower α))
    (value : WithOmegaScott α) :
    value ∈ flattenUnion family ↔
      ∃ values : OmegaScottPower α,
        values ∈ memberSet family ∧
          value ∈ carrier values := by
  constructor
  · intro member
    obtain ⟨selected, selectedInImage, valueMember⟩ :=
      Set.mem_sUnion.mp member
    obtain ⟨values, valuesMember, rfl⟩ :=
      selectedInImage
    exact ⟨values, valuesMember, valueMember⟩
  · rintro ⟨values, valuesMember, valueMember⟩
    apply Set.mem_sUnion_of_mem
      valueMember
    exact ⟨values, valuesMember, rfl⟩

/-! ## Multiplication/Fubini interchange -/

/--
Pairing after flattening two closed families is the same as pairing the
families, mapping pairwise Fubini through the power functor, and flattening.

This is the elementwise diagram corresponding to
`StrongCommutativePowerdomainCoherence.fubini_multiplication`, specialized
to the unseparated omega-Scott lower monad and Lean product carriers.
-/
theorem fubiniRaw_flattenRaw
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (left :
      OmegaScottPower (OmegaScottPower α))
    (right :
      OmegaScottPower (OmegaScottPower β)) :
    fubiniRaw (flattenRaw left) (flattenRaw right) =
      flattenRaw
        (mapRaw
          (fubini :
            OmegaScottPower α × OmegaScottPower β →𝒄
              OmegaScottPower (α × β))
          (fubiniRaw left right)) := by
  apply eq_of_forall_ge_iff
  intro bound
  rw [flattenRaw_le_iff]
  rw [mapRaw_le_iff]
  constructor
  · intro pairedFlattenedLe selected selectedMember
    change
      fubiniRaw selected.1 selected.2 ≤ bound
    have leftLe :
        selected.1 ≤ flattenRaw left := by
      apply le_sSup
      exact
        (mem_memberSet_iff left selected.1).2
          selectedMember.1
    have rightLe :
        selected.2 ≤ flattenRaw right := by
      apply le_sSup
      exact
        (mem_memberSet_iff right selected.2).2
          selectedMember.2
    have pairedLe :
        fubiniRaw selected.1 selected.2 ≤
          fubiniRaw (flattenRaw left) (flattenRaw right) :=
      fubiniRaw_monotone
        (α := α) (β := β)
        (a := (selected.1, selected.2))
        (b := (flattenRaw left, flattenRaw right))
        ⟨leftLe, rightLe⟩
    exact le_trans pairedLe pairedFlattenedLe
  · intro selectedPairsLe value valueMember
    have leftMember :
        value.1 ∈
          closure (flattenUnion left) := by
      rw [← carrier_flattenRaw]
      exact valueMember.1
    have rightMember :
        value.2 ∈
          closure (flattenUnion right) := by
      rw [← carrier_flattenRaw]
      exact valueMember.2
    have selectedLeftWithRight :
        ∀ (leftValue : WithOmegaScott α),
          leftValue ∈ flattenUnion left →
          (leftValue, value.2) ∈ carrier bound := by
      intro leftValue leftInUnion
      obtain
        ⟨leftValues, leftValuesMember,
          leftValueMember⟩ :=
        (mem_flattenUnion_iff left leftValue).1
          leftInUnion
      have unionSubset :
          flattenUnion right ⊆
            omegaScottLift
                (pairLeft
                  (WithOmegaScott.ofOmegaScott leftValue)) ⁻¹'
              carrier bound := by
        intro rightValue rightInUnion
        obtain
          ⟨rightValues, rightValuesMember,
            rightValueMember⟩ :=
          (mem_flattenUnion_iff
            right rightValue).1 rightInUnion
        have pairBound :
            fubiniRaw leftValues rightValues ≤
              bound := by
          have selectedPairMember :
              (leftValues, rightValues) ∈
                carrier (fubiniRaw left right) :=
            ⟨(mem_memberSet_iff left leftValues).1
                leftValuesMember,
              (mem_memberSet_iff right rightValues).1
                rightValuesMember⟩
          have mappedMember :
              (leftValues, rightValues) ∈
                carrier
                  (preimage
                    (fubini :
                      OmegaScottPower α ×
                          OmegaScottPower β →𝒄
                        OmegaScottPower (α × β))
                    (principalRaw bound)) :=
            selectedPairsLe selectedPairMember
          change
            fubiniRaw leftValues rightValues ≤
              bound at mappedMember
          exact mappedMember
        exact
          pairBound
            ⟨leftValueMember, rightValueMember⟩
      have sectionClosed :
          IsClosed
            (omegaScottLift
                (pairLeft
                  (WithOmegaScott.ofOmegaScott leftValue)) ⁻¹'
              carrier bound) :=
        bound.isClosed.preimage
          (continuousHom_omegaScott_continuous
            (pairLeft
              (WithOmegaScott.ofOmegaScott leftValue)))
      exact
        (closure_minimal unionSubset sectionClosed)
          rightMember
    have unionSubset :
        flattenUnion left ⊆
          omegaScottLift
              (pairRight
                (WithOmegaScott.ofOmegaScott value.2)) ⁻¹'
            carrier bound := by
      intro leftValue leftInUnion
      exact
        selectedLeftWithRight leftValue leftInUnion
    have sectionClosed :
        IsClosed
          (omegaScottLift
              (pairRight
                (WithOmegaScott.ofOmegaScott value.2)) ⁻¹'
            carrier bound) :=
      bound.isClosed.preimage
        (continuousHom_omegaScott_continuous
          (pairRight
            (WithOmegaScott.ofOmegaScott value.2)))
    exact
      (closure_minimal unionSubset sectionClosed)
        leftMember

/--
Continuous-hom form of the multiplication/Fubini diagram on Lean product
carriers.
-/
theorem fubini_multiplication
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    (fubini :
        OmegaScottPower α × OmegaScottPower β →𝒄
          OmegaScottPower (α × β)).comp
        (productMap
          (flatten :
            OmegaScottPower (OmegaScottPower α) →𝒄
              OmegaScottPower α)
          (flatten :
            OmegaScottPower (OmegaScottPower β) →𝒄
              OmegaScottPower β)) =
      (flatten :
        OmegaScottPower
            (OmegaScottPower (α × β)) →𝒄
          OmegaScottPower (α × β)).comp
        ((map
            (fubini :
              OmegaScottPower α × OmegaScottPower β →𝒄
                OmegaScottPower (α × β))).comp
          (fubini :
            OmegaScottPower (OmegaScottPower α) ×
                OmegaScottPower (OmegaScottPower β) →𝒄
              OmegaScottPower
                (OmegaScottPower α ×
                  OmegaScottPower β))) := by
  apply ContinuousHom.ext
  intro families
  exact
    fubiniRaw_flattenRaw
      families.1 families.2

/-! ## Transport to mathlib's chosen binary products -/

namespace ChosenProducts

def pairHom
    {source left right : Type u}
    [OmegaCompletePartialOrder source]
    [OmegaCompletePartialOrder left]
    [OmegaCompletePartialOrder right]
    (leftMap : source →𝒄 left)
    (rightMap : source →𝒄 right) :
    source →𝒄 left × right where
  toFun value := (leftMap value, rightMap value)
  monotone' := by
    intro lower upper ordered
    exact
      ⟨leftMap.monotone ordered,
        rightMap.monotone ordered⟩
  map_ωSup' := by
    intro chain
    apply Prod.ext
    · exact leftMap.continuous chain
    · exact rightMap.continuous chain

def prodFst
    {left right : ωCPO.{u}} :
    ωCPO.of (left × right) ⟶ left :=
  ContinuousHom.ofFun Prod.fst

def prodSnd
    {left right : ωCPO.{u}} :
    ωCPO.of (left × right) ⟶ right :=
  ContinuousHom.ofFun Prod.snd

def prodBinaryFan
    (left right : ωCPO.{u}) :
    Limits.BinaryFan left right :=
  Limits.BinaryFan.mk prodFst prodSnd

def prodBinaryFanIsLimit
    (left right : ωCPO.{u}) :
    Limits.IsLimit (prodBinaryFan left right) where
  lift fan :=
    pairHom
      (Limits.BinaryFan.fst fan)
      (Limits.BinaryFan.snd fan)
  fac := by
    intro fan index
    rcases index with ⟨(_ | _)⟩ <;>
      apply ContinuousHom.ext <;>
      intro value <;>
      rfl
  uniq := by
    intro fan morphism equations
    apply ContinuousHom.ext
    intro value
    apply Prod.ext
    · have equality :=
        equations
          ⟨CategoryTheory.Limits.WalkingPair.left⟩
      exact
        ContinuousHom.congr_fun equality value
    · have equality :=
        equations
          ⟨CategoryTheory.Limits.WalkingPair.right⟩
      exact
        ContinuousHom.congr_fun equality value

/--
Canonical isomorphism from mathlib's chosen binary product to the explicit
Lean product carrier used by the object-level Fubini proofs.
-/
def prodIsoProd
    (left right : ωCPO.{u}) :
    left ⨯ right ≅ ωCPO.of (left × right) :=
  (Limits.limit.isLimit _).conePointUniqueUpToIso
    (prodBinaryFanIsLimit left right)

theorem prodIsoProd_hom_apply
    {left right : ωCPO.{u}}
    (value : (left ⨯ right).carrier) :
    (prodIsoProd left right).hom value =
      ((Limits.prod.fst : left ⨯ right ⟶ left) value,
        (Limits.prod.snd : left ⨯ right ⟶ right) value) :=
  rfl

end ChosenProducts

/--
Fubini transported to mathlib's chosen binary products.  This is a genuine
`ωCPO` morphism component.  A bundled natural transformation over the chosen
products remains a separate obligation.
-/
def chosenFubini
    (left right : ωCPO.{u}) :
    (omegaScottPowerFunctor.obj left ⨯
        omegaScottPowerFunctor.obj right) ⟶
      omegaScottPowerFunctor.obj (left ⨯ right) :=
  (ChosenProducts.prodIsoProd
      (omegaScottPowerFunctor.obj left)
      (omegaScottPowerFunctor.obj right)).hom ≫
    (fubini :
      OmegaScottPower left × OmegaScottPower right →𝒄
        OmegaScottPower (left × right)) ≫
    omegaScottPowerFunctor.map
      (ChosenProducts.prodIsoProd left right).inv

/-- Left tensorial strength transported to chosen products. -/
def chosenLeftStrength
    (left right : ωCPO.{u}) :
    (left ⨯ omegaScottPowerFunctor.obj right) ⟶
      omegaScottPowerFunctor.obj (left ⨯ right) :=
  (ChosenProducts.prodIsoProd
      left (omegaScottPowerFunctor.obj right)).hom ≫
    (leftStrength :
      left × OmegaScottPower right →𝒄
        OmegaScottPower (left × right)) ≫
    omegaScottPowerFunctor.map
      (ChosenProducts.prodIsoProd left right).inv

/-- Right tensorial strength transported to chosen products. -/
def chosenRightStrength
    (left right : ωCPO.{u}) :
    (omegaScottPowerFunctor.obj left ⨯ right) ⟶
      omegaScottPowerFunctor.obj (left ⨯ right) :=
  (ChosenProducts.prodIsoProd
      (omegaScottPowerFunctor.obj left) right).hom ≫
    (rightStrength :
      OmegaScottPower left × right →𝒄
        OmegaScottPower (left × right)) ≫
    omegaScottPowerFunctor.map
      (ChosenProducts.prodIsoProd left right).inv

end Cantilune.Pi.FMSCpoOmegaScottStrongCoherence
